import { db } from './db'
import { checkoutContext, claimEvent, fundedByTestCredit, ga4Config, identity, isInternalEmail, markDeliveryStarted, releaseStaleClaims, sendClaimedEvent, skipEvent, toMicros } from './ga4'
import { marginCents, serviceForCode, serviceForProviderId } from './service-margins'

type Kind = 'order' | 'paid_imei_report'
export function serverPurchasesEnabled() {
  return ga4Config().enabled
}
/** Capture before submitting a new order; never attach a new session to historical sales. */
export function savePurchaseAnalytics(userId: number, kind: Kind, requestKey: string, input: unknown, consent: boolean) {
  if (!serverPurchasesEnabled() || !consent || !input || typeof input !== 'object'
    || !requestKey || requestKey.length > 128) return
  const { clientId, sessionId } = input as Record<string, unknown>
  if (typeof clientId !== 'string' || !/^\d{1,20}\.\d{1,20}$/.test(clientId)
    || typeof sessionId !== 'string' || !/^\d{1,12}$/.test(sessionId) || Number(sessionId) <= 0) return
  const table = kind === 'order' ? 'orders' : 'paid_report_orders'
  db().prepare(`INSERT OR IGNORE INTO purchase_analytics(user_id,kind,request_key,client_id,session_id)
    SELECT id,?,?,?,? FROM users WHERE id=? AND account_type IN ('customer','reseller')
    AND NOT EXISTS(SELECT 1 FROM ${table} WHERE user_id=? AND idempotency_key=?)`)
    .run(kind,requestKey,clientId,sessionId,userId,userId,requestKey)
}
export function revokePurchaseAnalytics(userId: number) {
  db().prepare(`UPDATE purchase_analytics SET client_id='',session_id='',
    state=CASE WHEN state='pending' THEN 'suppressed' ELSE state END WHERE user_id=?`).run(userId)
}
type Candidate = { user_id:number; email:string; account_type:string; kind:Kind; order_id:number; idempotency_key:string|null;
  price_cents:number; charged_at:string; charge_id:number; client_id:string|null; session_id:string|null; capture_state:string|null;
  product_code:string|null; product_name:string|null; provider_service_id:string|null; order_kind:string|null }

/** Earlier paid service for this customer, by account or by email on guest checkouts. */
export function customerTypeFor(userId: number | null, email: string | null, paidAt: string, excludeGuest?: string): 'new' | 'returning' {
  const charge = userId ? db().prepare(`SELECT 1 FROM credit_ledger WHERE user_id=? AND type='charge' AND ref_type IN ('order','paid_imei_report') AND created_at<? LIMIT 1`).get(userId, paidAt) : undefined
  if (charge) return 'returning'
  const guest = email ? db().prepare(`SELECT 1 FROM guest_checkouts WHERE lower(email)=lower(?) AND paid_at IS NOT NULL AND paid_at<? AND environment='live'
    AND state NOT IN ('refunded','refund_pending') AND reference IS NOT ? LIMIT 1`).get(email, paidAt, excludeGuest ?? null) : undefined
  return guest ? 'returning' : 'new'
}

/**
 * purchase for services paid from account credit: value = gross margin of the
 * service (price charged minus provider cost), items[].price = amount charged.
 */
export async function deliverPurchaseAnalytics(limit=20) {
  const stats={submitted:0,uncertain:0,skipped:0,disabled:!serverPurchasesEnabled()}
  if(stats.disabled) return stats
  const started=markDeliveryStarted()
  releaseStaleClaims()
  const eligible = `SELECT o.user_id,u.email,u.account_type,o.kind,o.id AS order_id,o.idempotency_key,o.price_cents,l.created_at AS charged_at,l.id AS charge_id,
      a.client_id,a.session_id,a.state AS capture_state,o.product_code,o.product_name,o.provider_service_id,o.order_kind
    FROM (
      SELECT id,user_id,idempotency_key,price_cents,source,'order' AS kind,NULL AS product_code,NULL AS product_name,provider_service_id,kind AS order_kind FROM orders WHERE status='delivered'
      UNION ALL
      SELECT id,user_id,idempotency_key,price_cents,source,'paid_imei_report' AS kind,product_code,product_name,provider_service_id,NULL AS order_kind FROM paid_report_orders WHERE status='completed'
    ) o JOIN users u ON u.id=o.user_id
    JOIN credit_ledger l ON l.user_id=o.user_id AND l.ref_type=o.kind AND l.ref_id=CAST(o.id AS TEXT) AND l.type='charge' AND l.amount_cents=-o.price_cents
    LEFT JOIN purchase_analytics a ON a.user_id=o.user_id AND a.kind=o.kind AND a.request_key=o.idempotency_key
    WHERE o.source='website' AND o.price_cents>0 AND l.created_at>=? AND l.created_at>=datetime('now','-48 hours')
      AND NOT EXISTS(SELECT 1 FROM ga4_events_sent e WHERE e.event_name='purchase' AND e.transaction_id=(CASE o.kind WHEN 'order' THEN 'unlock-' ELSE 'report-' END)||o.id)
      AND NOT EXISTS(SELECT 1 FROM credit_ledger refund WHERE refund.user_id=o.user_id AND refund.ref_type=o.kind
        AND refund.ref_id=CAST(o.id AS TEXT) AND refund.type='refund')
    ORDER BY l.created_at LIMIT 1`
  for(let i=0;i<Math.max(0,Math.min(50,limit));i++) {
    const row=db().prepare(eligible).get(started) as Candidate|undefined
    if(!row)break
    const event={transactionId:`${row.kind==='order'?'unlock':'report'}-${row.order_id}`,eventName:'purchase' as const,kind:row.kind,paidAt:row.charged_at}
    const context=row.idempotency_key ? checkoutContext(row.kind,row.idempotency_key) : undefined
    const skip=row.account_type==='admin' || isInternalEmail(row.email) || context?.internal ? 'internal_user'
      : row.capture_state==='suppressed' || context?.consent==='denied' ? 'consent_denied'
      : fundedByTestCredit(row.user_id,row.charge_id,row.price_cents) ? 'test_credit' : null
    if(skip){skipEvent(event,skip);stats.skipped++;continue}
    if(!claimEvent(event))continue
    const service=row.kind==='paid_imei_report'
      ? (row.product_code ? serviceForCode(row.product_code,row.product_name ?? undefined) : serviceForProviderId(row.provider_service_id,row.product_name ?? undefined))
      : serviceForProviderId(row.provider_service_id,row.order_kind==='carrier_unlock'?'Network unlock':'Device service')
    const margin=marginCents(service.serviceId,row.price_cents)
    const who=identity(row.client_id,row.session_id)
    const customerType=customerTypeFor(row.user_id,row.email,row.charged_at)
    const params:Record<string,unknown>={transaction_id:event.transactionId,value:margin.valueCents/100,currency:'USD',engagement_time_msec:100,
      payment_method:'credit',customer_type:customerType,
      items:[{item_id:service.serviceId ?? row.product_code ?? `order:${row.order_id}`,item_name:service.name,item_category:service.category,price:row.price_cents/100,quantity:1}]}
    if(who.sessionId)params.session_id=who.sessionId
    const reasons=[who.source==='fallback'?'missing_client_id':null,margin.known?null:'margin_unknown'].filter(Boolean).join('; ')||null
    const state=await sendClaimedEvent(event,{client_id:who.clientId,...(who.source==='ga'?{user_id:String(row.user_id)}:{}),
      timestamp_micros:toMicros(row.charged_at),non_personalized_ads:false,events:[{name:'purchase',params}]},
      {valueCents:margin.valueCents,paidCents:row.price_cents,clientSource:who.source,customerType,marginKnown:margin.known,reason:reasons})
    stats[state]++
  }
  return stats
}
