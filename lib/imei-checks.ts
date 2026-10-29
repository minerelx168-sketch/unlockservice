import { db } from './db'
import { decryptProviderCode } from './provider-code'
import { maskIdentifier } from './imei'
import { serviceIdentifier } from './service-identifier'
import { fingerprintImei } from './imei-privacy'
import { decryptImeiCheckImei, encryptImeiCheckImei } from './imei-check-imei'
import { activeImeiCheckProvider, type ImeiCheckResult } from './imei-check-provider'
import { imeiProviderService, providerConfiguration } from './provider-api'
import { recordProviderEvent } from './provider-events'
import { claimProviderPoll } from './provider-poll-lease'
import { consumeAttempt } from './rate-limit'

export type ImeiCheckStatus = 'queued' | 'processing' | 'completed' | 'unavailable'

type ImeiCheckRow = {
  id: number
  user_id: number
  check_type: string
  masked_imei: string
  imei_encrypted: string | null
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
  imei?: string
  status: ImeiCheckStatus
  provider: string
  result: Record<string, unknown> | null
  providerCode?: string
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
      | 'provider_not_ready'
      | 'account_not_ready',
  ) {
    super(message)
  }
}

const CHECK_RATE_LIMIT = 12
const CHECK_WINDOW_SECONDS = 60 * 60
const POLL_DEBOUNCE_MS = 5_000
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
  const result = parseResult(row.result_json)
  const encrypted = result?._providerCodeEncrypted
  if (result) delete result._providerCodeEncrypted
  return {
    id: row.id,
    checkType: row.check_type,
    maskedImei: row.masked_imei,
    imei: decryptImeiCheckImei(row.imei_encrypted) ?? undefined,
    status: row.status,
    provider: row.provider,
    result,
    providerCode: decryptProviderCode(typeof encrypted === 'string' ? encrypted : null) ?? undefined,
    message: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

const ROW_SELECT = `
  SELECT id, user_id, check_type, masked_imei, imei_encrypted, status, provider,
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

export const FREE_APPLE_DAILY_LIMIT = 3
export function freeAppleQuota(userId: number) {
  const row = db().prepare("SELECT count(*) AS used FROM imei_checks WHERE user_id=? AND check_type='apple_free' AND created_at>=datetime('now','start of day')").get(userId) as { used: number }
  const resetAt = new Date(); resetAt.setUTCHours(24, 0, 0, 0)
  return { limit: FREE_APPLE_DAILY_LIMIT, used: row.used, remaining: Math.max(0, FREE_APPLE_DAILY_LIMIT - row.used), resetAt: resetAt.toISOString() }
}

/** Each accepted attempt consumes a daily slot, including uncertain upstream responses. */
export async function createImeiCheck(userId: number, input: CreateImeiCheckInput): Promise<ImeiCheckView> {
  const imei = serviceIdentifier(input.imei)
  if (!imei) throw new ImeiCheckError('Enter a valid 15-digit IMEI.', 'imei_invalid')
  const account = db().prepare("SELECT 1 FROM users WHERE id=? AND account_type IN ('customer', 'reseller', 'admin') AND status='active' AND banned_at IS NULL AND email_verified_at IS NOT NULL").get(userId)
  if (!account) throw new ImeiCheckError('Sign in with an active verified account to use Apple Free Check.', 'account_not_ready')

  const idempotencyKey = cleanIdempotencyKey(input.idempotencyKey)
  if (idempotencyKey) {
    const existing = existingForIdempotency(userId, idempotencyKey)
    if (existing) {
      if (existing.checkType !== 'apple_free' || existing.imei !== imei) throw new ImeiCheckError('This request key belongs to another check.', 'idempotency_conflict')
      return existing
    }
  }

  if (!consumeAttempt('imei-check-user', String(userId), CHECK_RATE_LIMIT, CHECK_WINDOW_SECONDS)) {
    throw new ImeiCheckError('Too many checks. Please try again later.', 'rate_limited')
  }

  const provider = activeImeiCheckProvider()
  const config = providerConfiguration()
  const service = imeiProviderService('apple_free')
  if (!config.enabled || !config.endpoint || !config.apiKey || service?.id !== '214' || service.mode !== 'sync') {
    throw new ImeiCheckError('Apple Free Check is temporarily unavailable. Please try again later.', 'provider_not_ready')
  }
  const providerMode = service.mode
  const claim = db().transaction(() => {
    if (idempotencyKey) {
      const existing = existingForIdempotency(userId, idempotencyKey)
      if (existing) {
        if (existing.checkType !== 'apple_free' || existing.imei !== imei) throw new ImeiCheckError('This request key belongs to another check.', 'idempotency_conflict')
        return { existing }
      }
    }
    if (freeAppleQuota(userId).remaining === 0) throw new ImeiCheckError('You have used your 3 free checks today. Choose a paid Phone Check or come back after the daily reset.', 'rate_limited')
    const inserted = db()
    .prepare(
      `INSERT INTO imei_checks
         (user_id, check_type, imei_fingerprint, masked_imei, imei_encrypted, status, provider,
          provider_mode, provider_service_id, idempotency_key)
       VALUES (?, 'apple_free', ?, ?, ?, 'queued', ?, ?, ?, ?)`,
    )
    .run(
      userId,
      fingerprintImei(imei),
      maskIdentifier(imei),
      encryptImeiCheckImei(imei),
      provider.name,
      providerMode,
      service?.id ?? null,
      idempotencyKey ?? null,
    )
    return { id: Number(inserted.lastInsertRowid) }
  }).immediate()
  if ('existing' in claim) return claim.existing!
  const checkId = claim.id
  try {
    const outcome = await provider.check({ imei, checkType: 'apple_free' })
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
  const snapshot = rowForUser(userId, id)
  if (!snapshot) throw new ImeiCheckError('Check not found.', 'check_not_found')
  if (snapshot.status !== 'processing' || !snapshot.provider_check_id) return toView(snapshot)
  const snapshotLastPoll = snapshot.provider_last_polled_at ? Date.parse(`${snapshot.provider_last_polled_at}Z`) : 0
  if (snapshotLastPoll && Date.now() - snapshotLastPoll < POLL_DEBOUNCE_MS) return toView(snapshot)

  const releasePoll = claimProviderPoll('imei_check', snapshot.id)
  if (!releasePoll) return toView(snapshot)

  try {
    const row = rowForUser(userId, id)
    if (!row) throw new ImeiCheckError('Check not found.', 'check_not_found')
    if (row.status !== 'processing' || !row.provider_check_id) return toView(row)
    const lastPoll = row.provider_last_polled_at ? Date.parse(`${row.provider_last_polled_at}Z`) : 0
    if (lastPoll && Date.now() - lastPoll < POLL_DEBOUNCE_MS) return toView(row)
    const provider = activeImeiCheckProvider()
    if (!provider.poll || !providerConfiguration().enabled) return toView(row)

    const outcome = await provider.poll(row.provider_check_id, row.check_type)
    updateResult(id, outcome, true)
    auditOutcome(id, row.provider_mode ?? 'dhru', outcome, `poll:${row.provider_attempts + 1}:${outcome.status}`)
    return getImeiCheck(userId, id)!
  } finally {
    releasePoll()
  }
}

