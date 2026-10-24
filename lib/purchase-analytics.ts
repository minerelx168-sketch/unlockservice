import { db } from './db'
import { purchaseConversion } from './purchase-conversion'
import { logPaymentFailure } from './payment-diagnostics'

type Kind = 'order' | 'paid_imei_report'
export function serverPurchasesEnabled() {
  return process.env.GA4_SERVER_PAYMENTS_ENABLED === '1' && !!process.env.GA4_MEASUREMENT_API_SECRET?.trim()
    && process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN === 'https://iunlockmobile.com'
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
    SELECT id,?,?,?,? FROM users WHERE id=? AND account_type='customer'
    AND NOT EXISTS(SELECT 1 FROM ${table} WHERE user_id=? AND idempotency_key=?)`)
    .run(kind,requestKey,clientId,sessionId,userId,userId,requestKey)
}
export function revokePurchaseAnalytics(userId: number) {
  db().prepare(`UPDATE purchase_analytics SET client_id='',session_id='',
    state=CASE WHEN state='pending' THEN 'suppressed' ELSE state END WHERE user_id=?`).run(userId)
}
type Candidate = { user_id:number; kind:Kind; request_key:string; client_id:string; session_id:string;
  order_id:number; price_cents:number; charged_at:string }
export async function deliverPurchaseAnalytics(limit=20) {
  const stats={submitted:0,uncertain:0,disabled:!serverPurchasesEnabled()}
  if(stats.disabled) return stats
  db().prepare("UPDATE purchase_analytics SET state='uncertain' WHERE state='sending' AND attempted_at<datetime('now','-5 minutes')").run()
  db().prepare("UPDATE purchase_analytics SET state='expired',client_id='',session_id='' WHERE state='pending' AND created_at<datetime('now','-90 days')").run()
  const eligible = `SELECT a.*,o.id AS order_id,o.price_cents,l.created_at AS charged_at
    FROM purchase_analytics a JOIN users u ON u.id=a.user_id
    JOIN (
      SELECT id,user_id,idempotency_key,price_cents,created_at,source,'order' AS kind FROM orders WHERE status='delivered'
      UNION ALL
      SELECT id,user_id,idempotency_key,price_cents,created_at,source,'paid_imei_report' AS kind FROM paid_report_orders WHERE status='completed'
    ) o ON o.user_id=a.user_id AND o.kind=a.kind AND o.idempotency_key=a.request_key
    JOIN credit_ledger l ON l.user_id=o.user_id AND l.ref_type=o.kind AND l.ref_id=CAST(o.id AS TEXT)
      AND l.type='charge' AND l.amount_cents=-o.price_cents
    WHERE a.state='pending' AND a.client_id!='' AND a.session_id!='' AND u.account_type='customer'
      AND o.source='website' AND o.price_cents>0 AND o.created_at>=a.created_at
      AND l.created_at>=datetime('now','-48 hours')
      AND NOT EXISTS(SELECT 1 FROM credit_ledger refund WHERE refund.user_id=o.user_id AND refund.ref_type=o.kind
        AND refund.ref_id=CAST(o.id AS TEXT) AND refund.type='refund')`
  for(let i=0;i<Math.max(0,Math.min(50,limit));i++) {
    const row=db().transaction(()=>{
      const found=db().prepare(eligible+' ORDER BY l.created_at LIMIT 1').get() as Candidate|undefined
      if(!found)return
      db().prepare("UPDATE purchase_analytics SET state='sending',attempted_at=datetime('now') WHERE user_id=? AND kind=? AND request_key=? AND state='pending'")
        .run(found.user_id,found.kind,found.request_key)
      return found
    }).immediate()
    if(!row)break
    const conversion=purchaseConversion(row.user_id,row.kind,row.order_id,row.price_cents)
    let state='uncertain'
    try {
      if(!conversion)throw new Error('Ineligible purchase')
      const response=await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=G-9WCELVR3V3&api_secret=${encodeURIComponent(process.env.GA4_MEASUREMENT_API_SECRET!)}`,{
        method:'POST',headers:{'Content-Type':'application/json'},signal:AbortSignal.timeout(10000),
        body:JSON.stringify({client_id:row.client_id,timestamp_micros:Date.parse(row.charged_at.replace(' ','T')+'Z')*1000,
          events:[{name:'purchase',params:{transaction_id:conversion.transactionId,value:conversion.value,currency:'USD',
            session_id:Number(row.session_id),items:conversion.items,payment_method:'account_credit'}}]})
      })
      if(response.ok)state='submitted'
      else logPaymentFailure('purchase.analytics', {name:'Error',status:response.status})
    }catch(error){logPaymentFailure('purchase.analytics',error)}
    db().prepare('UPDATE purchase_analytics SET state=? WHERE user_id=? AND kind=? AND request_key=?')
      .run(state,row.user_id,row.kind,row.request_key)
    if(state==='submitted')stats.submitted++;else stats.uncertain++
  }
  return stats
}
