import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { serverPurchasesEnabled } from '@/lib/purchase-analytics'
import { formatUsd } from '@/lib/money'
import '@/styles/admin-analytics.css'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tracking health | Control panel', robots: { index: false, follow: false } }
type Row = { reference:string; user_id:number; gateway:string; credit_amount_cents:number; credited_at:string; state:string; reason:string }
export default async function TrackingHealth() {
  await requireAdmin()
  const rows=db().prepare(`SELECT i.reference,i.user_id,i.gateway,i.credit_amount_cents,i.credited_at,
    COALESCE(a.state,'No captured session') state,COALESCE(d.reason,'Not recorded at creation') reason
    FROM invoices i JOIN users u ON u.id=i.user_id LEFT JOIN payment_analytics a ON a.invoice_reference=i.reference
    LEFT JOIN tracking_capture_diagnostics d ON d.kind='topup' AND d.reference=i.reference AND d.user_id=i.user_id
    WHERE u.account_type!='admin' AND i.status='success' AND i.credited_at>=datetime('now','-90 days')
    ORDER BY i.credited_at DESC LIMIT 100`).all() as Row[]
  const groups=db().prepare(`SELECT state,COUNT(*) count FROM purchase_analytics GROUP BY state`).all() as {state:string;count:number}[]
  const guests=db().prepare(`SELECT state,analytics_state,COUNT(*) count,
    SUM(CASE WHEN client_id IS NULL OR session_id IS NULL THEN 1 ELSE 0 END) missing_context
    FROM guest_checkouts WHERE environment='live' AND created_at>=datetime('now','-90 days') GROUP BY state,analytics_state`).all() as {state:string;analytics_state:string;count:number;missing_context:number}[]
  const diagnostics=db().prepare(`SELECT reason,COUNT(*) count FROM tracking_capture_diagnostics
    WHERE created_at>=datetime('now','-90 days') GROUP BY reason`).all() as {reason:string;count:number}[]
  return <div className="analytics-page"><header><p>Control panel · Measurement</p><h1>Tracking health</h1><p>Compare verified payments with server delivery. Last 90 days · UTC · USD.</p><Link href="/admin/analytics">Customer analytics</Link></header>
    <section className="panel"><h2>Server delivery: {serverPurchasesEnabled()?'Enabled':'Disabled / configuration incomplete'}</h2><p>Submitted means Google accepted the HTTP request. Confirm event processing and attribution separately in GA4 and Google Ads.</p><p>Missing context is not proof that a customer declined cookies. Historical records cannot distinguish consent, blocked tags or a timing failure. Do not recreate identifiers or replay old transactions.</p></section>
    <section className="panel"><h2>Paid and credited top-ups</h2><p>Administrator payments excluded. Up to 100 latest records. Top-ups use payment_completed, not purchase.</p><div style={{overflowX:'auto'}}><table><thead><tr>{['Customer','Payment','Credit','Paid at · UTC','Delivery','Capture diagnosis'].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.reference}><td>#{r.user_id}</td><td>{r.gateway}</td><td>{formatUsd(r.credit_amount_cents)}</td><td>{r.credited_at}</td><td>{r.state}</td><td>{r.reason.replaceAll('_',' ')}</td></tr>)}</tbody></table></div>{!rows.length&&<p>No qualifying payments in this period.</p>}</section>
    <section className="panel"><h2>Account purchase delivery</h2>{groups.length?groups.map(g=><p key={g.state}>{g.state}: {g.count}</p>):<p>No captured account purchase sessions.</p>}<p>Account-credit purchases require a completed service and a matching charge in the ledger. Holds, free services and admin orders do not qualify.</p></section>
    <section className="panel"><h2>Guest checkout reconciliation</h2>{guests.map(g=><p key={g.state+g.analytics_state}>{g.state} · analytics {g.analytics_state}: {g.count} checkouts ({g.missing_context} without browser context)</p>)}<p>Pending checkouts are not paid conversions.</p></section>
    <section className="panel"><h2>New capture diagnostics</h2>{diagnostics.length?diagnostics.map(d=><p key={d.reason}>{d.reason.replaceAll('_',' ')}: {d.count}</p>):<p>Diagnostics start with this release. They do not backfill historical consent.</p>}</section>
  </div>
}
