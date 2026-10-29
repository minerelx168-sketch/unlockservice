import { db } from './db'

export type AccountRole = 'RETAIL' | 'RESELLER' | 'ADMIN'
export function accountRole(accountType: string): AccountRole {
  return accountType === 'admin' ? 'ADMIN' : accountType === 'reseller' ? 'RESELLER' : 'RETAIL'
}
export function resellerPriceCents(retailCents: number, costMicros: number): number | null {
  if (!Number.isSafeInteger(retailCents) || retailCents <= 0 || !Number.isSafeInteger(costMicros)
    || costMicros < 0 || !Number.isSafeInteger(retailCents * 10000 + costMicros)
    || costMicros > retailCents * 10000) return null
  // Half of the retail gross profit, rounded UP to the next USD cent.
  return Math.ceil((retailCents * 10000 + costMicros) / 20000)
}
export function isReseller(userId: number): boolean {
  return Boolean(db().prepare("SELECT 1 FROM users WHERE id=? AND account_type='reseller'").get(userId))
}
export function accountPriceCents(userId: number, retailCents: number, costMicros: number): number | null {
  return isReseller(userId) ? resellerPriceCents(retailCents, costMicros) : retailCents
}

/** Called inside a verified settlement transaction, never from a browser claim. */
export function upgradeResellerAfterTopup(userId: number, depositCents: number, invoice: string) {
  if (!Number.isSafeInteger(depositCents) || depositCents < 10000) return false
  // A guest purchase, adjustment or a collection of smaller deposits never qualifies.
  const paid = db().prepare(`SELECT 1 FROM credit_ledger l JOIN invoices i ON i.reference=l.ref_id
    WHERE l.user_id=? AND i.user_id=l.user_id AND l.ref_type='invoice' AND l.ref_id=?
      AND l.type='topup' AND l.amount_cents=? AND i.currency='USD'
      AND NOT EXISTS(SELECT 1 FROM guest_checkouts g WHERE g.crypto_invoice_reference=i.reference)`).get(userId, invoice, depositCents)
  if (!paid) return false
  return db().prepare(`UPDATE users SET account_type='reseller',reseller_since=datetime('now'),reseller_invoice=?
    WHERE id=? AND account_type='customer'`).run(invoice, userId).changes === 1
}
