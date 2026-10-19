import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { formatUsd } from '@/lib/money'
import {
  AnalyticsError, ANALYTICS_EXPORT_LIMIT, analyticsOverview, analyticsTrend, analyticsServices,
  analyticsChannels, analyticsRecords, analyticsBehavior, analyticsPreviousPeriod, growthLabel, analyticsPaymentTotals, analyticsServiceOptions,
  analyticsDate, analyticsUrl, parseAnalyticsFilters, bangkokDay,
  type AnalyticsParams, type AnalyticsFilters, type UsageRow, type FundingRow, type CustomerRow, type TrendRow,
} from '@/lib/admin-analytics'
import '@/styles/admin-analytics.css'

export const dynamic = 'force-dynamic'
export const metadata: Metadata = { title: 'Customer analytics | Control panel', robots: { index: false, follow: false } }
const tabs = [ ['overview', 'Overview'], ['services', 'Service usage'], ['payments', 'Top-ups'], ['customers', 'Customers'], ['behavior', 'Behavior'] ] as const
const segmentLabels: Record<string, string> = { no_purchase: 'No paid purchase', once: 'One purchase', repeat: 'Repeat buyer', inactive: 'Inactive buyer · 30+ days' }
const statusLabels: Record<string, string> = { completed: 'Completed', processing: 'Processing', review: 'Needs review', refunded: 'Refunded', failed: 'Closed / failed', pending: 'Awaiting payment', success: 'Paid & credited' }
function Stat({ label, value, note }: { label: string; value: ReactNode; note: string }) {
  return <div className="stat"><span className="label">{label}</span><span className="value">{value}</span><span className="caption">{note}</span></div>
}
function Badge({ status }: { status: string }) {
  return <span className={`badge ${['success','completed'].includes(status) ? 'badge--success' : ['review','processing'].includes(status) ? 'badge--pending' : 'badge--muted'}`}>{statusLabels[status] ?? status}</span>
}
function Account({ id, name, email, f }: { id: number; name: string; email: string; f: AnalyticsFilters }) {
  return <div><Link className="analytics-account" href={analyticsUrl(f, { view: 'customers', user: id, q: '', segment: 'all', status: 'all', service: '', method: 'all' })}>{name}</Link><small className="analytics-secondary">{email}</small></div>
}
function Table({ headings, rows, empty = 'No records match these filters.' }: { headings: string[]; rows: { key: string | number; cells: ReactNode[] }[]; empty?: string }) {
  if (!rows.length) return <div className="analytics-empty"><strong>No results yet</strong><p>{empty}</p></div>
  return <div className="analytics-table-wrap"><table className="analytics-table" role="table"><thead role="rowgroup"><tr role="row">{headings.map(h => <th scope="col" role="columnheader" key={h}>{h}</th>)}</tr></thead><tbody role="rowgroup">{rows.map(row => <tr role="row" key={row.key}>{row.cells.map((cell, i) => <td role="cell" data-label={headings[i]} key={headings[i]}><div>{cell}</div></td>)}</tr>)}</tbody></table></div>
}
function Pagination({ f, page, pages, total }: { f: AnalyticsFilters; page: number; pages: number; total: number }) {
  return <nav className="analytics-pager" aria-label="Analytics pages"><span>{total.toLocaleString()} records · Page {page} of {pages}</span><div>{page > 1 && <Link className="button button--secondary" href={analyticsUrl(f, { page: page - 1 })}>Previous</Link>}{page < pages && <Link className="button button--secondary" href={analyticsUrl(f, { page: page + 1 })}>Next</Link>}</div></nav>
}
function Trend({ rows }: { rows: TrendRow[] }) {
  const max = Math.max(100, ...rows.flatMap(r => [r.spent_cents, r.added_cents]))
  const line = (key: 'spent_cents' | 'added_cents') => rows.map((r, i) => `${i ? 'L' : 'M'}${24 + i / Math.max(1, rows.length - 1) * 552},${160 - r[key] / max * 130}`).join(' ')
  const hasData = rows.some(r => r.spent_cents || r.added_cents)
  return <section className="panel analytics-trend"><header><div><h2>Money over time</h2><p>Daily service charges and credit added from payments.</p></div><span>USD · posting date</span></header>{hasData ? <div className="analytics-chart"><svg viewBox="0 0 600 190" role="img" aria-labelledby="analytics-chart-title"><title id="analytics-chart-title">Daily money posted to customer accounts. Detailed amounts are in the daily totals below.</title><path d="M24 30H576 M24 95H576 M24 160H576" className="analytics-gridline"/><path d={line('added_cents')} className="analytics-line analytics-line--funds"/><path d={line('spent_cents')} className="analytics-line analytics-line--spend"/>{rows.map((r,i) => <g key={r.date}><circle cx={24 + i / Math.max(1, rows.length-1)*552} cy={160-r.added_cents/max*130} r="3" className="analytics-dot--funds"><title>{r.date}: payment credit {formatUsd(r.added_cents)}</title></circle><circle cx={24 + i / Math.max(1, rows.length-1)*552} cy={160-r.spent_cents/max*130} r="3" className="analytics-dot--spend"><title>{r.date}: service charges {formatUsd(r.spent_cents)}</title></circle></g>)}<text x="24" y="184">{rows[0]?.date}</text><text x="576" y="184" textAnchor="end">{rows.at(-1)?.date}</text></svg><div className="analytics-legend"><span className="analytics-legend--spend">Service charges</span><span className="analytics-legend--funds">Payment credits</span><span>Scale: {formatUsd(max)}</span></div></div> : <div className="analytics-empty"><strong>No money posted in this period</strong><p>Choose a wider date range or include administrator accounts.</p></div>}
  <details className="analytics-daily"><summary>View daily totals</summary><Table headings={['Date · Bangkok', 'Service charges', 'Payment credits', 'Credit reversals']} rows={rows.filter(r=>r.spent_cents||r.added_cents||r.reversed_cents).map(r=>({ key:r.date,cells:[r.date,formatUsd(r.spent_cents),formatUsd(r.added_cents),formatUsd(r.reversed_cents)] }))}/></details></section>
}
function Filters({ f, serviceOptions }: { f: AnalyticsFilters; serviceOptions: { service_key: string; service: string }[] }) {
  const today = bangkokDay()
  return <section className="panel analytics-filter-panel" aria-label="Report filters"><div className="analytics-filter-top"><strong>Report period</strong><div className="analytics-presets">{[7,30,90].map(days => <Link key={days} href={analyticsUrl(f, { from: bangkokDay(Date.now()-(days-1)*86_400_000), to: today })}>Last {days} days</Link>)}</div></div>
  <form method="get" action="/admin/analytics" className="analytics-filters">
    <input type="hidden" name="view" value={f.view}/>{f.user > 0 && <input type="hidden" name="user" value={f.user}/>}
    <label>From<input name="from" type="date" defaultValue={f.from} required/></label>
    <label>Through<input name="to" type="date" defaultValue={f.to} required/></label>
    <label className="analytics-search">Customer<input type="search" name="q" defaultValue={f.q} maxLength={100} placeholder="Name or email" autoComplete="off"/></label>
    {f.view === 'services' && <label>Service<select name="service" defaultValue={f.service}><option value="">All services</option>{serviceOptions.map(s=><option key={s.service_key} value={s.service_key}>{s.service}</option>)}</select></label>}
    {['services','payments'].includes(f.view) && <label>Status<select name="status" defaultValue={f.status}><option value="all">All statuses</option>{(f.view === 'services' ? ['completed','processing','review','refunded','failed'] : ['pending','review','success','refunded','failed']).map(s=><option key={s} value={s}>{statusLabels[s]}</option>)}</select></label>}
    {f.view === 'payments' && <label>Payment method<select name="method" defaultValue={f.method}><option value="all">All methods</option><option value="card">Card · Whop</option><option value="crypto">Cryptocurrency</option></select></label>}
    {f.view === 'customers' && <label>Customer segment<select name="segment" defaultValue={f.segment}><option value="all">All customers</option>{Object.entries(segmentLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label>}
    <label className="analytics-checkbox"><input type="checkbox" name="admins" value="1" defaultChecked={f.admins}/>Include administrators</label>
    <div className="analytics-filter-actions"><button className="button button--primary" type="submit">Apply filters</button><Link className="button button--quiet" href={`/admin/analytics?view=${f.view}`}>Reset</Link></div>
  </form><div className="analytics-filter-note"><span>Asia/Bangkok (UTC+7) · USD · {f.admins ? 'All account roles' : 'Administrator accounts excluded'}</span>{f.user > 0 && <Link href={analyticsUrl(f,{user:'',q:''})}>Customer #{f.user} × Clear</Link>}</div></section>
}
export default async function AdminAnalyticsPage({ searchParams }: { searchParams: Promise<AnalyticsParams> }) {
  await requireAdmin()
  const params = await searchParams
  let f: AnalyticsFilters, error = ''
  try { f = parseAnalyticsFilters(params) } catch (problem) {
    if (!(problem instanceof AnalyticsError)) throw problem
    error = problem.message; f = parseAnalyticsFilters({ view: typeof params.view === 'string' ? params.view : 'overview' })
  }
  const options = f.view === 'services' && !error ? analyticsServiceOptions(f) : []
  const heading = tabs.find(t=>t[0]===f.view)![1]
  let report: ReactNode = null
  if (!error && f.view === 'overview') {
    const summary = analyticsOverview(f), previous = analyticsOverview(analyticsPreviousPeriod(f)), services = analyticsServices(f).slice(0,6), channels = analyticsChannels(f)
    report = <>
      <div className="stat-grid analytics-stats"><Stat label="Service charges" value={formatUsd(summary.spent_cents)} note={growthLabel(summary.spent_cents,previous.spent_cents)}/><Stat label="Payment credits" value={formatUsd(summary.added_cents)} note="Verified top-ups · before reversals"/><Stat label="Credit reversals" value={formatUsd(summary.reversed_cents)} note="Payment credit removed after refunds"/><Stat label="Active customers" value={summary.active_customers} note={`${summary.new_customers} new registrations in this period`}/></div>
      <div className="analytics-brief"><span><strong>{summary.requests}</strong> service requests</span><span><strong>{summary.free_checks}</strong> free checks</span><span><strong>{summary.purchasers}</strong> paying customers</span><span><strong>{summary.repeat_purchasers}</strong> repeat buyers active in period</span></div>
      <p className="analytics-footnote">Sales are settled service charges, compared with the preceding {Math.round((Date.parse(f.to)-Date.parse(f.from))/86400000)+1} days. {f.to>=bangkokDay()?'Today is still in progress.':''} Payment credits are tracked separately.</p>
      <Trend rows={analyticsTrend(f)}/>
      <section className="panel"><header><div><h2>Services customers use</h2><p>Requests created in the period · current charged amounts.</p></div><Link className="button button--quiet" href={analyticsUrl(f,{view:'services'})}>All service usage →</Link></header><Table headings={['Service','Requests','Customers','Charged']} rows={services.map(s=>({key:s.service_key,cells:[<Link key="service" href={analyticsUrl(f,{view:'services',service:s.service_key})}>{s.service}</Link>,s.requests,s.customers,formatUsd(s.charged_cents)]}))}/></section>
      <section className="panel"><header><div><h2>Recorded acquisition signals</h2><p>Service requests created in the period. Missing attribution does not mean organic traffic.</p></div></header><Table headings={['Recorded channel','Requests','Customers','Charged']} rows={channels.map(c=>({key:c.channel,cells:[c.channel,c.requests,c.customers,formatUsd(c.charged_cents)]}))}/><p className="analytics-footnote">Google Ads means a consented click identifier was recorded. Campaign names, keywords, SEO attribution and advertising spend are not available in this report.</p></section>
    </>
  }
  if (!error && f.view === 'services') {
    const result = analyticsRecords<UsageRow>(f), services = analyticsServices(f)
    report = <><section className="panel"><header><div><h2>Usage by service</h2><p>Requests created in the selected period · outcomes and charges as of now.</p></div><span>{result.total.toLocaleString()} requests</span></header><Table headings={['Service','Requests','Customers','Completed','Charged']} rows={services.slice(0,1000).map(s=>({key:s.service_key,cells:[<div key="service"><Link href={analyticsUrl(f,{service:s.service_key})}>{s.service}</Link><small className="analytics-secondary">{s.category}</small></div>,s.requests,s.customers,s.completed,formatUsd(s.charged_cents)]}))}/>{services.length>1000&&<p className="analytics-footnote">Showing the top 1,000 services. Select a service to narrow this report.</p>}</section>
    <section className="panel"><header><div><h2>Service activity</h2><p>Unlocks, paid reports and free checks · 25 records per page.</p></div></header><Table headings={['Request','Customer','Service','Status','Value / charged','Created · Bangkok','Recorded channel']} rows={result.rows.map(r=>({key:r.reference,cells:[<span key="ref" className="mono">{r.reference}</span>,<Account key="account" id={r.user_id} name={r.username} email={r.email} f={f}/>,<div key="service">{r.service}<small className="analytics-secondary">{r.category}</small></div>,<Badge key="status" status={r.status}/>,<div key="value">{formatUsd(r.price_cents)}<small className="analytics-secondary">{formatUsd(r.charged_cents)} charged</small></div>,analyticsDate(r.created_at),r.channel]}))}/><Pagination f={f} {...result}/></section></>
  }
  if (!error && f.view === 'payments') {
    const result = analyticsRecords<FundingRow>(f), totals = analyticsPaymentTotals(f)
    report = <><div className="stat-grid analytics-stats"><Stat label="Payment requests" value={totals.requests} note="Created in the selected period"/><Stat label="Credit added" value={formatUsd(totals.added_cents)} note="Actually credited from these requests"/><Stat label="Credit reversed" value={formatUsd(totals.reversed_cents)} note="Removed after payment refunds"/><Stat label="Net credit" value={formatUsd(totals.added_cents-totals.reversed_cents)} note={totals.reversal_due_cents ? `${formatUsd(totals.reversal_due_cents)} reversal outstanding` : 'Added minus reversed · current outcome'}/></div>
    <section className="panel"><header><div><h2>Top-up records</h2><p>Filtered by request creation date. Pending amounts are not included in credit added.</p></div><Link className="button button--quiet" href="/admin/payments">Payment history →</Link></header><Table headings={['Invoice','Customer','Method','Status','Amount due / fee','Credit added / reversed','Created · Bangkok','Credited · Bangkok']} rows={result.rows.map(r=>({key:r.reference,cells:[<Link key="ref" className="mono" href={`/admin/payments?ref=${encodeURIComponent(r.reference)}`}>{r.reference}</Link>,<Account key="account" id={r.user_id} name={r.username} email={r.email} f={f}/>,r.method,<Badge key="status" status={r.status}/>,<div key="due">{r.currency==='USD'?formatUsd(r.total_due_cents):`${(r.total_due_cents/100).toFixed(2)} ${r.currency}`}<small className="analytics-secondary">Fee {(r.fee_cents/100).toFixed(2)} {r.currency}</small></div>,<div key="credit">{formatUsd(r.added_cents)} added<small className="analytics-secondary">{formatUsd(r.reversed_cents)} reversed{r.reversal_due_cents>0?` · ${formatUsd(r.reversal_due_cents)} outstanding`:''}</small></div>,analyticsDate(r.created_at),analyticsDate(r.credited_at)]}))}/><Pagination f={f} {...result}/></section><p className="analytics-footnote">Top-up credit is customer funding, not service revenue or processor payout. Fees and tax are not customer credit. Manual adjustments are excluded.</p></>
  }
  if (!error && f.view === 'customers') {
    const result = analyticsRecords<CustomerRow>(f)
    report = <section className="panel"><header><div><h2>Customer insights</h2><p>All matching accounts, ranked by service spend in this period. Segments use lifetime paid purchases.</p></div><span>{result.total.toLocaleString()} accounts</span></header><Table headings={['Customer','Segment','Period activity','Service spend','Payment credits','Available / held now','Joined · Bangkok','Last paid purchase']} rows={result.rows.map(r=>({key:r.id,cells:[<Account key="account" id={r.id} name={r.username} email={r.email} f={f}/>,<div key="segment"><span className="badge badge--muted">{segmentLabels[r.segment]}</span><small className="analytics-secondary">{r.purchases} lifetime purchases{r.account_type==='admin'?' · Admin':''}</small></div>,<div key="activity">{r.requests} requests<small className="analytics-secondary">{r.free_checks} free checks</small></div>,formatUsd(r.spent_cents),<div key="payment">{formatUsd(r.added_cents)} added<small className="analytics-secondary">{formatUsd(r.reversed_cents)} reversed</small></div>,<div key="balance">{formatUsd(r.credit_cents-r.held_cents)}<small className="analytics-secondary">{formatUsd(r.held_cents)} held</small></div>,analyticsDate(r.created_at),analyticsDate(r.last_purchase_at)]}))}/><Pagination f={f} {...result}/><p className="analytics-footnote">Inactive buyer: no paid purchase in the last 30 days as of today. New registrations and free-only users remain in No paid purchase. Spending and funding use posting dates in your selected period.</p></section>
  }
  if (!error && f.view === 'behavior') {
    const result=analyticsBehavior(f)
    report=<section className="panel"><header><div><h2>Customer page engagement</h2><p>Consented, signed-in customers only · starts from this release · retained for 90 days.</p></div></header><Table headings={['Customer','GA4 User-ID','Page category','Visits','Active time','Last seen · Bangkok']} empty="No consented customer activity in this period yet. This report begins collecting after the feature is enabled." rows={result.rows.map(r=>({key:`${r.user_id}:${r.page}`,cells:[<Account key="account" id={r.user_id} name={r.username} email={r.email} f={f}/>,<span key="id" className="mono">{r.analytics_id}</span>,r.page,r.visits,`${Math.floor(r.active_ms/60000)}m ${Math.round(r.active_ms/1000)%60}s`,analyticsDate(r.last_seen_at)]}))}/><Pagination f={f} {...result}/><p className="analytics-footnote">Active time counts visible, focused pages and pauses after 60 seconds without interaction. It is an estimate, not proof of attention. Page categories omit private identifiers. Use the same User-ID in GA4 User Explorer to inspect account_page_view and account_page_engagement events. Usernames, email addresses and IP addresses are not sent to GA4. Anonymous visitors and administrators are excluded here.</p></section>
  }
  return <div className="admin-analytics"><div className="app-head"><div><span className="eyebrow">Control panel · Business insights</span><h1>Customer analytics</h1><p>Understand service demand, account funding and repeat customers.</p></div><Link className="button button--secondary" href="/admin">Control panel</Link></div>
    <nav className="analytics-tabs" aria-label="Analytics reports">{tabs.map(([view,label])=><Link key={view} aria-current={f.view===view?'page':undefined} href={analyticsUrl(f,{view,service:'',status:'all',method:'all',segment:'all'})}>{label}</Link>)}</nav>
    <Filters f={f} serviceOptions={options}/>
    {error ? <p role="alert" className="alert alert--error">{error}</p> : <><div className="analytics-report-heading"><div><h2>{heading}</h2><p>{f.from} — {f.to}</p></div><a className="button button--secondary" href={analyticsUrl(f,{},'/api/admin/analytics/export')} download>Download CSV ↓</a></div>{report}<p className="analytics-footnote">CSV includes the full filtered report, up to {ANALYTICS_EXPORT_LIMIT.toLocaleString()} rows. Overview exports daily totals. Balances and request statuses reflect the current state.</p></>}
  </div>
}
