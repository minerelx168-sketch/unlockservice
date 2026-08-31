import {
  db,
  getBrand,
  getCarrier,
  getDeviceService,
  serviceCoversBrand,
  type BrandRow,
} from './db'
import { charge, getBalance, hold, InsufficientCredit, refund } from './credits'
import { IMEI_LENGTH, luhnValid, normalizeImei } from './imei'
import { activeSupplier, maintenanceState, type SupplierResult, type UnlockRequest } from './provider'
import { providerConfiguration, unlockProviderService } from './provider-api'
import { recordProviderEvent } from './provider-events'

/**
 * The order pipeline.
 *
 * Credit is held the moment an order goes out and only becomes a charge
 * once the supplier has actually delivered. A device the carrier refuses
 * releases the hold untouched — that is the money-back guarantee, enforced
 * by the ledger rather than by a promise on a page.
 */

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
}

export async function submitOrder(
  userId: number,
  input: SubmitInput,
  source: 'website' | 'api' = 'website',
): Promise<OrderPayload> {
  if (maintenanceState().active) throw new OrderError(maintenanceState().message, 'maintenance')

  const brand = getBrand(input.brandId)
  if (!brand) throw new OrderError('Pick the device brand.', 'brand_unknown')

  const imei = validateImei(input.imei)
  const email = validateEmail(input.email)

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

  const insert = db()
    .prepare(
      `INSERT INTO orders
         (user_id, kind, brand_id, carrier_id, service_id, imei, delivery_email,
          status, delivery, price_cents, eta_hours, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'processing', ?, ?, ?, ?)`,
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
    )
  const orderId = Number(insert.lastInsertRowid)

  try {
    hold(userId, priceCents, 'order', String(orderId))
  } catch (error) {
    db().prepare('DELETE FROM orders WHERE id = ?').run(orderId)
    if (error instanceof InsufficientCredit) {
      throw new OrderError('Not enough credit for this order. Add funds and try again.', 'insufficient_credit')
    }
    throw error
  }

  let order = getOrder(orderId, userId)!
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
  const supplier = activeSupplier()
  let result
  try {
    result = await supplier.submit(requestFor(order, brand))
  } catch {
    result = { status: 'unavailable' as const, orderId: null, message: 'The supplier could not be reached.' }
  }

  persistProviderOutcome(order, result, false)

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
        WHERE id = ?`,
    )
    .run(result.orderId, readyAt, orderId)

  const balance = getBalance(userId)
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
  const order = getOrder(orderId, userId)
  if (!order) throw new OrderError('No such order.', 'order_unknown')

  const balance = getBalance(userId)
  const resting = {
    beforeCents: balance.availableCents,
    heldCents: order.status === 'processing' ? order.price_cents : 0,
    chargedCents: order.status === 'delivered' ? order.price_cents : 0,
    refundedCents: 0,
    balanceCents: balance.availableCents,
  }

  if (order.status !== 'processing') return payload(order, resting)

  const readyAt = order.provider_ready_at ? new Date(order.provider_ready_at).getTime() : 0
  if (Date.now() < readyAt || providerPollDebounced(order)) return payload(order, resting)

  const brand = order.brand_id ? getBrand(order.brand_id) : undefined
  if (!brand) return payload(order, resting)

  const supplier = activeSupplier()
  let result
  try {
    result = await supplier.poll(order.provider_order_id ?? '', requestFor(order, brand))
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
    return payload(order, resting)
  }

  persistProviderOutcome(order, result, true)

  if (result.status === 'delivered') {
    return settleDelivered(order.id, userId, result.orderId, result.unlockCode, result.result)
  }
  if (result.status === 'unavailable') {
    return settleUnavailable(order.id, userId, result.message, balance.availableCents)
  }
  if (result.provider) {
    const readyAt = new Date(Date.now() + result.readyInMs).toISOString()
    db()
      .prepare(
        `UPDATE orders SET provider_ready_at = ?, updated_at = datetime('now')
          WHERE id = ? AND status = 'processing'`,
      )
      .run(readyAt, order.id)
  }
  return payload(getOrder(order.id, userId)!, resting)
}

function settleDelivered(
  orderId: number,
  userId: number,
  providerOrderId: string,
  unlockCode: string | null,
  result: Record<string, unknown>,
): OrderPayload {
  const before = getBalance(userId)
  const priceCents = (
    db().prepare('SELECT price_cents FROM orders WHERE id = ?').get(orderId) as { price_cents: number }
  ).price_cents
  const after = charge(userId, priceCents, 'order', String(orderId))

  db()
    .prepare(
      `UPDATE orders
          SET status = 'delivered', unlock_code = ?, result_json = ?, provider_order_id = ?,
              provider_ready_at = NULL, updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(unlockCode, JSON.stringify(result), providerOrderId, orderId)

  return payload(getOrder(orderId, userId)!, {
    beforeCents: before.availableCents,
    heldCents: 0,
    chargedCents: priceCents,
    refundedCents: 0,
    balanceCents: after.availableCents,
  })
}

function settleUnavailable(
  orderId: number,
  userId: number,
  message: string,
  beforeCents: number,
): OrderPayload {
  const priceCents = (
    db().prepare('SELECT price_cents FROM orders WHERE id = ?').get(orderId) as { price_cents: number }
  ).price_cents
  const after = refund(userId, priceCents, 'order', String(orderId))

  db()
    .prepare(
      `UPDATE orders
          SET status = 'unavailable', error_message = ?, provider_ready_at = NULL,
              updated_at = datetime('now')
        WHERE id = ?`,
    )
    .run(message, orderId)

  return payload(
    getOrder(orderId, userId)!,
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
