import {
  db,
  getBrand,
  getCarrier,
  getDeviceService,
  serviceCoversBrand,
  type BrandRow,
} from './db'
import { charge, getBalance, hold, InsufficientCredit, readBalance, refund } from './credits'
import { IMEI_LENGTH, luhnValid, normalizeImei } from './imei'
import { activeSupplier, maintenanceState, type SupplierResult, type UnlockRequest } from './provider'
import { providerConfiguration, unlockProviderService } from './provider-api'
import { recordProviderEvent } from './provider-events'
import { claimProviderPoll } from './provider-poll-lease'
import { enqueueOrderNotification } from './order-notifications'
import { consumeAttempt } from './rate-limit'

/**
 * The order pipeline.
 *
 * Credit is held the moment an order goes out and only becomes a charge
 * once the supplier has actually delivered. A device the carrier refuses
 * releases the hold untouched — that is the money-back guarantee, enforced
 * by the ledger rather than by a promise on a page.
 */

const ORDER_RATE_LIMIT = 60
const ORDER_RATE_WINDOW_SECONDS = 60 * 60

export class OrderError extends Error {
  constructor(message: string, readonly code: string) {
    super(message)
    this.name = 'OrderError'
  }
}

export type OrderStatus = 'processing' | 'delivered' | 'unavailable'

export type Order = {
  id: number
  user_id: number
  kind: 'carrier_unlock' | 'device_service'
  brand_id: number | null
  carrier_id: number | null
  service_id: number | null
  imei: string
  delivery_email: string
  status: OrderStatus
  delivery: 'remote' | 'code'
  unlock_code: string | null
  result_json: string | null
  price_cents: number
  eta_hours: number
  source: string
  provider_order_id: string | null
  provider_ready_at: string | null
  provider_name: string | null
  provider_mode: string | null
  provider_service_id: string | null
  provider_last_polled_at: string | null
  provider_attempts: number
  provider_error_code: string | null
  idempotency_key: string | null
  error_message: string | null
  created_at: string
  updated_at: string
}

export type OrderView = Order & {
  brand_name: string | null
  carrier_name: string | null
  carrier_country: string | null
  service_name: string | null
  title: string
}

export type OrderPayload = {
  success: boolean
  orderId: number
  status: OrderStatus
  title: string
  imei: string
  priceCents: number
  etaHours: number
  delivery: 'remote' | 'code'
  unlockCode: string | null
  result: Record<string, unknown> | null
  message?: string
  credit: {
    beforeCents: number
    heldCents: number
    chargedCents: number
    refundedCents: number
    balanceCents: number
  }
}

export function validateImei(raw: string): string {
  const digits = normalizeImei(raw)
  if (digits.length === 0) throw new OrderError('Enter the device IMEI.', 'imei_missing')
  if (digits.length !== IMEI_LENGTH) {
    throw new OrderError(`An IMEI is ${IMEI_LENGTH} digits. Dial *#06# to read it.`, 'imei_length')
  }
  if (!luhnValid(digits)) {
    throw new OrderError('That IMEI checksum does not match. Re-read the last digit.', 'imei_checksum')
  }
  return digits
}

function validateEmail(raw: string): string {
  const email = raw.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new OrderError('Enter an email address for the result.', 'email_invalid')
  }
  return email
}

const VIEW_SELECT = `
  SELECT o.*,
         b.name AS brand_name,
         c.name AS carrier_name,
         c.country AS carrier_country,
         s.name AS service_name
    FROM orders o
    LEFT JOIN brands b ON b.id = o.brand_id
    LEFT JOIN carriers c ON c.id = o.carrier_id
    LEFT JOIN device_services s ON s.id = o.service_id
`

function decorate(row: Omit<OrderView, 'title'>): OrderView {
  const title =
    row.kind === 'carrier_unlock'
      ? `${row.brand_name ?? 'Device'} network unlock — ${row.carrier_name ?? 'carrier'}`
      : `${row.service_name ?? 'Device service'}${row.brand_name ? ` — ${row.brand_name}` : ''}`
  return { ...row, title }
}

export function getOrder(orderId: number, userId: number): OrderView | undefined {
  const row = db()
    .prepare(`${VIEW_SELECT} WHERE o.id = ? AND o.user_id = ?`)
    .get(orderId, userId) as Omit<OrderView, 'title'> | undefined
  return row ? decorate(row) : undefined
}

export function listOrders(userId: number, limit = 50, offset = 0): OrderView[] {
  const rows = db()
    .prepare(`${VIEW_SELECT} WHERE o.user_id = ? ORDER BY o.id DESC LIMIT ? OFFSET ?`)
    .all(userId, limit, offset) as Array<Omit<OrderView, 'title'>>
  return rows.map(decorate)
}

function payload(
  order: OrderView,
  credit: OrderPayload['credit'],
  message?: string,
): OrderPayload {
  return {
    /* The order was accepted and processed. A device the carrier refuses
       is an outcome, not a failed request — status carries that, and
       success stays reserved for requests that could not be placed at
       all (bad IMEI, no credit, maintenance). */
    success: true,
    orderId: order.id,
    status: order.status,
    title: order.title,
    imei: order.imei,
    priceCents: order.price_cents,
    etaHours: order.eta_hours,
    delivery: order.delivery,
    unlockCode: order.unlock_code,
    result: order.result_json ? (JSON.parse(order.result_json) as Record<string, unknown>) : null,
    message: message ?? order.error_message ?? undefined,
    credit,
  }
}

function requestFor(order: OrderView, brand: BrandRow): UnlockRequest {
  return {
    imei: order.imei,
    brand: brand.name,
    carrier: order.carrier_name ?? undefined,
    service: order.title,
    mappingKey:
      order.kind === 'carrier_unlock'
        ? `carrier:${order.carrier_id!}`
        : `service:${order.service_id!}`,
    delivery: order.delivery,
  }
}

function persistProviderOutcome(order: OrderView, result: SupplierResult, polled: boolean) {
  if (!result.provider) return
  db()
    .prepare(
      `UPDATE orders
          SET provider_name = ?, provider_mode = ?, provider_service_id = ?,
              provider_error_code = ?, provider_attempts = provider_attempts + 1,
              provider_last_polled_at = CASE WHEN ? = 1 THEN datetime('now') ELSE provider_last_polled_at END,
              updated_at = datetime('now')
        WHERE id = ? AND status = 'processing'`,
    )
    .run(
      result.provider.name,
      result.provider.mode,
      result.provider.serviceId,
      result.provider.errorCode ?? null,
      polled ? 1 : 0,
      order.id,
    )

  const eventType =
    result.status === 'delivered'
      ? 'completed'
      : result.status === 'accepted'
        ? 'processing'
        : result.status === 'uncertain'
          ? 'manual_review'
          : 'unavailable'
  recordProviderEvent({
    resourceType: 'order',
    resourceId: order.id,
    provider: result.provider.name,
    providerMode: result.provider.mode,
    eventType,
    idempotencyKey: `${polled ? 'poll' : 'submit'}:${result.orderId ?? order.id}:${eventType}`,
    durationMs: result.provider.durationMs,
    errorCode: result.provider.errorCode,
    metadata: { status: result.status, serviceId: result.provider.serviceId },
  })
}

function providerPollDebounced(order: OrderView) {
  if (!order.provider_last_polled_at) return false
  const timestamp = Date.parse(`${order.provider_last_polled_at}Z`)
  return Number.isFinite(timestamp) && Date.now() - timestamp < 5_000
}

export type SubmitInput = {
  kind: 'carrier_unlock' | 'device_service'
  brandId: number
  carrierId?: number
  serviceId?: number
  imei: string
  email: string
  /**
   * Optional client-supplied key. A retried submission — a double click, a
   * connection that dropped after the request left — resolves to the order
   * that was already placed instead of a second one with a second hold,
   * which would cost the customer twice and us two supplier requests.
   */
  idempotencyKey?: string
}

function cleanIdempotencyKey(value: string | undefined): string | undefined {
  const clean = value?.trim() ?? ''
  if (!clean) return undefined
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(clean)) {
    throw new OrderError('The request key is not valid.', 'idempotency_invalid')
  }
  return clean
}

function orderForKey(userId: number, idempotencyKey: string): OrderView | undefined {
  const row = db()
    .prepare(`${VIEW_SELECT} WHERE o.user_id = ? AND o.idempotency_key = ?`)
    .get(userId, idempotencyKey) as Omit<OrderView, 'title'> | undefined
  return row ? decorate(row) : undefined
}

function assertSameRequest(order: OrderView, input: SubmitInput, imei: string, email: string) {
  if (order.kind !== input.kind || order.brand_id !== input.brandId || order.imei !== imei
      || order.delivery_email !== email
      || (input.kind === 'carrier_unlock' ? order.carrier_id !== input.carrierId : order.service_id !== input.serviceId)) {
    throw new OrderError('That request key was already used for a different order.', 'idempotency_conflict')
  }
}

/** The payload for an order that is simply read back, moving no money. */
function restingPayload(order: OrderView, availableCents: number): OrderPayload {
  return payload(order, {
    beforeCents: availableCents,
    heldCents: order.status === 'processing' ? order.price_cents : 0,
    chargedCents: order.status === 'delivered' ? order.price_cents : 0,
    refundedCents: order.status === 'unavailable' ? order.price_cents : 0,
    balanceCents: availableCents,
  })
}

export async function submitOrder(
  userId: number,
  input: SubmitInput,
  source: 'website' | 'api' = 'website',
): Promise<OrderPayload> {
  const idempotencyKey = cleanIdempotencyKey(input.idempotencyKey)
  const imei = validateImei(input.imei)
  const email = validateEmail(input.email)
  if (idempotencyKey) {
    const existing = orderForKey(userId, idempotencyKey)
    if (existing) {
      assertSameRequest(existing, input, imei, email)
      return restingPayload(existing, readBalance(userId).availableCents)
    }
  }
  // A replay remains readable even when new placement has been paused.
  if (maintenanceState().active) throw new OrderError(maintenanceState().message, 'maintenance')

  /* Resolved before a row exists. activeSupplier() refuses to hand back the
     mock in production, and discovering that after the hold was taken would
     leave an order held against a supplier that was never going to run. */
  let supplier
  try {
    supplier = activeSupplier()
  } catch {
    throw new OrderError(
      'New orders are paused while the service is being configured. Nothing has been charged.',
      'supplier_unconfigured',
    )
  }

  /* Each accepted order costs a real supplier request, so the endpoint gets
     a ceiling of its own. It is set well above what a person ordering for
     themselves would reach; a reseller working through a batch will feel it
     before an abusive script gets anywhere expensive. A resend recognised
     by its key never reaches this. */
  if (!consumeAttempt('order-submit', String(userId), ORDER_RATE_LIMIT, ORDER_RATE_WINDOW_SECONDS)) {
    throw new OrderError('Too many orders in the last hour. Please try again shortly.', 'rate_limited')
  }

  const brand = getBrand(input.brandId)
  if (!brand) throw new OrderError('Pick the device brand.', 'brand_unknown')

  let priceCents: number
  let etaHours: number
  let carrierId: number | null = null
  let serviceId: number | null = null

  if (input.kind === 'carrier_unlock') {
    const carrier = input.carrierId ? getCarrier(input.carrierId) : undefined
    if (!carrier) throw new OrderError('Pick the network the device is locked to.', 'carrier_unknown')
    priceCents = carrier.price_cents
    etaHours = carrier.eta_hours
    carrierId = carrier.id
  } else {
    const service = input.serviceId ? getDeviceService(input.serviceId) : undefined
    if (!service) throw new OrderError('Pick a service.', 'service_unknown')
    if (!serviceCoversBrand(service, brand.id)) {
      throw new OrderError(`${service.name} is not offered for ${brand.name} devices.`, 'service_brand')
    }
    priceCents = service.price_cents
    etaHours = service.eta_hours
    serviceId = service.id
  }

  const before = getBalance(userId)

  /* The row and its hold go in together. Inserting first and deleting on a
     failed hold left an orphan behind whenever the process died in between;
     a rollback cannot. */
  let orderId: number
  let replayed = false
  try {
    orderId = db().transaction(() => {
      // BEGIN IMMEDIATE locks SQLite's writer before checking the key/balance.
      // A concurrent process therefore cannot reserve the same request twice.
      const existing = idempotencyKey ? orderForKey(userId, idempotencyKey) : undefined
      if (existing) {
        assertSameRequest(existing, input, imei, email)
        replayed = true
        return existing.id
      }
      const insert = db()
        .prepare(
          `INSERT INTO orders
             (user_id, kind, brand_id, carrier_id, service_id, imei, delivery_email,
              status, delivery, price_cents, eta_hours, source, idempotency_key)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?, ?)`,
        )
        .run(
          userId,
          input.kind,
          brand.id,
          carrierId,
          serviceId,
          imei,
          email,
          brand.delivery,
          priceCents,
          etaHours,
          source,
          idempotencyKey ?? null,
        )
      const id = Number(insert.lastInsertRowid)
      hold(userId, priceCents, 'order', String(id))
      return id
    }).immediate()
  } catch (error) {
    if (error instanceof InsufficientCredit) {
      throw new OrderError('Not enough credit for this order. Add funds and try again.', 'insufficient_credit')
    }
    throw error
  }

  let order = getOrder(orderId, userId)!
  if (replayed) return restingPayload(order, readBalance(userId).availableCents)
  const config = providerConfiguration()
  const mapping = unlockProviderService(requestFor(order, brand).mappingKey)
  if (config.enabled && mapping) {
    db()
      .prepare(
        `UPDATE orders
            SET provider_name = ?, provider_mode = ?, provider_service_id = ?, updated_at = datetime('now')
          WHERE id = ? AND status = 'processing'`,
      )
      .run(config.name, mapping.mode, mapping.id, orderId)
    order = getOrder(orderId, userId)!
  }
  let result
  try {
    result = await supplier.submit(requestFor(order, brand))
  } catch {
    result = { status: 'uncertain' as const, orderId: null, message: 'The supplier response is uncertain.' }
  }

  persistProviderOutcome(order, result, false)

  if (result.status === 'uncertain') {
    // Timeout is NOT a rejection: the provider may already have accepted it.
    // Never automatically resubmit or refund an order with an unknown outcome.
    db().prepare(`UPDATE orders SET provider_order_id = COALESCE(?, provider_order_id),
      provider_error_code = ?, error_message = ?, updated_at = datetime('now')
      WHERE id = ? AND status = 'processing'`).run(
      result.orderId, result.provider?.errorCode ?? 'submit_uncertain',
      'The provider response is uncertain. Credit remains reserved while this order is reviewed. Do not place it again.', orderId,
    )
    return restingPayload(getOrder(orderId, userId)!, readBalance(userId).availableCents)
  }

  if (result.status === 'unavailable') {
    return settleUnavailable(orderId, userId, result.message, before.availableCents)
  }

  if (result.status === 'delivered') {
    return settleDelivered(orderId, userId, result.orderId, result.unlockCode, result.result)
  }

  const readyAt = new Date(Date.now() + result.readyInMs).toISOString()
  db()
    .prepare(
      `UPDATE orders SET provider_order_id = ?, provider_ready_at = ?, updated_at = datetime('now')
        WHERE id = ? AND status = 'processing'`,
    )
    .run(result.orderId, readyAt, orderId)

  /* The hold above already asserted the invariant; this only reports what
     the customer now has. */
  const balance = readBalance(userId)
  return payload(getOrder(orderId, userId)!, {
    beforeCents: before.availableCents,
    heldCents: priceCents,
    chargedCents: 0,
    refundedCents: 0,
    balanceCents: balance.availableCents,
  })
}

/** Checks in with the supplier on an order that is still out. */
export async function pollOrder(userId: number, orderId: number): Promise<OrderPayload> {
  const snapshot = getOrder(orderId, userId)
  if (!snapshot) throw new OrderError('No such order.', 'order_unknown')
  const restingSnapshot = restingPayload(snapshot, readBalance(userId).availableCents)
  if (snapshot.status !== 'processing' || !snapshot.provider_order_id) return restingSnapshot
  const snapshotReadyAt = snapshot.provider_ready_at ? new Date(snapshot.provider_ready_at).getTime() : 0
  if (Date.now() < snapshotReadyAt || providerPollDebounced(snapshot)) return restingSnapshot

  const releasePoll = claimProviderPoll('order', snapshot.id)
  if (!releasePoll) return restingSnapshot

  try {
    // Another process may have polled or settled between the read and claim.
    const order = getOrder(orderId, userId)
    if (!order) throw new OrderError('No such order.', 'order_unknown')
    const balance = readBalance(userId)
    const resting = restingPayload(order, balance.availableCents)
    if (order.status !== 'processing' || !order.provider_order_id) return resting
    const readyAt = order.provider_ready_at ? new Date(order.provider_ready_at).getTime() : 0
    if (Date.now() < readyAt || providerPollDebounced(order)) return resting

    const brand = order.brand_id ? getBrand(order.brand_id) : undefined
    if (!brand) return resting
    const config = providerConfiguration()
    if (order.provider_name && (!config.enabled || config.name !== order.provider_name)) return resting
    let supplier
    try {
      supplier = activeSupplier()
    } catch {
      // Reading an order keeps working while its supplier is unconfigured.
      return resting
    }
    let result
    try {
      result = await supplier.poll(order.provider_order_id, requestFor(order, brand))
    } catch {
      if (order.provider_name) {
        db()
          .prepare(
            `UPDATE orders
                SET provider_attempts = provider_attempts + 1,
                    provider_last_polled_at = datetime('now'),
                    provider_error_code = 'poll_exception', updated_at = datetime('now')
              WHERE id = ? AND status = 'processing'`,
          )
          .run(order.id)
        recordProviderEvent({
          resourceType: 'order',
          resourceId: order.id,
          provider: order.provider_name,
          providerMode: order.provider_mode ?? 'unknown',
          eventType: 'poll_error',
          idempotencyKey: `poll-error:${order.provider_attempts + 1}`,
          errorCode: 'poll_exception',
        })
      }
      return restingPayload(getOrder(orderId, userId)!, readBalance(userId).availableCents)
    }

    persistProviderOutcome(order, result, true)

    if (result.status === 'delivered') {
      return settleDelivered(order.id, userId, result.orderId, result.unlockCode, result.result)
    }
    if (result.status === 'unavailable') {
      return settleUnavailable(order.id, userId, result.message, balance.availableCents)
    }
    if (result.status === 'accepted' && result.provider) {
      const readyAt = new Date(Date.now() + result.readyInMs).toISOString()
      db()
        .prepare(
          `UPDATE orders SET provider_ready_at = ?, updated_at = datetime('now')
            WHERE id = ? AND status = 'processing'`,
        )
        .run(readyAt, order.id)
    }
    return restingPayload(getOrder(order.id, userId)!, readBalance(userId).availableCents)
  } finally {
    releasePoll()
  }
}

/**
 * Claims the transition out of `processing` and moves the money in the same
 * transaction.
 *
 * Two polls of the same order run concurrently as a matter of course — the
 * console polls while the background sweep reads the same row — and both see
 * `processing` before either settles. Only the UPDATE that actually changes a
 * row may move credit; the loser reads the order back and reports it. Money
 * and status commit together, so a process that dies mid-settle leaves the
 * order exactly where it was rather than charged but unfinished.
 */
function settle(
  orderId: number,
  userId: number,
  next: 'delivered' | 'unavailable',
  apply: () => void,
): { claimed: boolean; priceCents: number } {
  return db().transaction(() => {
    const row = db()
      .prepare('SELECT price_cents, status FROM orders WHERE id = ? AND user_id = ?')
      .get(orderId, userId) as { price_cents: number; status: OrderStatus } | undefined
    if (!row) throw new OrderError('No such order.', 'order_unknown')
    if (row.status !== 'processing') return { claimed: false, priceCents: row.price_cents }

    apply()

    const moved = db()
      .prepare(`UPDATE orders SET status = ? WHERE id = ? AND status = 'processing'`)
      .run(next, orderId)
    if (moved.changes !== 1) throw new OrderError('The order was settled elsewhere.', 'order_conflict')

    if (next === 'delivered') {
      charge(userId, row.price_cents, 'order', String(orderId))
    } else {
      refund(userId, row.price_cents, 'order', String(orderId))
    }
    enqueueOrderNotification('order', orderId, userId, next === 'delivered' ? 'success' : 'rejected')
    return { claimed: true, priceCents: row.price_cents }
  }).immediate()
}

/** Authenticated webhook and poll/submit use the same terminal transition. */
export function settleOrderWebhook(
  orderId: number,
  providerOrderId: string,
  outcome: { status: 'success' | 'rejected'; result?: Record<string, unknown>; message?: string; unlockCode?: string },
): { status: string } {
  return db().transaction(() => {
    const row = db().prepare('SELECT user_id, provider_order_id FROM orders WHERE id = ?').get(orderId) as
      { user_id: number; provider_order_id: string | null } | undefined
    if (!row || row.provider_order_id !== providerOrderId) throw new OrderError('Order reference is not ready.', 'order_unknown')
    const order = getOrder(orderId, row.user_id)!
    if (order.status !== 'processing') return { status: order.status }
    if (outcome.status === 'success') {
      const code = outcome.unlockCode?.trim() || null
      return { status: settleDelivered(orderId, row.user_id, providerOrderId, code, outcome.result ?? {}).status }
    }
    return { status: settleUnavailable(orderId, row.user_id,
      'The provider rejected this order. Reserved credit was returned.', readBalance(row.user_id).availableCents).status }
  }).immediate()
}

function settleDelivered(
  orderId: number,
  userId: number,
  providerOrderId: string,
  unlockCode: string | null,
  result: Record<string, unknown>,
): OrderPayload {
  return db().transaction(() => {
    const current = getOrder(orderId, userId)
    if (!current) throw new OrderError('No such order.', 'order_unknown')
    const before = getBalance(userId)
    if (current.status !== 'processing') return restingPayload(current, before.availableCents)
    // Every channel (submit, poll, webhook) must supply a usable code for a
    // code-based service. A success label alone is not a delivered product.
    if (current.delivery === 'code' && !unlockCode?.trim()) {
      db().prepare(`UPDATE orders SET provider_order_id = COALESCE(?, provider_order_id),
        provider_error_code = 'result_incomplete', error_message = 'The provider result needs review before delivery.',
        updated_at = datetime('now') WHERE id = ? AND status = 'processing'`).run(providerOrderId, orderId)
      return restingPayload(getOrder(orderId, userId)!, before.availableCents)
    }
    const { claimed, priceCents } = settle(orderId, userId, 'delivered', () => {
      db().prepare(`UPDATE orders SET unlock_code = ?, result_json = ?, provider_order_id = ?,
        provider_ready_at = NULL, provider_error_code = NULL, error_message = NULL, updated_at = datetime('now')
        WHERE id = ? AND status = 'processing'`).run(unlockCode, JSON.stringify(result), providerOrderId, orderId)
    })
    const after = readBalance(userId)
    const order = getOrder(orderId, userId)!
    if (!claimed) return restingPayload(order, after.availableCents)
    return payload(order, {
      beforeCents: before.availableCents, heldCents: 0, chargedCents: priceCents,
      refundedCents: 0, balanceCents: after.availableCents,
    })
  }).immediate()
}

function settleUnavailable(
  orderId: number,
  userId: number,
  message: string,
  beforeCents: number,
): OrderPayload {
  const { claimed, priceCents } = settle(orderId, userId, 'unavailable', () => {
    db()
      .prepare(
        `UPDATE orders
            SET error_message = ?, provider_ready_at = NULL, updated_at = datetime('now')
          WHERE id = ? AND status = 'processing'`,
      )
      .run(message, orderId)
  })

  const after = readBalance(userId)
  const order = getOrder(orderId, userId)!
  if (!claimed) return restingPayload(order, after.availableCents)

  return payload(
    order,
    {
      beforeCents,
      heldCents: 0,
      chargedCents: 0,
      refundedCents: priceCents,
      balanceCents: after.availableCents,
    },
    message,
  )
}

export function countOrders(userId: number): number {
  const row = db()
    .prepare('SELECT COUNT(*) AS count FROM orders WHERE user_id = ?')
    .get(userId) as { count: number }
  return row.count
}

export function orderStats(userId: number) {
  const row = db()
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
              SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) AS processing,
              SUM(CASE WHEN date(created_at) = date('now') THEN 1 ELSE 0 END) AS today
         FROM orders WHERE user_id = ?`,
    )
    .get(userId) as {
    total: number
    delivered: number | null
    processing: number | null
    today: number | null
  }
  return {
    total: row.total,
    delivered: row.delivered ?? 0,
    processing: row.processing ?? 0,
    today: row.today ?? 0,
  }
}
