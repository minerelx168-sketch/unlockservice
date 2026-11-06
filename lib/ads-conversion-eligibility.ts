import { db } from './db'
import { validateClickId } from './attribution'
import { fundedByTestCredit, isInternalEmail } from './ga4'

export type AdsPurchase = {
  transaction_id: string; kind: string; context_reference: string; state: string;
  click_id_type: 'gclid' | 'wbraid' | 'gbraid'; click_id: string;
  conversion_time: string; revenue_cents: number; currency: string;
}
export const timestamp = (value: string) => Date.parse(value.includes('T') ? value : value.replace(' ', 'T') + 'Z')

/** Re-read financial and consent evidence immediately before every request. Fail closed. */
export function adsIneligibleReason(row: AdsPurchase, startAt: number, now = Date.now()): string | null {
  if (row.state !== 'awaiting_configuration') return 'consent_or_staging_suppressed'
  const context = db().prepare('SELECT * FROM ga4_checkout_context WHERE kind=? AND reference=?')
    .get(row.kind, row.context_reference) as { consent: string; internal: number; user_id: number | null; gclid: string | null; wbraid: string | null; gbraid: string | null } | undefined
  if (context?.consent !== 'granted' || context.internal) return 'consent_or_internal'
  if (!['gclid', 'wbraid', 'gbraid'].includes(row.click_id_type) || !validateClickId(row.click_id) || context[row.click_id_type] !== row.click_id) return 'click_id_mismatch'
  const paidAt = timestamp(row.conversion_time)
  if (!Number.isFinite(paidAt) || paidAt < startAt || paidAt > now || now - paidAt > 30 * 86400000) return 'outside_delivery_window'
  if (row.currency !== 'USD' || !Number.isSafeInteger(row.revenue_cents) || row.revenue_cents <= 0) return 'invalid_value'

  let userId: number, orderId: number, kind: string, price: number
  if (row.kind === 'guest') {
    const guest = db().prepare(`SELECT g.*, u.account_type AS buyer_type FROM guest_checkouts g
      LEFT JOIN users u ON u.id=g.customer_user_id WHERE g.reference=?`).get(row.context_reference) as {
      reference: string; environment: string; state: string; user_id: number; report_id: number;
      review_reason: string | null; wallet_review_reason: string | null; refund_requested_at: string | null;
      payment_id: string | null; paid_at: string | null; email: string; buyer_type: string | null;
      analytics_state: string; card_order_price_cents: number | null; price_cents: number; fee_cents: number; tax_cents: number;
    } | undefined
    if (!guest || row.transaction_id !== `guest-${guest.reference}` || guest.environment !== 'live'
      || !['paid', 'processing', 'completed'].includes(guest.state) || !guest.payment_id || !guest.paid_at
      || timestamp(guest.paid_at) !== paidAt || guest.review_reason || guest.wallet_review_reason || guest.refund_requested_at
      || guest.analytics_state === 'suppressed' || guest.buyer_type === 'admin' || isInternalEmail(guest.email)) return 'guest_payment_not_eligible'
    const expected = guest.card_order_price_cents === null ? guest.price_cents : guest.card_order_price_cents + guest.fee_cents - guest.tax_cents
    if (expected !== row.revenue_cents) return 'value_changed'
    userId = guest.user_id; orderId = guest.report_id; kind = 'paid_imei_report'; price = guest.price_cents
  } else {
    if (!['order', 'paid_imei_report'].includes(row.kind)) return 'unsupported_kind'
    const prefix = row.kind === 'order' ? 'unlock-' : 'report-'
    if (!row.transaction_id.startsWith(prefix) || !/^\d+$/.test(row.transaction_id.slice(prefix.length))) return 'invalid_transaction'
    orderId = Number(row.transaction_id.slice(prefix.length)); kind = row.kind; price = row.revenue_cents
    if (!context.user_id) return 'missing_owner'
    userId = context.user_id
    const capture = db().prepare('SELECT state FROM purchase_analytics WHERE user_id=? AND kind=? AND request_key=?')
      .get(userId, kind, row.context_reference) as { state: string } | undefined
    if (capture?.state === 'suppressed') return 'consent_withdrawn'
    const buyer = db().prepare('SELECT account_type,email FROM users WHERE id=?').get(userId) as { account_type: string; email: string } | undefined
    if (!buyer || !['customer', 'reseller'].includes(buyer.account_type) || isInternalEmail(buyer.email)) return 'internal_user'
    // Wallet funding is fungible: any unresolved payment reversal/review on this account blocks export.
    if (db().prepare(`SELECT 1 FROM whop_topups WHERE user_id=? AND
      (review_reason IS NOT NULL OR reversed_cents>0 OR reversal_due_cents>0) LIMIT 1`).get(userId)) return 'funding_review'
  }
  const table = kind === 'order' ? 'orders' : 'paid_report_orders'
  const order = db().prepare(`SELECT user_id,status,price_cents,source,idempotency_key,provider_mode FROM ${table} WHERE id=?`)
    .get(orderId) as { user_id: number; status: string; price_cents: number; source: string; idempotency_key: string; provider_mode: string | null } | undefined
  if (!order || order.user_id !== userId || order.status !== (kind === 'order' ? 'delivered' : 'completed')
    || order.price_cents !== price || ['mock', 'sandbox', 'test'].includes(order.provider_mode ?? '')) return 'service_not_eligible'
  if (row.kind !== 'guest' && (order.source !== 'website' || order.idempotency_key !== row.context_reference)) return 'order_context_mismatch'
  if (db().prepare(`SELECT 1 FROM credit_ledger WHERE user_id=? AND ref_type=? AND ref_id=? AND type='refund' LIMIT 1`)
    .get(userId, kind, String(orderId))) return 'refunded'
  const charge = db().prepare(`SELECT id,created_at FROM credit_ledger WHERE user_id=? AND ref_type=? AND ref_id=? AND type='charge' AND amount_cents=? ORDER BY id LIMIT 1`)
    .get(userId, kind, String(orderId), -price) as { id: number; created_at: string } | undefined
  if (!charge) return 'missing_charge'
  if (row.kind !== 'guest' && (timestamp(charge.created_at) !== paidAt || fundedByTestCredit(userId, charge.id, price))) return 'unverified_funding'
  return null
}
