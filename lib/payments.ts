import { randomBytes } from 'node:crypto'
import { creditOnce } from './credits'
import { db } from './db'

/**
 * Provider-neutral top-up orders adapted from imeihub's production flow.
 * Creating or submitting an order never credits a wallet. Only settlement,
 * called after trusted payment confirmation, may append the TOPUP ledger row.
 */

export type TopUpStatus = 'pending' | 'review' | 'paid' | 'credited' | 'failed' | 'expired' | 'refunded'

export type Invoice = {
  reference: string
  user_id: number
  gateway: string
  credit_amount_cents: number
  fee_cents: number
  tax_cents: number
  total_due_cents: number
  currency: string
  status: 'pending' | 'review' | 'success' | 'failed' | 'refunded'
  payment_reference: string | null
  note: string | null
  created_at: string
  updated_at: string
}

type TopUpOrderRow = {
  id: number
  public_id: string
  user_id: number
  credit_amount_cents: number
  fee_cents: number
  tax_cents: number
  total_due_cents: number
  currency: string
  status: TopUpStatus
  provider: string
  provider_charge_id: string | null
  provider_payment_intent: string | null
  idempotency_key: string
  payment_reference: string | null
  note: string | null
  paid_at: string | null
  credited_at: string | null
  created_at: string
  updated_at: string
}

export type Gateway = {
  id: string
  label: string
  asset: string
  network: string
  feeBasisPoints: number
  address: string
}

export const GATEWAYS: Gateway[] = process.env.IUNLOCKMOBILE_USDT_BEP20_ADDRESS
  ? [
      {
        id: 'manual-usdt-bep20',
        label: 'USDT transfer',
        asset: 'USDT',
        network: 'BEP-20',
        feeBasisPoints: Number(process.env.IUNLOCKMOBILE_USDT_FEE_BPS ?? '0'),
        address: process.env.IUNLOCKMOBILE_USDT_BEP20_ADDRESS,
      },
    ]
  : []

export type GatewayId = string

export class PaymentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PaymentError'
  }
}

export const MIN_TOPUP_CENTS = 500
export const MAX_TOPUP_CENTS = 1_000_000

function nowIso(): string {
  return new Date().toISOString()
}

function publicId(): string {
  return `${Date.now().toString(36)}${randomBytes(10).toString('hex')}`.slice(0, 26).toUpperCase()
}

function idempotencyKey(userId: number, provider: string, amountCents: number): string {
  return `${userId}-${provider}-${amountCents}-${randomBytes(16).toString('hex')}`
}

function toInvoice(row: TopUpOrderRow): Invoice {
  return {
    reference: row.public_id,
    user_id: row.user_id,
    gateway: row.provider,
    credit_amount_cents: row.credit_amount_cents,
    fee_cents: row.fee_cents,
    tax_cents: row.tax_cents,
    total_due_cents: row.total_due_cents,
    currency: row.currency,
    status:
      row.status === 'credited'
        ? 'success'
        : row.status === 'expired'
          ? 'failed'
          : row.status === 'paid'
            ? 'review'
            : row.status,
    payment_reference: row.payment_reference,
    note: row.note,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

function getOrder(publicReference: string, userId?: number): TopUpOrderRow | undefined {
  const sql = userId === undefined
    ? 'SELECT * FROM topup_orders WHERE public_id = ?'
    : 'SELECT * FROM topup_orders WHERE public_id = ? AND user_id = ?'
  return db().prepare(sql).get(...(userId === undefined ? [publicReference] : [publicReference, userId])) as
    | TopUpOrderRow
    | undefined
}

export function createInvoice(userId: number, gatewayId: string, creditCents: number): Invoice {
  const gateway = GATEWAYS.find((entry) => entry.id === gatewayId)
  if (!gateway) {
    throw new PaymentError('No payment method is configured. Contact support before sending funds.')
  }
  if (!Number.isSafeInteger(creditCents) || creditCents < MIN_TOPUP_CENTS || creditCents > MAX_TOPUP_CENTS) {
    throw new PaymentError(
      `Top-up must be between $${(MIN_TOPUP_CENTS / 100).toFixed(2)} and $${(MAX_TOPUP_CENTS / 100).toFixed(2)}.`,
    )
  }

  const open = db()
    .prepare(
      `SELECT * FROM topup_orders
        WHERE user_id = ? AND provider = ? AND credit_amount_cents = ?
          AND status = 'pending' AND payment_reference IS NULL
        ORDER BY id DESC LIMIT 1`,
    )
    .get(userId, gatewayId, creditCents) as TopUpOrderRow | undefined
  if (open) return toInvoice(open)

  const fee = Math.round((creditCents * gateway.feeBasisPoints) / 10_000)
  const reference = publicId()
  db()
    .prepare(
      `INSERT INTO topup_orders
         (public_id, user_id, credit_amount_cents, fee_cents, tax_cents,
          total_due_cents, currency, status, provider, idempotency_key)
       VALUES (?, ?, ?, ?, 0, ?, 'USD', 'pending', ?, ?)`,
    )
    .run(
      reference,
      userId,
      creditCents,
      fee,
      creditCents + fee,
      gatewayId,
      idempotencyKey(userId, gatewayId, creditCents),
    )

  return getInvoice(reference, userId)!
}

export function getInvoice(reference: string, userId: number): Invoice | undefined {
  const row = getOrder(reference, userId)
  return row ? toInvoice(row) : undefined
}

export function listInvoices(userId: number, limit = 50): Invoice[] {
  return (
    db()
      .prepare('SELECT * FROM topup_orders WHERE user_id = ? ORDER BY id DESC LIMIT ?')
      .all(userId, limit) as TopUpOrderRow[]
  ).map(toInvoice)
}

/** The customer submits evidence; this does not change their balance. */
export function submitPaymentReference(
  reference: string,
  userId: number,
  paymentReference: string,
  note: string,
): Invoice {
  const order = getOrder(reference, userId)
  if (!order) throw new PaymentError('No such top-up order.')
  if (!GATEWAYS.some((gateway) => gateway.id === order.provider)) {
    throw new PaymentError('This payment method is not configured. Do not send funds.')
  }
  if (order.status === 'credited') throw new PaymentError('This top-up is already settled.')
  if (!['pending', 'review'].includes(order.status)) throw new PaymentError(`This top-up is ${order.status}.`)

  const cleanReference = paymentReference.trim()
  if (!/^[A-Za-z0-9:_-]{6,255}$/.test(cleanReference)) {
    throw new PaymentError('Enter a valid transaction reference.')
  }

  db()
    .prepare(
      `UPDATE topup_orders
          SET payment_reference = ?, note = ?, status = 'review', updated_at = ?
        WHERE public_id = ? AND user_id = ? AND status IN ('pending', 'review')`,
    )
    .run(cleanReference, note.trim().slice(0, 500) || null, nowIso(), reference, userId)
  return getInvoice(reference, userId)!
}

export function selfApprovalEnabled(): boolean {
  return process.env.IUNLOCKMOBILE_ALLOW_SELF_APPROVE === '1' && process.env.NODE_ENV !== 'production'
}

/**
 * Trusted settlement boundary. It is replay-safe: a duplicate callback or
 * repeated administrator action returns without appending a second ledger row.
 */
export function settleTopUp(reference: string, providerChargeId?: string): { invoice: Invoice; creditedNow: boolean } {
  return db().transaction(() => {
    const order = getOrder(reference)
    if (!order) throw new PaymentError('No such top-up order.')
    if (order.status === 'credited') return { invoice: toInvoice(order), creditedNow: false }
    if (!['pending', 'review', 'paid'].includes(order.status)) {
      throw new PaymentError(`Top-up cannot be settled while ${order.status}.`)
    }

    const result = creditOnce(
      order.user_id,
      order.credit_amount_cents,
      'topup',
      'topup_order',
      order.public_id,
      `Top-up via ${order.provider}`,
    )

    const timestamp = nowIso()
    db()
      .prepare(
        `UPDATE topup_orders
            SET status = 'credited',
                provider_charge_id = COALESCE(provider_charge_id, ?),
                paid_at = COALESCE(paid_at, ?),
                credited_at = COALESCE(credited_at, ?),
                updated_at = ?
          WHERE id = ?`,
      )
      .run(providerChargeId ?? null, timestamp, timestamp, timestamp, order.id)

    return { invoice: toInvoice(getOrder(reference)!), creditedNow: result.creditedNow }
  })()
}

export function approveInvoice(reference: string, userId: number): Invoice {
  const order = getOrder(reference, userId)
  if (!order) throw new PaymentError('No such top-up order.')
  return settleTopUp(reference, `local-${reference}`).invoice
}

export function recordWebhookEvent(input: {
  provider: string
  eventId: string
  eventType?: string
  signatureOk: boolean
  rawBody: string
}): { id: number; duplicate: boolean } {
  const existing = db()
    .prepare('SELECT id FROM webhook_events WHERE provider = ? AND event_id = ?')
    .get(input.provider, input.eventId) as { id: number } | undefined
  if (existing) return { id: existing.id, duplicate: true }

  const info = db()
    .prepare(
      `INSERT INTO webhook_events
         (provider, event_id, event_type, signature_ok, raw_body)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      input.provider,
      input.eventId,
      input.eventType ?? null,
      input.signatureOk ? 1 : 0,
      input.rawBody,
    )
  return { id: Number(info.lastInsertRowid), duplicate: false }
}

export function markWebhookProcessed(id: number, error?: string) {
  db()
    .prepare(
      `UPDATE webhook_events
          SET processed = ?, processing_error = ?, processed_at = ?
        WHERE id = ?`,
    )
    .run(error ? 0 : 1, error?.slice(0, 500) ?? null, nowIso(), id)
}

export function invoiceSummary(userId: number) {
  const rows = db()
    .prepare('SELECT status, COUNT(*) AS count FROM topup_orders WHERE user_id = ? GROUP BY status')
    .all(userId) as Array<{ status: TopUpStatus; count: number }>
  const by = new Map(rows.map((row) => [row.status, row.count]))
  return {
    successful: by.get('credited') ?? 0,
    pendingReview: (by.get('pending') ?? 0) + (by.get('review') ?? 0) + (by.get('paid') ?? 0),
    failed: (by.get('failed') ?? 0) + (by.get('expired') ?? 0),
    refunded: by.get('refunded') ?? 0,
    all: rows.reduce((sum, row) => sum + row.count, 0),
  }
}

export function shortReference(reference: string): string {
  return `#${reference.slice(0, 10).toUpperCase()}`
}
