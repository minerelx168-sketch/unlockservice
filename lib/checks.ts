import { db, getService, type ServiceRow } from './db'
import { charge, getBalance, hold, InsufficientCredit, refund } from './credits'
import { IMEI_LENGTH, luhnValid, normalizeImei } from './imei'
import { activeProvider, maintenanceState } from './provider'

/**
 * The check pipeline, mirroring the two-endpoint shape of the observed
 * system: one call submits the order, a second one polls it. Credit is
 * held before the provider is ever contacted and only becomes a charge
 * once the provider has actually answered.
 */

export class CheckError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'CheckError'
  }
}

export type CheckLog = {
  id: number
  user_id: number
  service_id: number
  identifier: string
  status: 'pending' | 'success' | 'error'
  response_json: string | null
  sell_price_cents: number
  source: string
  provider_order_id: string | null
  provider_ready_at: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

/** What both endpoints return; field names follow the observed contract. */
export type CheckPayload = {
  success: boolean
  logId: number
  status: 'pending' | 'success' | 'error'
  identifier: string
  service: { id: number; name: string }
  sellPriceCents: number
  response: Record<string, unknown> | null
  message?: string
  credit: {
    beforeCents: number
    heldCents: number
    chargedCents: number
    refundedCents: number
    balanceCents: number
  }
}

const SERIAL_PATTERN = /^[A-Z0-9]{6,20}$/

/**
 * Serial numbers are alphanumeric and must contain a letter, otherwise a
 * 15-digit IMEI typed into a serial-only service would sail through.
 */
export function validateIdentifier(raw: string, service: ServiceRow): string {
  const trimmed = raw.trim().toUpperCase()
  if (!trimmed) throw new CheckError('Enter an IMEI or serial number.', 'identifier_missing')

  const looksLikeImei = /^\d+$/.test(trimmed.replace(/\s/g, ''))

  if (looksLikeImei) {
    if (service.identifier_type === 'serial') {
      throw new CheckError('This service needs a serial number, not an IMEI.', 'identifier_type')
    }
    const digits = normalizeImei(trimmed)
    if (digits.length !== IMEI_LENGTH) {
      throw new CheckError(`An IMEI is ${IMEI_LENGTH} digits.`, 'identifier_length')
    }
    if (!luhnValid(digits)) {
      throw new CheckError('That IMEI checksum does not match. Re-read the last digit.', 'identifier_checksum')
    }
    return digits
  }

  if (service.identifier_type === 'imei') {
    throw new CheckError('This service needs an IMEI, not a serial number.', 'identifier_type')
  }
  const serial = trimmed.replace(/\s/g, '')
  if (!SERIAL_PATTERN.test(serial) || !/[A-Z]/.test(serial)) {
    throw new CheckError('A serial number is 6–20 letters and digits.', 'identifier_format')
  }
  return serial
}

export function getLog(logId: number, userId: number): CheckLog | undefined {
  return db()
    .prepare('SELECT * FROM check_logs WHERE id = ? AND user_id = ?')
    .get(logId, userId) as CheckLog | undefined
}

function payload(
  log: CheckLog,
  service: { id: number; name: string },
  credit: CheckPayload['credit'],
  message?: string,
): CheckPayload {
  return {
    success: log.status !== 'error',
    logId: log.id,
    status: log.status,
    identifier: log.identifier,
    service,
    sellPriceCents: log.sell_price_cents,
    response: log.response_json ? (JSON.parse(log.response_json) as Record<string, unknown>) : null,
    message: message ?? log.error_message ?? undefined,
    credit,
  }
}

export async function submitCheck(
  userId: number,
  serviceId: number,
  rawIdentifier: string,
  source: 'website' | 'api' = 'website',
): Promise<CheckPayload> {
  if (maintenanceState().active) {
    throw new CheckError(maintenanceState().message, 'maintenance')
  }

  const service = getService(serviceId)
  if (!service) throw new CheckError('That service is not available.', 'service_unknown')

  const identifier = validateIdentifier(rawIdentifier, service)
  const price = service.sell_price_cents
  const before = getBalance(userId)

  const insert = db()
    .prepare(
      `INSERT INTO check_logs (user_id, service_id, identifier, status, sell_price_cents, source)
       VALUES (?, ?, ?, 'pending', ?, ?)`,
    )
    .run(userId, service.id, identifier, price, source)
  const logId = Number(insert.lastInsertRowid)

  try {
    hold(userId, price, 'check', String(logId))
  } catch (error) {
    db().prepare("DELETE FROM check_logs WHERE id = ?").run(logId)
    if (error instanceof InsufficientCredit) {
      throw new CheckError('Not enough credit for this service. Add funds and try again.', 'insufficient_credit')
    }
    throw error
  }

  const provider = activeProvider()
  let result
  try {
    result = await provider.submit(service, identifier)
  } catch {
    result = { status: 'error' as const, orderId: null, message: 'The provider could not be reached.' }
  }

  if (result.status === 'success') {
    return settleSuccess(logId, userId, service, result.orderId, result.response)
  }

  if (result.status === 'pending') {
    const readyAt = new Date(Date.now() + result.readyInMs).toISOString()
    db()
      .prepare(
        `UPDATE check_logs SET provider_order_id = ?, provider_ready_at = ?, updated_at = datetime('now')
         WHERE id = ?`,
      )
      .run(result.orderId, readyAt, logId)
    const log = getLog(logId, userId)!
    const balance = getBalance(userId)
    return payload(log, service, {
      beforeCents: before.availableCents,
      heldCents: price,
      chargedCents: 0,
      refundedCents: 0,
      balanceCents: balance.availableCents,
    })
  }

  return settleError(logId, userId, service, result.message, before.availableCents)
}

export async function pollCheck(userId: number, logId: number): Promise<CheckPayload> {
  const log = getLog(logId, userId)
  if (!log) throw new CheckError('No such check.', 'log_unknown')

  const service = getService(log.service_id) ?? {
    id: log.service_id,
    name: 'Unknown service',
    sell_price_cents: log.sell_price_cents,
    identifier_type: 'imei' as const,
    is_active: 0,
  }
  const balance = getBalance(userId)
  const settled = {
    beforeCents: balance.availableCents,
    heldCents: log.status === 'pending' ? log.sell_price_cents : 0,
    chargedCents: log.status === 'success' ? log.sell_price_cents : 0,
    refundedCents: 0,
    balanceCents: balance.availableCents,
  }

  if (log.status !== 'pending') return payload(log, service, settled)

  const readyAt = log.provider_ready_at ? new Date(log.provider_ready_at).getTime() : 0
  if (Date.now() < readyAt) return payload(log, service, settled)

  const provider = activeProvider()
  let result
  try {
    result = await provider.poll(log.provider_order_id ?? '', service, log.identifier)
  } catch {
    result = { status: 'error' as const, orderId: null, message: 'The provider could not be reached.' }
  }

  if (result.status === 'success') {
    return settleSuccess(log.id, userId, service, result.orderId, result.response)
  }
  if (result.status === 'pending') return payload(log, service, settled)
  return settleError(log.id, userId, service, result.message, balance.availableCents)
}

function settleSuccess(
  logId: number,
  userId: number,
  service: ServiceRow,
  orderId: string,
  response: Record<string, unknown>,
): CheckPayload {
  const log = db().prepare('SELECT * FROM check_logs WHERE id = ?').get(logId) as CheckLog
  const before = getBalance(userId)
  const after = charge(userId, log.sell_price_cents, 'check', String(logId))

  db()
    .prepare(
      `UPDATE check_logs
          SET status = 'success', response_json = ?, provider_order_id = ?,
              provider_ready_at = NULL, updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(JSON.stringify(response), orderId, logId)

  return payload(getLog(logId, userId)!, service, {
    beforeCents: before.availableCents,
    heldCents: 0,
    chargedCents: log.sell_price_cents,
    refundedCents: 0,
    balanceCents: after.availableCents,
  })
}

function settleError(
  logId: number,
  userId: number,
  service: ServiceRow,
  message: string,
  beforeCents: number,
): CheckPayload {
  const log = db().prepare('SELECT * FROM check_logs WHERE id = ?').get(logId) as CheckLog
  const after = refund(userId, log.sell_price_cents, 'check', String(logId))

  db()
    .prepare(
      `UPDATE check_logs
          SET status = 'error', error_message = ?, provider_ready_at = NULL,
              updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(message, logId)

  return payload(getLog(logId, userId)!, service, {
    beforeCents,
    heldCents: 0,
    chargedCents: 0,
    refundedCents: log.sell_price_cents,
    balanceCents: after.availableCents,
  }, message)
}

export type CheckHistoryRow = CheckLog & { service_name: string }

export function listChecks(userId: number, limit = 20, offset = 0): CheckHistoryRow[] {
  return db()
    .prepare(
      `SELECT l.*, COALESCE(s.name, 'Removed service') AS service_name
         FROM check_logs l LEFT JOIN services s ON s.id = l.service_id
        WHERE l.user_id = ?
        ORDER BY l.id DESC LIMIT ? OFFSET ?`,
    )
    .all(userId, limit, offset) as CheckHistoryRow[]
}

export function checkStats(userId: number) {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS succeeded,
              SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) AS today
         FROM check_logs WHERE user_id = ?`,
    )
    .get(userId) as { total: number; succeeded: number | null; today: number | null }
  const favourite = db()
    .prepare(
      `SELECT COALESCE(s.name, 'Removed service') AS name, COUNT(*) AS uses
         FROM check_logs l LEFT JOIN services s ON s.id = l.service_id
        WHERE l.user_id = ? GROUP BY l.service_id ORDER BY uses DESC LIMIT 1`,
    )
    .get(userId) as { name: string; uses: number } | undefined
  return {
    total: row.total,
    succeeded: row.succeeded ?? 0,
    today: row.today ?? 0,
    favourite: favourite?.name ?? null,
  }
}
