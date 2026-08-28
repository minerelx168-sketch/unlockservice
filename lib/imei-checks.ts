import { createHmac } from 'node:crypto'
import { db } from './db'
import { isValidImei, maskIdentifier, normalizeImei } from './imei'
import { activeImeiCheckProvider, type ImeiCheckResult } from './imei-check-provider'
import { consumeAttempt } from './rate-limit'

export type ImeiCheckStatus = 'queued' | 'completed' | 'unavailable'

type ImeiCheckRow = {
  id: number
  user_id: number
  check_type: string
  masked_imei: string
  status: ImeiCheckStatus
  provider: string
  provider_check_id: string | null
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
    readonly code: 'imei_missing' | 'imei_invalid' | 'rate_limited' | 'check_not_found' | 'idempotency_conflict',
  ) {
    super(message)
  }
}

const CHECK_RATE_LIMIT = 12
const CHECK_WINDOW_SECONDS = 60 * 60
const FINGERPRINT_SECRET = process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET ?? 'local-imei-check-fingerprint-v1'

function fingerprint(imei: string) {
  return createHmac('sha256', FINGERPRINT_SECRET).update(imei).digest('hex')
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

function rowForUser(userId: number, id: number): ImeiCheckRow | undefined {
  return db()
    .prepare(
      `SELECT id, user_id, check_type, masked_imei, status, provider,
              provider_check_id, result_json, error_message, created_at, updated_at
         FROM imei_checks
        WHERE user_id = ? AND id = ?`,
    )
    .get(userId, id) as ImeiCheckRow | undefined
}

export function getImeiCheck(userId: number, id: number): ImeiCheckView | undefined {
  const row = rowForUser(userId, id)
  return row ? toView(row) : undefined
}

export function listImeiChecks(userId: number, limit = 25): ImeiCheckView[] {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
  const rows = db()
    .prepare(
      `SELECT id, user_id, check_type, masked_imei, status, provider,
              provider_check_id, result_json, error_message, created_at, updated_at
         FROM imei_checks
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT ?`,
    )
    .all(userId, safeLimit) as ImeiCheckRow[]
  return rows.map(toView)
}

function existingForIdempotency(userId: number, idempotencyKey: string): ImeiCheckView | undefined {
  const row = db()
    .prepare(
      `SELECT id, user_id, check_type, masked_imei, status, provider,
              provider_check_id, result_json, error_message, created_at, updated_at
         FROM imei_checks
        WHERE user_id = ? AND idempotency_key = ?`,
    )
    .get(userId, idempotencyKey) as ImeiCheckRow | undefined
  return row ? toView(row) : undefined
}

function cleanIdempotencyKey(value: string | undefined) {
  const clean = value?.trim() ?? ''
  if (!clean) return undefined
  if (clean.length > 128) throw new ImeiCheckError('The request key is too long.', 'idempotency_conflict')
  return clean
}

function updateResult(id: number, outcome: ImeiCheckResult) {
  db()
    .prepare(
      `UPDATE imei_checks
          SET status = ?, provider = ?, provider_check_id = ?, result_json = ?,
              error_message = ?, updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(
      outcome.status,
      outcome.provider,
      outcome.providerCheckId,
      outcome.result ? JSON.stringify(outcome.result) : null,
      outcome.message ?? null,
      id,
    )
}

/** Creates a free report without creating an invoice or touching credit. */
export async function createImeiCheck(userId: number, input: CreateImeiCheckInput): Promise<ImeiCheckView> {
  const imei = normalizeImei(input.imei)
  if (!imei) throw new ImeiCheckError('Enter the device IMEI.', 'imei_missing')
  if (!isValidImei(imei)) {
    throw new ImeiCheckError('Enter a valid 15-digit IMEI.', 'imei_invalid')
  }

  const idempotencyKey = cleanIdempotencyKey(input.idempotencyKey)
  if (idempotencyKey) {
    const existing = existingForIdempotency(userId, idempotencyKey)
    if (existing) return existing
  }

  if (!consumeAttempt('imei-check-user', String(userId), CHECK_RATE_LIMIT, CHECK_WINDOW_SECONDS)) {
    throw new ImeiCheckError('Too many checks. Please try again later.', 'rate_limited')
  }

  const provider = activeImeiCheckProvider()
  const inserted = db()
    .prepare(
      `INSERT INTO imei_checks
         (user_id, check_type, imei_fingerprint, masked_imei, status, provider, idempotency_key)
       VALUES (?, 'basic', ?, ?, 'queued', ?, ?)`,
    )
    .run(userId, fingerprint(imei), maskIdentifier(imei), provider.name, idempotencyKey ?? null)

  const checkId = Number(inserted.lastInsertRowid)
  try {
    const outcome = await provider.check({ imei, checkType: 'basic' })
    updateResult(checkId, outcome)
  } catch {
    updateResult(checkId, {
      status: 'unavailable',
      provider: provider.name,
      providerCheckId: null,
      result: null,
      message: 'The check provider is temporarily unavailable. Please try again later.',
    })
  }

  return getImeiCheck(userId, checkId)!
}
