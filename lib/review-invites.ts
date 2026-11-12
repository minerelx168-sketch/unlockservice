import {createHash} from 'node:crypto'
import {db} from './db'
import {sendTransactionalEmail} from './account-security'

// Only invite after a real result-delivery notification. Keep one durable reservation
// per normalized recipient across guest and account orders, including ambiguous sends.
export const candidates=`
 SELECT 'guest:'||g.reference AS ref, lower(trim(g.email)) AS email,g.result_sent_at AS delivered
 FROM guest_checkouts g JOIN paid_report_orders r ON r.id=g.report_id
 WHERE g.state='completed' AND r.status='completed' AND g.environment='live' AND g.payment_id IS NOT NULL AND g.paid_at IS NOT NULL AND g.price_cents>0
 AND g.review_reason IS NULL AND g.refund_requested_at IS NULL AND g.refund_notice_sent_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM credit_ledger l WHERE l.ref_type='paid_imei_report' AND l.ref_id=CAST(r.id AS TEXT) AND l.type='refund')
 UNION ALL
 SELECT 'order:'||o.id,lower(trim(coalesce(nullif(o.delivery_email,''),u.email))),n.sent_at
 FROM orders o JOIN users u ON u.id=o.user_id JOIN order_notifications n ON n.resource_type='order' AND n.resource_id=o.id AND n.event='success'
 WHERE o.status='delivered' AND o.provider_mode='dhru' AND o.price_cents>0 AND n.last_error IS NULL
 AND NOT EXISTS(SELECT 1 FROM credit_ledger l WHERE l.ref_type='order' AND l.ref_id=CAST(o.id AS TEXT) AND l.type='refund')`
const windowed='SELECT * FROM ('+candidates+") WHERE delivered BETWEEN datetime('now','-6 hours') AND datetime('now','-2 hours')"
export function reviewUrl(raw:string|undefined){
 if(!raw)return null
 try{const u=new URL(raw);return u.protocol==='https:'&&u.hostname==='alternativeto.net'&&/^\/software\/[a-z0-9-]+\/(?:about\/)?$/.test(u.pathname)&&!u.username&&!u.password&&!u.search?u.href:null}catch{return null}
}
export async function deliverReviewInvites(){
 // Trustpilot must not receive an outcome-selected invitation stream. Do not
 // append TRUSTPILOT_REVIEW_URL here; use an independent neutral cohort there.
 const link=reviewUrl(process.env.ALTERNATIVETO_URL)
 if(process.env.REVIEW_INVITES_ENABLED!=='true'||!link)return {enabled:false,sent:0}
 const conn=db(), rows=conn.prepare(windowed+' ORDER BY delivered,ref').all() as {ref:string;email:string}[]
 let sent=0,failed=0
 for(const {ref,email} of rows){
  if(sent+failed>=20)break
  const key=createHash('sha256').update(email).digest('hex')
  const claim=conn.transaction(()=>{
   if(!conn.prepare('SELECT 1 FROM ('+windowed+') WHERE ref=? AND email=?').get(ref,email))return false
   return conn.prepare(`INSERT INTO review_invites(recipient,order_ref,reserved_at) VALUES(?,?,datetime('now'))
   ON CONFLICT(recipient) DO UPDATE SET order_ref=excluded.order_ref,reserved_at=excluded.reserved_at,review_request_sent_at=NULL
   WHERE review_invites.reserved_at < datetime('now','-90 days')`).run(key,ref).changes===1
  }).immediate()
  if(!claim)continue
  try{
   const body='Thank you for using iUnlockMobile. If you would like to share your experience, positive or negative, you can leave an optional review on AlternativeTo: '+link+'. Your choice does not affect service or support.'
   await sendTransactionalEmail(email,'How was your iUnlockMobile experience?', '<p>'+body+'</p>',body,{idempotencyKey:'review/'+ref})
   conn.prepare("UPDATE review_invites SET review_request_sent_at=datetime('now') WHERE recipient=? AND order_ref=?").run(key,ref);sent++
  }catch{failed++}
 }
 return {enabled:true,sent,failed}
}
