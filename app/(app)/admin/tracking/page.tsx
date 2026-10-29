import Link from 'next/link'
import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { serverPurchasesEnabled } from '@/lib/purchase-analytics'
import { formatUsd } from '@/lib/money'
import '@/styles/admin-analytics.css'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tracking health | Control panel', robots: { index: false, follow: false } }
type Row = { reference:string; user_id:number; gateway:string; credit_amount_cents:number; credited_at:string; state:string; reason:string }

const label=(v:string)=>{const t=v.replaceAll('_',' ');return t.charAt(0).toUpperCase()+t.slice(1)}
const tone=(state:string)=>state==='submitted'?'badge--success':['pending','sending','uncertain'].includes(state)?'badge--pending':'badge--muted'
const when=(v:string)=>v.slice(0,16)
function Stat({label:l,value,note}:{label:string;value:ReactNode;note:string}){return <div className="stat"><span className="label">{l}</span><span className="value">{value}</span><span className="caption">{note}</span></div>}
function Counts({items,empty}:{items:{key:string;label:string;count:number;note?:string}[];empty:string}){
  if(!items.length)return <div className="analytics-empty"><p>{empty}</p></div>
  return <ul className="tracking-counts">{items.map(x=><li key={x.key}><span>{x.label}{x.note&&<small>{x.note}</small>}</span><strong>{x.count.toLocaleString()}</strong></li>)}</ul>
}
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
  const enabled=serverPurchasesEnabled()
  const delivered=rows.filter(r=>r.state==='submitted').length
  const noSession=rows.filter(r=>r.state==='No captured session').length
  const diagnosed=rows.filter(r=>r.reason!=='Not recorded at creation').length
  const headings=['Customer','Payment','Credit','Paid at · UTC','Delivery','Capture diagnosis']
  return <div className="admin-analytics tracking-health">
    <div className="app-head"><div><span className="eyebrow">Control panel · Measurement</span><h1>Tracking health</h1><p>Verified payments vs. server delivery · last 90 days · UTC · USD</p></div><Link className="button button--secondary" href="/admin/analytics">Customer analytics</Link></div>

    <section className={`tracking-status ${enabled?'is-on':'is-off'}`} aria-label="Server delivery status">
      <span className={`badge ${enabled?'badge--success':'badge--error'}`}>{enabled?'Enabled':'Disabled'}</span>
      <div><h2>Server delivery {enabled?'is enabled':'is off or not fully configured'}</h2><p>“Submitted” means Google accepted the request — confirm processing and attribution in GA4 and Google Ads.</p></div>
    </section>

    <div className="stat-grid analytics-stats">
      <Stat label="Top-ups checked" value={rows.length} note="Latest 100 · admins excluded"/>
      <Stat label="Delivered" value={delivered} note="Submitted to Google"/>
      <Stat label="No captured session" value={noSession} note="Browser context missing"/>
      <Stat label="Diagnosed" value={diagnosed} note="Reason recorded at creation"/>
    </div>

    <section className="panel"><header><div><h2>Paid and credited top-ups</h2><p>Top-ups send payment_completed, not purchase.</p></div></header>
      {rows.length?<div className="analytics-table-wrap"><table className="analytics-table"><thead><tr>{headings.map(x=><th scope="col" key={x}>{x}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.reference}>
        <td data-label={headings[0]}><div><span className="analytics-account">#{r.user_id}</span><span className="analytics-secondary mono">{r.reference}</span></div></td>
        <td data-label={headings[1]}><div>{label(r.gateway)}</div></td>
        <td data-label={headings[2]}><div>{formatUsd(r.credit_amount_cents)}</div></td>
        <td data-label={headings[3]}><div>{when(r.credited_at)}</div></td>
        <td data-label={headings[4]}><div><span className={`badge ${tone(r.state)}`}>{label(r.state)}</span></div></td>
        <td data-label={headings[5]}><div>{label(r.reason)}</div></td>
      </tr>)}</tbody></table></div>:<div className="analytics-empty"><strong>No results yet</strong><p>No qualifying payments in this period.</p></div>}
    </section>

    <div className="tracking-grid">
      <section className="panel"><header><div><h2>Account purchases</h2><p>Completed services with a matching ledger charge. Holds, free and admin orders excluded.</p></div></header>
        <Counts items={groups.map(g=>({key:g.state,label:label(g.state),count:g.count}))} empty="No captured account purchase sessions."/></section>
      <section className="panel"><header><div><h2>Guest checkouts</h2><p>Live checkouts. Pending ones are not paid conversions.</p></div></header>
        <Counts items={guests.map(g=>({key:g.state+g.analytics_state,label:`${label(g.state)} · ${label(g.analytics_state??'none')}`,count:g.count,note:g.missing_context?`${g.missing_context} without browser context`:undefined}))} empty="No live guest checkouts in this period."/></section>
      <section className="panel"><header><div><h2>Capture diagnostics</h2><p>Recorded from this release; no historical backfill.</p></div></header>
        <Counts items={diagnostics.map(d=>({key:d.reason,label:label(d.reason),count:d.count}))} empty="No diagnostics recorded yet."/></section>
    </div>

    <p className="analytics-footnote">Missing context does not prove a customer declined cookies — consent, blocked tags and timing failures look the same in old records. Do not recreate identifiers or replay past transactions.</p>
  </div>
}
