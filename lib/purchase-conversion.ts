import { db } from './db'

export type PurchaseConversion = {
  transactionId: string
  value: number
  currency: 'USD'
  newCustomer: boolean
}

type PurchaseKind = 'order' | 'paid_imei_report'

// Do not backfill old purchases when customers revisit their history after release.
// SQLite credit_ledger.created_at uses UTC datetime('now').
const TRACKING_STARTED_AT = Date.parse('2026-10-07T07:00:00Z')

/** Read-only: a completed order alone is not evidence of payment; the charge ledger is. */
export function purchaseConversion(
  userId: number,
  kind: PurchaseKind,
  orderId: number,
  priceCents: number,
): PurchaseConversion | null {
  if (!Number.isSafeInteger(userId) || userId < 1
      || !Number.isSafeInteger(orderId) || orderId < 1
      || !Number.isSafeInteger(priceCents) || priceCents < 1) return null

  const charge = db().prepare(
    `SELECT id, created_at FROM credit_ledger
      WHERE user_id = ? AND type = 'charge' AND ref_type = ? AND ref_id = ?
        AND amount_cents = ?
      ORDER BY id ASC LIMIT 1`,
  ).get(userId, kind, String(orderId), -priceCents) as { id: number; created_at: string } | undefined
  if (!charge) return null
  const chargedAt = Date.parse(`${charge.created_at.replace(' ', 'T')}Z`)
  if (!Number.isFinite(chargedAt) || chargedAt < TRACKING_STARTED_AT || chargedAt > Date.now() + 60_000) return null

  const earlierPurchase = db().prepare(
    `SELECT 1 FROM credit_ledger
      WHERE user_id = ? AND type = 'charge' AND ref_type IN ('order', 'paid_imei_report')
        AND id < ? LIMIT 1`,
  ).get(userId, charge.id)
  return {
    transactionId: `${kind === 'order' ? 'unlock' : 'report'}-${orderId}`,
    value: priceCents / 100,
    currency: 'USD',
    newCustomer: !earlierPurchase,
  }
}
