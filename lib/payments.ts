import { randomBytes } from 'node:crypto'
import { credit } from './credits'
import { db } from './db'

/**
 * An invoice locks its numbers at creation. A customer may submit a payment
 * reference, but credit lands only after trusted confirmation. Provider and
 * idempotency metadata are implementation details on the invoice row.
 */

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

type InvoiceRow = Invoice & {
  provider: string | null
  provider_charge_id: string | null
  idempotency_key: string | null
  paid_at: string | null
  credited_at: string | null
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
        id: 'crypto_networks',
        label: 'Crypto networks',
        asset: 'USDT',
        network: 'BEP-20',
        feeBasisPoints: Number(process.env.IUNLOCKMOBILE_USDT_FEE_BPS ?? '0'),
        address: process.env.IUNLOCKMOBILE_USDT_BEP20_ADDRESS,
      },
    ]
  : []

export type GatewayId = string

export class PaymentError extends Error {}

export const MIN_TOPUP_CENTS = 500
export const MAX_TOPUP_CENTS = 1_000_000

const INVOICE_COLUMNS = `
  reference, user_id, gateway, credit_amount_cents, fee_cents, tax_cents,
  total_due_cents, currency, status, payment_reference, note, created_at, updated_at
`

function invoiceRow(reference: string, userId?: number): InvoiceRow | undefined {
  const where = userId === undefined ? 'reference = ?' : 'reference = ? AND user_id = ?'
  return db()
    .prepare(`SELECT *, COALESCE(provider, gateway) AS provider FROM invoices WHERE ${where}`)
    .get(...(userId === undefined ? [reference] : [reference, userId])) as InvoiceRow | undefined
}

export function createInvoice(userId: number, gatewayId: string, creditCents: number): Invoice {
  const gateway = GATEWAYS.find((entry) => entry.id === gatewayId)
  if (!gateway) throw new PaymentError('No payment method is configured. Contact support before sending funds.')
  if (!Number.isSafeInteger(creditCents) || creditCents < MIN_TOPUP_CENTS || creditCents > MAX_TOPUP_CENTS) {
    throw new PaymentError(
      `Top-up must be between $${(MIN_TOPUP_CENTS / 100).toFixed(2)} and $${(MAX_TOPUP_CENTS / 100).toFixed(2)}.`,
    )
  }

  const open = db()
    .prepare(
      `SELECT ${INVOICE_COLUMNS} FROM invoices
        WHERE user_id = ? AND gateway = ? AND credit_amount_cents = ?
          AND status = 'pending' AND payment_reference IS NULL
        ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    )
    .get(userId, gatewayId, creditCents) as Invoice | undefined
  if (open) return open

  const fee = Math.round((creditCents * gateway.feeBasisPoints) / 10_000)
  const reference = randomBytes(16).toString('hex')
  db()
    .prepare(
      `INSERT INTO invoices
         (reference, user_id, gateway, credit_amount_cents, fee_cents, tax_cents,
          total_due_cents, provider, idempotency_key)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?)`,
    )
    .run(
      reference,
      userId,
      gatewayId,
      creditCents,
      fee,
      creditCents + fee,
      gatewayId,
      `${userId}-${gatewayId}-${creditCents}-${randomBytes(16).toString('hex')}`,
    )
  return getInvoice(reference, userId)!
}

export function getInvoice(reference: string, userId: number): Invoice | undefined {
  return db()
    .prepare(`SELECT ${INVOICE_COLUMNS} FROM invoices WHERE reference = ? AND user_id = ?`)
    .get(reference, userId) as Invoice | undefined
}

export function listInvoices(userId: number, limit = 50): Invoice[] {
  return db()
    .prepare(
      `SELECT ${INVOICE_COLUMNS} FROM invoices
        WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    )
    .all(userId, limit) as Invoice[]
}

/** The customer submits evidence; this never changes their balance. */
export function submitPaymentReference(
  reference: string,
  userId: number,
  paymentReference: string,
  note: string,
): Invoice {
  const invoice = invoiceRow(reference, userId)
  if (!invoice) throw new PaymentError('No such invoice.')
  if (!GATEWAYS.some((gateway) => gateway.id === invoice.gateway)) {
    throw new PaymentError('This payment method is not configured. Do not send funds.')
  }
  if (invoice.status === 'success') throw new PaymentError('This invoice is already settled.')
  if (!['pending', 'review'].includes(invoice.status)) throw new PaymentError(`This invoice is ${invoice.status}.`)

  const cleanReference = paymentReference.trim()
  if (!/^[A-Za-z0-9:_-]{6,255}$/.test(cleanReference)) {
    throw new PaymentError('Enter a valid transaction reference.')
  }

  db()
    .prepare(
      `UPDATE invoices
          SET payment_reference = ?, note = ?, status = 'review', updated_at = datetime('now')
        WHERE reference = ? AND user_id = ? AND status IN ('pending', 'review')`,
    )
    .run(cleanReference, note.trim().slice(0, 500) || null, reference, userId)
  return getInvoice(reference, userId)!
}

export function selfApprovalEnabled(): boolean {
  return process.env.IUNLOCKMOBILE_ALLOW_SELF_APPROVE === '1' || process.env.NODE_ENV !== 'production'
}

/** Trusted confirmation. Duplicate confirmation is a no-op. */
export function approveInvoice(reference: string, userId: number, providerChargeId?: string): Invoice {
  return db().transaction(() => {
    const invoice = invoiceRow(reference, userId)
    if (!invoice) throw new PaymentError('No such invoice.')
    if (invoice.status === 'success') return getInvoice(reference, userId)!
    if (!['pending', 'review'].includes(invoice.status)) {
      throw new PaymentError(`Invoice cannot be confirmed while ${invoice.status}.`)
    }

    credit(userId, invoice.credit_amount_cents, 'topup', 'invoice', reference)
    const timestamp = new Date().toISOString()
    db()
      .prepare(
        `UPDATE invoices
            SET status = 'success',
                provider_charge_id = COALESCE(provider_charge_id, ?),
                paid_at = COALESCE(paid_at, ?),
                credited_at = COALESCE(credited_at, ?),
                updated_at = ?
          WHERE reference = ? AND user_id = ?`,
      )
      .run(providerChargeId ?? null, timestamp, timestamp, timestamp, reference, userId)
    return getInvoice(reference, userId)!
  })()
}

export function invoiceSummary(userId: number) {
  const rows = db()
    .prepare('SELECT status, COUNT(*) AS count FROM invoices WHERE user_id = ? GROUP BY status')
    .all(userId) as Array<{ status: Invoice['status']; count: number }>
  const by = new Map(rows.map((row) => [row.status, row.count]))
  return {
    successful: by.get('success') ?? 0,
    pendingReview: (by.get('pending') ?? 0) + (by.get('review') ?? 0),
    failed: by.get('failed') ?? 0,
    refunded: by.get('refunded') ?? 0,
    all: rows.reduce((sum, row) => sum + row.count, 0),
  }
}

export function shortReference(reference: string): string {
  return `#${reference.slice(0, 10).toUpperCase()}`
}
