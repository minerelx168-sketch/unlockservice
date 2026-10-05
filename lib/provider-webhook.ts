import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { db } from './db'
import { settleOrderWebhook } from './orders'
import { settlePaidReportWebhook } from './paid-reports'
import { providerConfiguration } from './provider-api'

const MAX_BODY_BYTES = 64 * 1024
const READ_DEADLINE_MS = 5_000
const TIMESTAMP_TOLERANCE_SECONDS = 300

type WebhookPayload = {
  eventId: string
  resourceType: 'order' | 'paid_imei_report'
  providerOrderId: string
  status: 'success' | 'rejected'
  result?: Record<string, unknown>
  message?: string
  unlockCode?: string
}

class WebhookError extends Error {
  constructor(readonly status: number, readonly code: string) {
    super(code)
  }
}

function response(status: number, body: Record<string, unknown>) {
  return Response.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      ...(status === 503 ? { 'Retry-After': '5' } : {}),
    },
  })
}

/** Bound actual bytes, including chunked requests without Content-Length. */
async function readBody(request: Request): Promise<Buffer> {
  const contentLength = request.headers.get('content-length')
  if (contentLength !== null) {
    if (!/^\d+$/.test(contentLength)) throw new WebhookError(400, 'invalid_content_length')
    if (contentLength.length > 10 || Number(contentLength) > MAX_BODY_BYTES) {
      // Do not await cancellation: a hostile stream can keep cancel() pending.
      void request.body?.cancel().catch(() => {})
      throw new WebhookError(413, 'payload_too_large')
    }
  }
  if (!request.body) throw new WebhookError(400, 'invalid_payload')
  const reader = request.body.getReader()
  const deadlineAt = Date.now() + READ_DEADLINE_MS
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new WebhookError(408, 'request_timeout')), READ_DEADLINE_MS)
  })
  const chunks: Buffer[] = []
  let bytes = 0
  try {
    while (true) {
      // The clock check also bounds streams producing endless empty chunks;
      // a chain of immediately resolved reads must not starve the timer.
      if (Date.now() >= deadlineAt) throw new WebhookError(408, 'request_timeout')
      const chunk = await Promise.race([reader.read(), deadline])
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_BODY_BYTES) throw new WebhookError(413, 'payload_too_large')
      chunks.push(Buffer.from(chunk.value))
    }
    return Buffer.concat(chunks, bytes)
  } catch (error) {
    void reader.cancel().catch(() => {})
    if (error instanceof WebhookError) throw error
    throw new WebhookError(400, 'invalid_body')
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

/** Also bound depth/field sizes before handing provider data to report builders. */
function validateResult(result: Record<string, unknown>) {
  const pending: { value: unknown; depth: number }[] = [{ value: result, depth: 0 }]
  let count = 0
  while (pending.length) {
    const { value, depth } = pending.pop()!
    if (++count > 2_048 || depth > 8) throw new WebhookError(400, 'invalid_payload')
    if (typeof value === 'string' && value.length > 8_192) throw new WebhookError(400, 'invalid_payload')
    if (typeof value === 'number' && !Number.isFinite(value)) throw new WebhookError(400, 'invalid_payload')
    if (Array.isArray(value)) {
      for (const child of value) pending.push({ value: child, depth: depth + 1 })
    } else if (isRecord(value)) {
      for (const [key, child] of Object.entries(value)) {
        if (key.length > 128 || ['__proto__', 'prototype', 'constructor'].includes(key)) {
          throw new WebhookError(400, 'invalid_payload')
        }
        pending.push({ value: child, depth: depth + 1 })
      }
    }
  }
}

function parsePayload(raw: Buffer): WebhookPayload {
  let parsed: unknown
  try {
    // Fail on invalid UTF-8 instead of silently replacing signed bytes.
    parsed = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw))
  } catch {
    throw new WebhookError(400, 'invalid_payload')
  }
  if (!isRecord(parsed)) throw new WebhookError(400, 'invalid_payload')
  const allowed = new Set(['eventId', 'resourceType', 'providerOrderId', 'status', 'result', 'message', 'unlockCode'])
  if (Object.keys(parsed).some((key) => !allowed.has(key))) throw new WebhookError(400, 'invalid_payload')
  if (typeof parsed.eventId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(parsed.eventId)) {
    throw new WebhookError(400, 'invalid_payload')
  }
  if (typeof parsed.providerOrderId !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,255}$/.test(parsed.providerOrderId)) {
    throw new WebhookError(400, 'invalid_payload')
  }
  if ((parsed.resourceType !== 'order' && parsed.resourceType !== 'paid_imei_report')
    || (parsed.status !== 'success' && parsed.status !== 'rejected')) throw new WebhookError(400, 'invalid_payload')
  if ('result' in parsed) {
    if (!isRecord(parsed.result)) throw new WebhookError(400, 'invalid_payload')
    validateResult(parsed.result)
  }
  for (const [field, limit] of [['message', 1_000], ['unlockCode', 256]] as const) {
    if (field in parsed && (typeof parsed[field] !== 'string'
      || parsed[field].length > limit
      || [...parsed[field]].some((character) => character.charCodeAt(0) < 32 && !'\t\r\n'.includes(character)))) {
      throw new WebhookError(400, 'invalid_payload')
    }
  }
  if (parsed.resourceType === 'paid_imei_report' && 'unlockCode' in parsed) throw new WebhookError(400, 'invalid_payload')
  return parsed as WebhookPayload
}

/**
 * Opt-in callback contract: HMAC-SHA256(timestamp + '.' + exact HTTP body).
 * This requires explicit provider support; there is intentionally no unsigned
 * fallback. The callback never supplies a trusted user, provider, or amount.
 */
export async function handleProviderWebhook(request: Request): Promise<Response> {
  try {
    if (request.method !== 'POST') throw new WebhookError(405, 'method_not_allowed')
    const secret = process.env.IUNLOCKMOBILE_PROVIDER_WEBHOOK_SECRET ?? ''
    if (!/^[a-f\d]{64}$/i.test(secret)) throw new WebhookError(503, 'webhook_not_configured')
    if (!/^application\/json(?:\s*;\s*charset\s*=\s*(?:"utf-8"|utf-8))?\s*$/i.test(request.headers.get('content-type') ?? '')) {
      throw new WebhookError(415, 'unsupported_media_type')
    }
    const encoding = request.headers.get('content-encoding')
    if (encoding && encoding.toLowerCase().trim() !== 'identity') throw new WebhookError(415, 'unsupported_content_encoding')
    const timestamp = request.headers.get('x-provider-timestamp') ?? ''
    const signature = request.headers.get('x-provider-signature') ?? ''
    if (!/^\d{1,12}$/.test(timestamp) || Math.abs(Math.floor(Date.now() / 1_000) - Number(timestamp)) > TIMESTAMP_TOLERANCE_SECONDS
      || !/^sha256=[a-f\d]{64}$/i.test(signature)) throw new WebhookError(401, 'invalid_signature')

    const raw = await readBody(request)
    if (Math.abs(Math.floor(Date.now() / 1_000) - Number(timestamp)) > TIMESTAMP_TOLERANCE_SECONDS) {
      throw new WebhookError(401, 'invalid_signature')
    }
    const expected = createHmac('sha256', Buffer.from(secret, 'hex')).update(timestamp).update('.').update(raw).digest()
    if (!timingSafeEqual(expected, Buffer.from(signature.slice(7), 'hex'))) throw new WebhookError(401, 'invalid_signature')
    // Authenticating before JSON parsing avoids acting on any unverified data.
    const payload = parsePayload(raw)
    const provider = providerConfiguration().name
    const payloadHash = createHash('sha256').update(raw).digest('hex')
    const outcome = db().transaction(() => {
      const receipt = db().prepare('SELECT payload_sha256 FROM provider_webhook_receipts WHERE provider = ? AND event_id = ?')
        .get(provider, payload.eventId) as { payload_sha256: string } | undefined
      if (receipt) {
        if (receipt.payload_sha256 !== payloadHash) throw new WebhookError(409, 'event_conflict')
        return { success: true, duplicate: true }
      }
      // Table selection is from our validated enum, never an arbitrary SQL identifier.
      const table = payload.resourceType === 'order' ? 'orders' : 'paid_report_orders'
      const candidates = db().prepare(`SELECT id FROM ${table} WHERE provider_name = ? AND provider_order_id = ? LIMIT 2`)
        .all(provider, payload.providerOrderId) as { id: number }[]
      // A callback may arrive before placement stores its provider reference.
      // Do not consume the event: 503 asks the provider to retry after correlation.
      if (candidates.length !== 1) throw new WebhookError(503, 'correlation_pending')
      const settled = payload.resourceType === 'order'
        ? settleOrderWebhook(candidates[0].id, payload.providerOrderId, payload)
        : settlePaidReportWebhook(candidates[0].id, payload.providerOrderId, payload)
      db().prepare('INSERT INTO provider_webhook_receipts (provider, event_id, payload_sha256) VALUES (?, ?, ?)')
        .run(provider, payload.eventId, payloadHash)
      return { success: true, status: settled.status }
    }).immediate()
    return response(200, outcome)
  } catch (error) {
    if (error instanceof WebhookError) return response(error.status, { success: false, code: error.code })
    // A DB/settlement failure rolled back the receipt and balance together.
    // Return a retryable error without leaking provider data or database details.
    return response(503, { success: false, code: 'temporarily_unavailable' })
  }
}
