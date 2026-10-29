import { checkoutContext, claimEvent, ga4Config, identity, isInternalEmail, markDeliveryStarted, releaseStaleClaims, sendClaimedEvent, skipEvent, toMicros, type Identity } from './ga4'
import { db } from './db'

export function savePaymentAnalytics(reference: string, userId: number, input: unknown, consent: boolean) {
  if (!consent || !input || typeof input !== 'object') return
  const { clientId, sessionId } = input as Record<string, unknown>
  if (typeof clientId !== 'string' || !/^\d{1,20}\.\d{1,20}$/.test(clientId)
    || typeof sessionId !== 'string' || !/^\d{1,12}$/.test(sessionId) || Number(sessionId) <= 0) return
  // Only a new owned pending invoice can opt in: no historical backfill on revisits.
  db().prepare(`INSERT OR IGNORE INTO payment_analytics (invoice_reference, user_id, client_id, session_id)
    SELECT i.reference, i.user_id, ?, ? FROM invoices i JOIN users u ON u.id=i.user_id
    WHERE i.reference=? AND i.user_id=? AND u.account_type!='admin' AND i.status='pending'
    AND i.created_at >= datetime('now','-5 minutes')`).run(clientId, sessionId, reference, userId)
}
export function revokePaymentAnalytics(userId: number) {
  db().prepare(`UPDATE payment_analytics SET consent=0, client_id='', session_id='',
    state=CASE WHEN state='pending' THEN 'suppressed' ELSE state END WHERE user_id=?`).run(userId)
}

type PaymentEvent = { invoice_reference: string; user_id: number; email: string; client_id: string | null; session_id: string | null; consent: number | null;
  credit_amount_cents: number; gateway: string; credited_at: string }

/**
 * payment_completed: account credit is funding, not profit, so value is 0 on
 * purpose. The amount travels as topup_amount; profit is counted once, when the
 * credit buys a service (purchase, payment_method "credit").
 * Keep this a Secondary conversion in Google Ads.
 */
export function paymentEventPayload(row: PaymentEvent, who: Identity, customerType: 'new' | 'returning') {
  const params: Record<string, unknown> = {
    transaction_id: `topup-${row.invoice_reference}`, value: 0, currency: 'USD',
    topup_amount: row.credit_amount_cents / 100, engagement_time_msec: 100,
    payment_method: row.gateway === 'whop_card' ? 'card' : 'crypto', customer_type: customerType,
  }
  if (who.sessionId) params.session_id = who.sessionId
  return {
    client_id: who.clientId, ...(who.source === 'ga' ? { user_id: String(row.user_id) } : {}),
    timestamp_micros: toMicros(row.credited_at), non_personalized_ads: false,
    events: [{ name: 'payment_completed', params }],
  }
}

/**
 * Runs in the payment worker after gateway/blockchain verification and the
 * balance-changing ledger entry. Every verified top-up since delivery started is
 * either sent once or recorded as skipped with its reason.
 */
export async function deliverPaymentAnalytics(limit = 20) {
  const config = ga4Config()
  const result = { submitted: 0, uncertain: 0, skipped: 0, disabled: false }
  if (!config.enabled) return { ...result, disabled: true }
  const started = markDeliveryStarted()
  releaseStaleClaims()
  const eligible = `SELECT i.reference AS invoice_reference,i.user_id,u.email,u.account_type,a.client_id,a.session_id,a.consent,
      i.credit_amount_cents,i.gateway,i.credited_at
    FROM invoices i JOIN users u ON u.id=i.user_id LEFT JOIN payment_analytics a ON a.invoice_reference=i.reference AND a.user_id=i.user_id
    WHERE i.status='success' AND i.currency='USD' AND i.credit_amount_cents>0 AND i.credited_at>=? AND i.credited_at>=datetime('now','-48 hours')
    AND NOT EXISTS(SELECT 1 FROM ga4_events_sent e WHERE e.transaction_id='topup-'||i.reference AND e.event_name='payment_completed')
    AND EXISTS(SELECT 1 FROM credit_ledger l WHERE l.user_id=i.user_id AND l.ref_type='invoice'
      AND l.ref_id=i.reference AND l.type='topup' AND l.affects_balance=1 AND l.amount_cents=i.credit_amount_cents)
    AND ((i.gateway='whop_card' AND EXISTS(SELECT 1 FROM whop_topups w WHERE w.invoice_reference=i.reference
      AND w.environment='live' AND w.credited=1 AND w.payment_id IS NOT NULL AND w.reversed_cents=0 AND w.review_reason IS NULL))
      OR (i.gateway!='whop_card' AND EXISTS(SELECT 1 FROM invoice_verifications v WHERE v.invoice_reference=i.reference
        AND v.status='verified' AND v.provider_mode IN ('bnb_rpc','etherscan_v2','trongrid')
        AND v.verified_credit_cents=i.credit_amount_cents)))
    ORDER BY i.credited_at LIMIT 1`
  for (let index = 0; index < Math.max(0, Math.min(50, limit)); index++) {
    const row = db().prepare(eligible).get(started) as (PaymentEvent & { account_type: string }) | undefined
    if (!row) break
    const event = { transactionId: `topup-${row.invoice_reference}`, eventName: 'payment_completed' as const, kind: 'topup', paidAt: row.credited_at }
    const context = checkoutContext('topup', row.invoice_reference)
    const skip = row.account_type === 'admin' || isInternalEmail(row.email) || context?.internal ? 'internal_user'
      : row.consent === 0 || context?.consent === 'denied' ? 'consent_denied' : null
    if (skip) { skipEvent(event, skip); result.skipped++; continue }
    if (!claimEvent(event)) continue
    const who = identity(row.client_id, row.session_id)
    const earlier = db().prepare("SELECT 1 FROM invoices WHERE user_id=? AND status='success' AND credited_at<? LIMIT 1").get(row.user_id, row.credited_at)
    const customerType = earlier ? 'returning' : 'new'
    const state = await sendClaimedEvent(event, paymentEventPayload(row, who, customerType), {
      valueCents: 0, paidCents: row.credit_amount_cents, clientSource: who.source, customerType, marginKnown: null,
      reason: who.source === 'fallback' ? 'missing_client_id' : null,
    })
    result[state]++
  }
  return result
}
