import { randomBytes } from 'node:crypto'
import { credit } from './credits'
import { db } from './db'

/**
 * Top-ups follow the observed model: an invoice locks its numbers the
 * moment it is created, the customer pays out of band, then submits the
 * transaction reference for a human to verify. Credit only lands once the
 * payment is confirmed — never on submission.
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

export const GATEWAYS = [
  {
    id: 'crypto_networks',
    label: 'Crypto networks',
    asset: 'USDT',
    network: 'BEP-20',
    /* Placeholder rate. Replace with the real schedule from your processor
       before taking money — it is locked into the invoice at creation. */
    feeBasisPoints: 200,
    address: '0x0000000000000000000000000000000000000000',
  },
] as const

export type GatewayId = (typeof GATEWAYS)[number]['id']

export class PaymentError extends Error {}

export const MIN_TOPUP_CENTS = 500

export function createInvoice(userId: number, gatewayId: string, creditCents: number): Invoice {
  const gateway = GATEWAYS.find((entry) => entry.id === gatewayId)
  if (!gateway) throw new PaymentError('Pick a payment method.')
  if (creditCents < MIN_TOPUP_CENTS) {
    throw new PaymentError(`The smallest top-up is $${(MIN_TOPUP_CENTS / 100).toFixed(2)}.`)
  }

  /* Reuse an untouched pending invoice for the same amount instead of
     stacking duplicates — the observed system let them pile up. */
  const open = db()
    .prepare(
      `SELECT * FROM invoices
        WHERE user_id = ? AND gateway = ? AND credit_amount_cents = ?
          AND status = 'pending' AND payment_reference IS NULL`,
    )
    .get(userId, gatewayId, creditCents) as Invoice | undefined
  if (open) return open

  const fee = Math.round((creditCents * gateway.feeBasisPoints) / 10_000)
  const reference = randomBytes(16).toString('hex')

  db()
    .prepare(
      `INSERT INTO invoices
         (reference, user_id, gateway, credit_amount_cents, fee_cents, tax_cents, total_due_cents)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
    )
    .run(reference, userId, gatewayId, creditCents, fee, creditCents + fee)

  return getInvoice(reference, userId)!
}

export function getInvoice(reference: string, userId: number): Invoice | undefined {
  return db()
    .prepare('SELECT * FROM invoices WHERE reference = ? AND user_id = ?')
    .get(reference, userId) as Invoice | undefined
}

export function listInvoices(userId: number, limit = 50): Invoice[] {
  return db()
    .prepare('SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?')
    .all(userId, limit) as Invoice[]
}

/** The customer says "I paid, here is the transaction" — nothing is credited yet. */
export function submitPaymentReference(
  reference: string,
  userId: number,
  paymentReference: string,
  note: string,
): Invoice {
  const invoice = getInvoice(reference, userId)
  if (!invoice) throw new PaymentError('No such invoice.')
  if (invoice.status === 'success') throw new PaymentError('This invoice is already settled.')
  if (!paymentReference.trim()) throw new PaymentError('Enter the transaction reference.')

  db()
    .prepare(
      `UPDATE invoices SET payment_reference = ?, note = ?, status = 'review',
              updated_at = datetime('now')
        WHERE reference = ?`,
    )
    .run(paymentReference.trim(), note.trim() || null, reference)
  return getInvoice(reference, userId)!
}

/**
 * Confirmation. In production this is an admin action or a processor
 * webhook; the flag below is what lets the flow be exercised end to end
 * without one.
 */
export function selfApprovalEnabled(): boolean {
  return process.env.IUNLOCKMOBILE_ALLOW_SELF_APPROVE === '1' || process.env.NODE_ENV !== 'production'
}

export function approveInvoice(reference: string, userId: number): Invoice {
  const invoice = getInvoice(reference, userId)
  if (!invoice) throw new PaymentError('No such invoice.')
  if (invoice.status === 'success') return invoice

  db()
    .prepare("UPDATE invoices SET status = 'success', updated_at = datetime('now') WHERE reference = ?")
    .run(reference)
  credit(userId, invoice.credit_amount_cents, 'topup', 'invoice', reference)
  return getInvoice(reference, userId)!
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

/** Display form of the reference, as the observed invoices show it. */
export function shortReference(reference: string): string {
  return `#${reference.slice(0, 10).toUpperCase()}`
}
