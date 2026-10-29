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

type PaymentEvent = { invoice_reference: string; client_id: string; session_id: string; credit_amount_cents: number; gateway: string; credited_at: string }
export function paymentEventPayload(row: PaymentEvent) {
  return { client_id: row.client_id, timestamp_micros: Date.parse(row.credited_at.replace(' ', 'T') + (/[Z+]\d*:?\d*$/.test(row.credited_at) ? '' : 'Z')) * 1000,
    consent: { ad_user_data: 'GRANTED', ad_personalization: 'GRANTED' },
    events: [{ name: 'payment_completed', params: {
      transaction_id: `topup-${row.invoice_reference}`, value: row.credit_amount_cents / 100, currency: 'USD',
      session_id: Number(row.session_id), engagement_time_msec: 1, payment_method: row.gateway === 'whop_card' ? 'card' : 'crypto',
      service_category: 'account_credit', status: 'verified',
      items: [{ item_id: 'account_credit', item_name: 'Account credit', price: row.credit_amount_cents / 100, quantity: 1 }],
    } }],
  }
}

/** Runs after gateway/blockchain verification in the existing payment worker.
 * Unique invoice claim stops concurrent workers and page refreshes duplicating events.
 * Ambiguous deliveries are quarantined, NOT retried: MP has no exactly-once API.
 */
export async function deliverPaymentAnalytics(limit = 20) {
  const secret = process.env.GA4_MEASUREMENT_API_SECRET?.trim()
  const result = { submitted: 0, uncertain: 0, disabled: false }
  if (process.env.GA4_SERVER_PAYMENTS_ENABLED !== '1' || !secret
    || process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN !== 'https://iunlockmobile.com') return { ...result, disabled: true }
  db().prepare(`UPDATE payment_analytics SET state='uncertain' WHERE state='sending' AND attempted_at<datetime('now','-5 minutes')`).run()
  db().prepare(`UPDATE payment_analytics SET state='expired',client_id='',session_id='' WHERE state='pending' AND created_at<datetime('now','-90 days')`).run()
  const eligible = `SELECT a.*,i.credit_amount_cents,i.gateway,i.credited_at FROM payment_analytics a
    JOIN invoices i ON i.reference=a.invoice_reference AND i.user_id=a.user_id JOIN users u ON u.id=a.user_id
    WHERE a.state='pending' AND a.consent=1 AND u.account_type!='admin' AND i.status='success'
    AND i.currency='USD' AND i.credit_amount_cents>0 AND i.credited_at>=a.created_at
    AND i.credited_at>=datetime('now','-48 hours')
    AND EXISTS(SELECT 1 FROM credit_ledger l WHERE l.user_id=i.user_id AND l.ref_type='invoice'
      AND l.ref_id=i.reference AND l.type='topup' AND l.affects_balance=1 AND l.amount_cents=i.credit_amount_cents)
    AND ((i.gateway='whop_card' AND EXISTS(SELECT 1 FROM whop_topups w WHERE w.invoice_reference=i.reference
      AND w.environment='live' AND w.credited=1 AND w.payment_id IS NOT NULL AND w.reversed_cents=0 AND w.review_reason IS NULL))
      OR (i.gateway!='whop_card' AND EXISTS(SELECT 1 FROM invoice_verifications v WHERE v.invoice_reference=i.reference
        AND v.status='verified' AND v.provider_mode IN ('bnb_rpc','etherscan_v2','trongrid')
        AND v.verified_credit_cents=i.credit_amount_cents)))`
  for (let index=0; index<Math.max(0,Math.min(50,limit)); index++) {
    const row = db().transaction(() => {
      const candidate = db().prepare(`${eligible} ORDER BY i.credited_at LIMIT 1`).get() as PaymentEvent | undefined
      if (!candidate) return
      db().prepare(`UPDATE payment_analytics SET state='sending',attempted_at=datetime('now') WHERE invoice_reference=? AND state='pending'`).run(candidate.invoice_reference)
      return candidate
    }).immediate()
    if (!row) break
    try {
      const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=G-9WCELVR3V3&api_secret=${encodeURIComponent(secret)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(paymentEventPayload(row)), signal: AbortSignal.timeout(10000),
      })
      // A 2xx is transport acceptance, never proof of GA4 processing or Ads attribution.
      const state = response.ok ? 'submitted' : 'uncertain'
      db().prepare('UPDATE payment_analytics SET state=? WHERE invoice_reference=?').run(state,row.invoice_reference)
      result[state]++
    } catch {
      db().prepare("UPDATE payment_analytics SET state='uncertain' WHERE invoice_reference=?").run(row.invoice_reference)
      result.uncertain++
    }
  }
  return result
}
