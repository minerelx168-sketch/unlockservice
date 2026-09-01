import { createHmac } from 'node:crypto'
import { db } from './db'
import { isValidImei, maskIdentifier, normalizeImei } from './imei'
import { activeImeiCheckProvider, type ImeiCheckResult } from './imei-check-provider'
import { imeiProviderService, providerConfiguration } from './provider-api'
import { recordProviderEvent } from './provider-events'
import { consumeAttempt } from './rate-limit'

export type ImeiCheckStatus = 'queued' | 'processing' | 'completed' | 'unavailable'

type ImeiCheckRow = {
  id: number
  user_id: number
  check_type: string
  masked_imei: string
  status: ImeiCheckStatus
  provider: string
  provider_check_id: string | null
  provider_mode: string | null
  provider_service_id: string | null
  provider_last_polled_at: string | null
  provider_attempts: number
  provider_error_code: string | null
  result_json: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type ImeiCheckView = {
  id: number
  checkType: string
  maskedImei: string
  status: ImeiCheckStatus
  provider: string
  result: Record<string, unknown> | null
  message?: string
  createdAt: string
  updatedAt: string
}

export type CreateImeiCheckInput = {
  imei: string
  idempotencyKey?: string
}

export class ImeiCheckError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'imei_missing'
      | 'imei_invalid'
      | 'rate_limited'
      | 'check_not_found'
      | 'idempotency_conflict'
      | 'provider_not_ready',
  ) {
    super(message)
  }
}

const CHECK_RATE_LIMIT = 12
const CHECK_WINDOW_SECONDS = 60 * 60
const POLL_DEBOUNCE_MS = 5_000
const DEVELOPMENT_FINGERPRINT_SECRET = 'local-imei-check-fingerprint-v1'

/**
 * The point of storing a fingerprint rather than the IMEI is that the row
 * cannot be turned back into the number. An HMAC keyed with a constant that
 * ships in the source gives that away: the serial space behind a known TAC
 * is only a million wide, so anyone holding the database and this file can
 * enumerate it. In production the key has to be a real one.
 */
function fingerprintSecret(): string {
  const configured = process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET?.trim()
  if (configured && configured.length >= 32) return configured
  if (process.env.NODE_ENV === 'production') {
    throw new ImeiCheckError(
      'IMEI checks are unavailable until the service is fully configured.',
      'provider_not_ready',
    )
  }
  return configured || DEVELOPMENT_FINGERPRINT_SECRET
}

function fingerprint(imei: string) {
  return createHmac('sha256', fingerprintSecret()).update(imei).digest('hex')
}

function parseResult(value: string | null): Record<string, unknown> | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function toView(row: ImeiCheckRow): ImeiCheckView {
  return {
    id: row.id,
    checkType: row.check_type,
    maskedImei: row.masked_imei,
    status: row.status,
    provider: row.provider,
    result: parseResult(row.result_json),
    message: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const ROW_SELECT = `
  SELECT id, user_id, check_type, masked_imei, status, provider,
         provider_check_id, provider_mode, provider_service_id,
         provider_last_polled_at, provider_attempts, provider_error_code,
         result_json, error_message, created_at, updated_at
    FROM imei_checks
`

function rowForUser(userId: number, id: number): ImeiCheckRow | undefined {
  return db().prepare(`${ROW_SELECT} WHERE user_id = ? AND id = ?`).get(userId, id) as ImeiCheckRow | undefined
}

export function getImeiCheck(userId: number, id: number): ImeiCheckView | undefined {
  const row = rowForUser(userId, id)
  return row ? toView(row) : undefined
}

export function listImeiChecks(userId: number, limit = 25): ImeiCheckView[] {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
  const rows = db()
    .prepare(`${ROW_SELECT} WHERE user_id = ? ORDER BY id DESC LIMIT ?`)
    .all(userId, safeLimit) as ImeiCheckRow[]
  return rows.map(toView)
}

function existingForIdempotency(userId: number, idempotencyKey: string): ImeiCheckView | undefined {
  const row = db()
    .prepare(`${ROW_SELECT} WHERE user_id = ? AND idempotency_key = ?`)
    .get(userId, idempotencyKey) as ImeiCheckRow | undefined
  return row ? toView(row) : undefined
}

function cleanIdempotencyKey(value: string | undefined) {
  const clean = value?.trim() ?? ''
  if (!clean) return undefined
  if (clean.length > 128) throw new ImeiCheckError('The request key is too long.', 'idempotency_conflict')
  return clean
}

function updateResult(id: number, outcome: ImeiCheckResult, polled = false) {
  db()
    .prepare(
      `UPDATE imei_checks
          SET status = ?, provider = ?, provider_check_id = ?, result_json = ?,
              error_message = ?, provider_error_code = ?,
              provider_last_polled_at = CASE WHEN ? = 1 THEN datetime('now') ELSE provider_last_polled_at END,
              provider_attempts = provider_attempts + CASE WHEN ? = 1 THEN 1 ELSE 0 END,
              updated_at = datetime('now')
        WHERE id = ? AND status IN ('queued', 'processing')`,
    )
    .run(
      outcome.status,
      outcome.provider,
      outcome.providerCheckId,
      outcome.result ? JSON.stringify(outcome.result) : null,
      outcome.message ?? null,
      outcome.errorCode ?? null,
      polled ? 1 : 0,
      polled ? 1 : 0,
      id,
    )
}

function auditOutcome(id: number, mode: string, outcome: ImeiCheckResult, eventKey: string) {
  recordProviderEvent({
    resourceType: 'imei_check',
    resourceId: id,
    provider: outcome.provider,
    providerMode: mode,
    eventType:
      outcome.status === 'completed'
        ? 'completed'
        : outcome.status === 'processing'
          ? 'processing'
          : 'unavailable',
    idempotencyKey: eventKey,
    errorCode: outcome.errorCode,
    metadata: { status: outcome.status, retryAfterMs: outcome.retryAfterMs },
  })
}

/** Creates a free report without creating an invoice or touching credit. */
export async function createImeiCheck(userId: number, input: CreateImeiCheckInput): Promise<ImeiCheckView> {
  const imei = normalizeImei(input.imei)
  if (!imei) throw new ImeiCheckError('Enter the device IMEI.', 'imei_missing')
  if (!isValidImei(imei)) throw new ImeiCheckError('Enter a valid 15-digit IMEI.', 'imei_invalid')

  const idempotencyKey = cleanIdempotencyKey(input.idempotencyKey)
  if (idempotencyKey) {
    const existing = existingForIdempotency(userId, idempotencyKey)
    if (existing) return existing
  }

  if (!consumeAttempt('imei-check-user', String(userId), CHECK_RATE_LIMIT, CHECK_WINDOW_SECONDS)) {
    throw new ImeiCheckError('Too many checks. Please try again later.', 'rate_limited')
  }

  const provider = activeImeiCheckProvider()
  const config = providerConfiguration()
  const service = imeiProviderService('basic')
  const providerMode = config.enabled && service ? service.mode : 'local'
  const inserted = db()
    .prepare(
      `INSERT INTO imei_checks
         (user_id, check_type, imei_fingerprint, masked_imei, status, provider,
          provider_mode, provider_service_id, idempotency_key)
       VALUES (?, 'basic', ?, ?, 'queued', ?, ?, ?, ?)`,
    )
    .run(
      userId,
      fingerprint(imei),
      maskIdentifier(imei),
      provider.name,
      providerMode,
      service?.id ?? null,
      idempotencyKey ?? null,
    )

  const checkId = Number(inserted.lastInsertRowid)
  try {
    const outcome = await provider.check({ imei, checkType: 'basic' })
    updateResult(checkId, outcome)
    auditOutcome(checkId, providerMode, outcome, `submit:${outcome.providerCheckId ?? checkId}`)
  } catch {
    const outcome: ImeiCheckResult = {
      status: 'unavailable',
      provider: provider.name,
      providerCheckId: null,
      result: null,
      message: 'The check provider is temporarily unavailable. Please try again later.',
      errorCode: 'provider_exception',
    }
    updateResult(checkId, outcome)
    auditOutcome(checkId, providerMode, outcome, `submit-error:${checkId}`)
  }

  return getImeiCheck(userId, checkId)!
}

export async function pollImeiCheck(userId: number, id: number): Promise<ImeiCheckView> {
  const row = rowForUser(userId, id)
  if (!row) throw new ImeiCheckError('Check not found.', 'check_not_found')
  if (row.status !== 'processing') return toView(row)

  const lastPoll = row.provider_last_polled_at ? Date.parse(`${row.provider_last_polled_at}Z`) : 0
  if (lastPoll && Date.now() - lastPoll < POLL_DEBOUNCE_MS) return toView(row)

  const provider = activeImeiCheckProvider()
  if (!provider.poll || !row.provider_check_id || !providerConfiguration().enabled) return toView(row)

  const outcome = await provider.poll(row.provider_check_id)
  updateResult(id, outcome, true)
  auditOutcome(id, row.provider_mode ?? 'dhru', outcome, `poll:${row.provider_attempts + 1}:${outcome.status}`)
  return getImeiCheck(userId, id)!
}
