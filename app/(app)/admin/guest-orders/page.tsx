import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { formatUsd } from '@/lib/money'
import { guestOrderPath, type GuestCheckout } from '@/lib/guest-checkout'
import Link from 'next/link'
export const dynamic='force-dynamic'
export const metadata={title:'Direct card orders | Control panel',robots:{index:false,follow:false}}
export default async function GuestOrdersPage(){
  await requireAdmin()
  const rows=db().prepare(`SELECT g.*,r.status AS report_status FROM guest_checkouts g LEFT JOIN paid_report_orders r ON r.id=g.report_id ORDER BY g.created_at DESC LIMIT 100`).all() as (GuestCheckout & {report_status:string|null})[]
  return <><div className="app-head"><div><h1>Direct card orders</h1><p>Latest 100 guest checkouts. Review payment, delivery, refund and email status.</p></div></div>
    {rows.length===0?<p>No direct orders yet.</p>:rows.map(row=><article className="panel" key={row.reference} style={{padding:20,marginBottom:16,overflowWrap:'anywhere'}}>
      <h2>{row.product_name}</h2><p>{row.email} · {formatUsd(row.price_cents+row.fee_cents)} before tax</p><p>Payment: {row.state} · Service: {row.report_status??'not submitted'} · Created: {row.created_at} UTC</p>
      {row.last_error?<p role="status">{row.last_error}</p>:null}{row.review_reason?<p role="status">Needs review: {row.review_reason}</p>:null}<p>Payment ID: {row.payment_id??'Not confirmed'} · Order: {row.reference}</p>
      <p>Email: {row.result_sent_at?'Result sent':row.receipt_sent_at?'Confirmation sent':'Waiting'}{row.email_attempts>0?` · ${row.email_attempts} delivery attempts`:''} · Analytics: {row.analytics_state}</p>
      <Link href={guestOrderPath(row.reference)}>Open private order page</Link>
    </article>)}</>
}
