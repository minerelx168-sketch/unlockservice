import { db } from './db'

export const ANALYTICS_PAGE_SIZE = 25
export const ANALYTICS_EXPORT_LIMIT = 10_000
export const ANALYTICS_VIEWS = ['overview', 'services', 'payments', 'customers', 'behavior'] as const
export type AnalyticsView = typeof ANALYTICS_VIEWS[number]
export type AnalyticsParams = Record<string, string | string[] | undefined>
export type AnalyticsFilters = {
  view: AnalyticsView; from: string; to: string; since: string; until: string
  q: string; user: number; admins: boolean; service: string; status: string; method: string; segment: string; page: number
}
export class AnalyticsError extends Error {}
const day = 86_400_000
const first = (value: string | string[] | undefined) => typeof value === 'string' ? value : ''
const pick = (value: string, allowed: readonly string[], fallback = 'all') => allowed.includes(value) ? value : fallback
export function bangkokDay(now = Date.now()) { return new Date(now + 7 * 3_600_000).toISOString().slice(0, 10) }
function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
}
export function parseAnalyticsFilters(input: AnalyticsParams, now = Date.now()): AnalyticsFilters {
  const view = pick(first(input.view), ANALYTICS_VIEWS, 'overview') as AnalyticsView
  const from = first(input.from) || bangkokDay(now - 29 * day), to = first(input.to) || bangkokDay(now)
  if (!validDate(from) || !validDate(to) || from > to || Date.parse(to) - Date.parse(from) >= 366 * day) {
    throw new AnalyticsError('Choose a valid date range of up to 366 days, with the start date before the end date.')
  }
  const since = new Date(`${from}T00:00:00+07:00`).toISOString()
  const until = new Date(Date.parse(`${to}T00:00:00+07:00`) + day).toISOString()
  return { view, from, to, since, until, q: first(input.q).trim().slice(0, 100),
    user: /^[1-9]\d{0,8}$/.test(first(input.user)) ? Number(input.user) : 0,
    admins: first(input.admins) === '1', service: view === 'services' ? first(input.service).slice(0, 160) : '',
    status: pick(first(input.status), view === 'payments' ? ['all', 'pending', 'review', 'success', 'failed', 'refunded'] : ['all', 'completed', 'processing', 'review', 'refunded', 'failed']),
    method: view === 'payments' ? pick(first(input.method), ['all', 'card', 'crypto']) : 'all',
    segment: view === 'customers' ? pick(first(input.segment), ['all', 'no_purchase', 'once', 'repeat', 'inactive']) : 'all',
    page: /^[1-9]\d{0,6}$/.test(first(input.page)) ? Number(input.page) : 1 }
}
export function analyticsUrl(f: AnalyticsFilters, changes: Record<string, string | number | boolean> = {}, path = '/admin/analytics') {
  const values = { view: f.view, from: f.from, to: f.to, q: f.q, user: f.user || '', admins: f.admins ? '1' : '', service: f.service, status: f.status, method: f.method, segment: f.segment, page: 1, ...changes }
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) if (value !== '' && value !== 'all' && !(key === 'page' && value === 1)) query.set(key, String(value))
  return `${path}?${query}`
}
function bindings(f: AnalyticsFilters) {
  const escaped = f.q.replace(/[\\%_]/g, '\\$&')
  return { ...f, admins: f.admins ? 1 : 0, search: `%${escaped}%` }
}

// All customer data is selected only after the caller enforces administrator access.
// No identifiers, result payloads, tokens, wallet addresses or click IDs are selected.
const BASE = `WITH people AS (
 SELECT id,username,email,account_type,credit_cents,held_cents,created_at FROM users
 WHERE (@admins=1 OR account_type!='admin') AND (@user=0 OR id=@user)
 AND (@q='' OR username LIKE @search ESCAPE '\\' OR email LIKE @search ESCAPE '\\')
), charges AS (
 SELECT user_id,ref_type,ref_id,-SUM(amount_cents) AS charged_cents,MAX(datetime(created_at)) AS charged_at
 FROM credit_ledger WHERE type='charge' AND affects_balance=1 GROUP BY user_id,ref_type,ref_id
), raw_usage AS (
 SELECT 'order-'||o.id AS reference, o.id AS item_id, 'order' AS order_type, o.user_id,
 CASE WHEN o.kind='carrier_unlock' THEN 'carrier:'||COALESCE(o.carrier_id,0) ELSE 'device:'||COALESCE(o.service_id,0) END AS service_key,
 CASE WHEN o.kind='carrier_unlock' THEN COALESCE(c.name,'Carrier')||' unlock' ELSE COALESCE(d.name,o.kind) END AS service,
 'Unlock / device' AS category, o.status AS original_status,
 CASE o.status WHEN 'delivered' THEN 'completed' WHEN 'unavailable' THEN 'refunded' ELSE 'processing' END AS status,
 o.price_cents, COALESCE(l.charged_cents,0) AS charged_cents, l.charged_at, datetime(o.created_at) AS created_at, o.source
 FROM orders o LEFT JOIN carriers c ON c.id=o.carrier_id LEFT JOIN device_services d ON d.id=o.service_id
 LEFT JOIN charges l ON l.user_id=o.user_id AND l.ref_type='order' AND l.ref_id=CAST(o.id AS TEXT)
 UNION ALL
 SELECT 'report-'||o.id,o.id,'paid_report_order',o.user_id,'report:'||o.product_code,o.product_name,'Paid report',o.status,
 CASE WHEN o.status='manual_review' THEN 'review' ELSE o.status END,
 o.price_cents,COALESCE(l.charged_cents,0),l.charged_at,datetime(o.created_at),o.source
 FROM paid_report_orders o LEFT JOIN charges l ON l.user_id=o.user_id AND l.ref_type='paid_imei_report' AND l.ref_id=CAST(o.id AS TEXT)
 UNION ALL
 SELECT 'check-'||o.id,o.id,'free_check',o.user_id,'free:'||o.check_type,'Free '||o.check_type||' check','Free check',o.status,
 CASE o.status WHEN 'queued' THEN 'processing' WHEN 'unavailable' THEN 'failed' ELSE o.status END,
 0,0,NULL,datetime(o.created_at),'website' FROM imei_checks o
), usage AS (
 SELECT r.*,p.username,p.email,CASE WHEN a.order_id IS NOT NULL AND
 (COALESCE(a.gclid,'')!='' OR COALESCE(a.gbraid,'')!='' OR COALESCE(a.wbraid,'')!='') THEN 'Google Ads click recorded'
 WHEN r.source='api' THEN 'API' ELSE 'Unattributed / other' END AS channel
 FROM raw_usage r JOIN people p ON p.id=r.user_id LEFT JOIN order_attribution a ON a.order_type=r.order_type AND a.order_id=r.item_id AND a.consent_state='granted'
), period_usage AS (
 SELECT * FROM usage WHERE created_at>=datetime(@since) AND created_at<datetime(@until)
 AND (@service='' OR service_key=@service) AND (@view!='services' OR @status='all' OR status=@status)
), invoice_credits AS (
 SELECT user_id,ref_id,SUM(amount_cents) AS added_cents FROM credit_ledger
 WHERE ref_type='invoice' AND type='topup' AND affects_balance=1 GROUP BY user_id,ref_id
), funding AS (
 SELECT i.reference,i.user_id,p.username,p.email,i.gateway,i.status,i.currency,i.fee_cents,i.tax_cents,
 i.total_due_cents,i.credit_amount_cents,datetime(i.created_at) AS created_at,datetime(i.credited_at) AS credited_at,
 COALESCE(c.added_cents,0) AS added_cents,COALESCE(w.reversed_cents,0) AS reversed_cents,
 COALESCE(w.reversal_due_cents,0) AS reversal_due_cents,
 CASE WHEN i.gateway='whop_card' THEN 'Card · Whop' ELSE COALESCE(i.payment_asset_code,i.gateway)||CASE WHEN i.payment_network_id IS NOT NULL THEN ' · '||i.payment_network_id ELSE '' END END AS method
 FROM invoices i JOIN people p ON p.id=i.user_id LEFT JOIN invoice_credits c ON c.user_id=i.user_id AND c.ref_id=i.reference
 LEFT JOIN whop_topups w ON w.invoice_reference=i.reference
), period_funding AS (
 SELECT * FROM funding WHERE created_at>=datetime(@since) AND created_at<datetime(@until)
 AND (@view!='payments' OR @status='all' OR status=@status)
 AND (@method='all' OR (@method='card' AND gateway='whop_card') OR (@method='crypto' AND gateway!='whop_card'))
), money AS (
 SELECT l.* FROM credit_ledger l JOIN people p ON p.id=l.user_id
 WHERE l.affects_balance=1 AND datetime(l.created_at)>=datetime(@since) AND datetime(l.created_at)<datetime(@until)
), customer_totals AS (
 SELECT p.*,COALESCE(s.requests,0) AS requests,COALESCE(s.free_checks,0) AS free_checks,
 COALESCE(l.purchases,0) AS purchases,l.last_purchase_at,
 COALESCE(m.spent_cents,0) AS spent_cents,COALESCE(m.added_cents,0) AS added_cents,COALESCE(m.reversed_cents,0) AS reversed_cents,
 CASE WHEN COALESCE(l.purchases,0)=0 THEN 'no_purchase'
 WHEN datetime(l.last_purchase_at)<datetime('now','-30 days') THEN 'inactive'
 WHEN l.purchases>=2 THEN 'repeat' ELSE 'once' END AS segment
 FROM people p
 LEFT JOIN (SELECT user_id,COUNT(*) AS requests,SUM(CASE WHEN category='Free check' THEN 1 ELSE 0 END) AS free_checks FROM period_usage GROUP BY user_id) s ON s.user_id=p.id
 LEFT JOIN (SELECT user_id,COUNT(*) AS purchases,MAX(charged_at) AS last_purchase_at FROM usage WHERE charged_cents>0 GROUP BY user_id) l ON l.user_id=p.id
 LEFT JOIN (SELECT user_id,SUM(CASE WHEN type='charge' AND ref_type IN ('order','paid_imei_report') THEN -amount_cents ELSE 0 END) AS spent_cents,
 SUM(CASE WHEN type='topup' AND ref_type='invoice' THEN amount_cents ELSE 0 END) AS added_cents,
 SUM(CASE WHEN ref_type='whop_refund' THEN -amount_cents ELSE 0 END) AS reversed_cents FROM money GROUP BY user_id) m ON m.user_id=p.id
)`
function all<T>(f: AnalyticsFilters, sql: string) { return db().prepare(BASE + sql).all(bindings(f)) as T[] }
function one<T>(f: AnalyticsFilters, sql: string) { return db().prepare(BASE + sql).get(bindings(f)) as T }
export type UsageRow = { reference: string; user_id: number; username: string; email: string; service_key: string; service: string; category: string; status: string; price_cents: number; charged_cents: number; created_at: string; channel: string }
export type FundingRow = { reference: string; user_id: number; username: string; email: string; method: string; status: string; currency: string; credit_amount_cents: number; total_due_cents: number; fee_cents: number; added_cents: number; reversed_cents: number; reversal_due_cents: number; created_at: string; credited_at: string | null }
export type CustomerRow = { id: number; username: string; email: string; account_type: string; credit_cents: number; held_cents: number; created_at: string; requests: number; free_checks: number; purchases: number; last_purchase_at: string | null; spent_cents: number; added_cents: number; reversed_cents: number; segment: string }
export type ServiceSummary = { service_key: string; service: string; category: string; requests: number; customers: number; completed: number; charged_cents: number }
export type Overview = { spent_cents: number; added_cents: number; reversed_cents: number; new_customers: number; active_customers: number; requests: number; free_checks: number; purchasers: number; repeat_purchasers: number }
export type TrendRow = { date: string; spent_cents: number; added_cents: number; reversed_cents: number }
export function analyticsOverview(f: AnalyticsFilters): Overview {
  return one(f, ` SELECT
 COALESCE((SELECT SUM(-amount_cents) FROM money WHERE type='charge' AND ref_type IN ('order','paid_imei_report')),0) AS spent_cents,
 COALESCE((SELECT SUM(amount_cents) FROM money WHERE type='topup' AND ref_type='invoice'),0) AS added_cents,
 COALESCE((SELECT SUM(-amount_cents) FROM money WHERE ref_type='whop_refund'),0) AS reversed_cents,
 (SELECT COUNT(*) FROM people WHERE datetime(created_at)>=datetime(@since) AND datetime(created_at)<datetime(@until)) AS new_customers,
 (SELECT COUNT(DISTINCT user_id) FROM (SELECT user_id FROM period_usage UNION SELECT user_id FROM money)) AS active_customers,
 (SELECT COUNT(*) FROM period_usage) AS requests,
 (SELECT COUNT(*) FROM period_usage WHERE category='Free check') AS free_checks,
 (SELECT COUNT(DISTINCT user_id) FROM money WHERE type='charge' AND ref_type IN ('order','paid_imei_report')) AS purchasers,
 (SELECT COUNT(*) FROM customer_totals WHERE purchases>=2 AND spent_cents>0) AS repeat_purchasers`)
}
export function analyticsTrend(f: AnalyticsFilters): TrendRow[] {
  const rows = all<TrendRow>(f, ` SELECT date(created_at,'+7 hours') AS date,
 SUM(CASE WHEN type='charge' AND ref_type IN ('order','paid_imei_report') THEN -amount_cents ELSE 0 END) AS spent_cents,
 SUM(CASE WHEN type='topup' AND ref_type='invoice' THEN amount_cents ELSE 0 END) AS added_cents,
 SUM(CASE WHEN ref_type='whop_refund' THEN -amount_cents ELSE 0 END) AS reversed_cents
 FROM money GROUP BY date(created_at,'+7 hours') ORDER BY date`)
  const map = new Map(rows.map(row => [row.date, row]))
  const result: TrendRow[] = []
  for (let date = Date.parse(f.from); date <= Date.parse(f.to); date += day) {
    const key = new Date(date).toISOString().slice(0, 10)
    result.push(map.get(key) ?? { date: key, spent_cents: 0, added_cents: 0, reversed_cents: 0 })
  }
  return result
}
export function analyticsServices(f: AnalyticsFilters): ServiceSummary[] {
  return all(f, ` SELECT service_key,MAX(service) AS service,MAX(category) AS category,COUNT(*) AS requests,COUNT(DISTINCT user_id) AS customers,
 SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed,SUM(charged_cents) AS charged_cents FROM period_usage GROUP BY service_key ORDER BY charged_cents DESC,requests DESC,service_key LIMIT 1001`)
}
export function analyticsChannels(f: AnalyticsFilters) {
  return all<{ channel: string; requests: number; customers: number; charged_cents: number }>(f, ` SELECT channel,COUNT(*) AS requests,COUNT(DISTINCT user_id) AS customers,SUM(charged_cents) AS charged_cents FROM period_usage GROUP BY channel ORDER BY requests DESC`)
}
export function analyticsServiceOptions(f: AnalyticsFilters) {
  return all<{ service_key: string; service: string }>(f, ` SELECT service_key,MAX(service) AS service FROM usage GROUP BY service_key ORDER BY service LIMIT 1000`)
}
const TABLES = { services: 'period_usage', payments: 'period_funding', customers: 'customer_totals' } as const
const COLUMNS = {
  services: 'reference,user_id,username,email,service_key,service,category,status,price_cents,charged_cents,created_at,channel',
  payments: 'reference,user_id,username,email,method,status,currency,credit_amount_cents,total_due_cents,fee_cents,added_cents,reversed_cents,reversal_due_cents,created_at,credited_at',
  customers: 'id,username,email,account_type,credit_cents,held_cents,created_at,requests,free_checks,purchases,last_purchase_at,spent_cents,added_cents,reversed_cents,segment',
} as const
export function analyticsRecords<T extends UsageRow | FundingRow | CustomerRow>(f: AnalyticsFilters, exporting = false) {
  const view = f.view === 'overview' || f.view === 'behavior' ? 'services' : f.view
  const where = view === 'customers' ? " WHERE (@segment='all' OR segment=@segment)" : ''
  const total = one<{ n: number }>(f, ` SELECT COUNT(*) AS n FROM ${TABLES[view]}${where}`).n
  if (exporting && total > ANALYTICS_EXPORT_LIMIT) throw new AnalyticsError(`This export has ${total.toLocaleString()} records. Narrow your filters to ${ANALYTICS_EXPORT_LIMIT.toLocaleString()} or fewer records.`)
  const pages = Math.max(1, Math.ceil(total / ANALYTICS_PAGE_SIZE)), page = Math.min(f.page, pages)
  const order = view === 'customers' ? 'spent_cents DESC,added_cents DESC,datetime(created_at) DESC,id DESC' : 'created_at DESC,reference DESC'
  const limit = exporting ? ANALYTICS_EXPORT_LIMIT : ANALYTICS_PAGE_SIZE
  const offset = exporting ? 0 : (page - 1) * ANALYTICS_PAGE_SIZE
  const rows = all<T>(f, ` SELECT ${COLUMNS[view]} FROM ${TABLES[view]}${where} ORDER BY ${order} LIMIT ${limit} OFFSET ${offset}`)
  return { rows, total, page, pages }
}
export function analyticsPaymentTotals(f: AnalyticsFilters) {
  return one<{ requests: number; added_cents: number; reversed_cents: number; reversal_due_cents: number }>(f, ` SELECT COUNT(*) AS requests,COALESCE(SUM(added_cents),0) AS added_cents,COALESCE(SUM(reversed_cents),0) AS reversed_cents,COALESCE(SUM(reversal_due_cents),0) AS reversal_due_cents FROM period_funding`)
}
export function analyticsDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : value.replace(' ', 'T') + 'Z')
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Bangkok', dateStyle: 'medium', timeStyle: 'short' }).format(date) : '—'
}
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value)
  if (typeof value === 'string' && /^[\s\u0000-\u001f]*[=+@-]/.test(text)) text = "'" + text
  return '"' + text.replaceAll('"', '""') + '"'
}
export function analyticsCsv(f: AnalyticsFilters): string {
  let headers: string[], rows: unknown[][]
  const usd = (cents: number) => (cents / 100).toFixed(2)
  if (f.view === 'overview') {
    headers = ['Date (Asia/Bangkok)', 'Service charges USD', 'Payment credits USD', 'Payment credit reversals USD']
    rows = analyticsTrend(f).map(r => [r.date, usd(r.spent_cents), usd(r.added_cents), usd(r.reversed_cents)])
  } else if (f.view === 'services') {
    headers = ['Reference', 'Customer ID', 'Username', 'Email', 'Service', 'Category', 'Status', 'Order value USD', 'Charged USD', 'Created (Asia/Bangkok)', 'Recorded channel']
    rows = analyticsRecords<UsageRow>(f, true).rows.map(r => [r.reference, r.user_id, r.username, r.email, r.service, r.category, r.status, usd(r.price_cents), usd(r.charged_cents), analyticsDate(r.created_at), r.channel])
  } else if (f.view === 'payments') {
    headers = ['Invoice', 'Customer ID', 'Username', 'Email', 'Method', 'Status', 'Currency', 'Requested credit', 'Amount due', 'Invoice fee', 'Credit added USD', 'Credit reversed USD', 'Reversal outstanding USD', 'Created (Asia/Bangkok)', 'Credited (Asia/Bangkok)']
    rows = analyticsRecords<FundingRow>(f, true).rows.map(r => [r.reference,r.user_id,r.username,r.email,r.method,r.status,r.currency,usd(r.credit_amount_cents),usd(r.total_due_cents),usd(r.fee_cents),usd(r.added_cents),usd(r.reversed_cents),usd(r.reversal_due_cents),analyticsDate(r.created_at),analyticsDate(r.credited_at)])
  } else if (f.view === 'behavior') {
    headers = ['Customer ID','Username','Email','GA4 User-ID','Page category','Visits','Active seconds','Last seen (Asia/Bangkok)']
    rows = analyticsBehavior(f,true).rows.map(r=>[r.user_id,r.username,r.email,r.analytics_id,r.page,r.visits,Math.round(r.active_ms/1000),analyticsDate(r.last_seen_at)])
  } else {
    headers = ['Customer ID', 'Username', 'Email', 'Role', 'Segment', 'Requests in period', 'Free checks in period', 'Lifetime paid purchases', 'Service charges USD in period', 'Payment credits USD in period', 'Credit reversed USD in period', 'Available credit USD now', 'Held credit USD now', 'Joined (Asia/Bangkok)', 'Last purchase (Asia/Bangkok)']
    rows = analyticsRecords<CustomerRow>(f, true).rows.map(r => [r.id,r.username,r.email,r.account_type,r.segment,r.requests,r.free_checks,r.purchases,usd(r.spent_cents),usd(r.added_cents),usd(r.reversed_cents),usd(r.credit_cents-r.held_cents),usd(r.held_cents),analyticsDate(r.created_at),analyticsDate(r.last_purchase_at)])
  }
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

export type BehaviorRow = { user_id:number; username:string; email:string; analytics_id:string; page:string; visits:number; active_ms:number; last_seen_at:string }
export function analyticsBehavior(f: AnalyticsFilters, exporting = false) {
  const sql = ` FROM customer_page_visits v JOIN people p ON p.id=v.user_id JOIN analytics_identities a ON a.user_id=v.user_id
 WHERE datetime(v.started_at)>=datetime(@since) AND datetime(v.started_at)<datetime(@until) AND datetime(v.started_at)>=datetime('now','-90 days')`
  const total=one<{n:number}>(f,` SELECT COUNT(*) AS n FROM (SELECT v.user_id,v.page${sql} GROUP BY v.user_id,v.page)`).n
  if(exporting && total>ANALYTICS_EXPORT_LIMIT) throw new AnalyticsError('Narrow your filters to 10,000 or fewer customer/page combinations.')
  const pages=Math.max(1,Math.ceil(total/ANALYTICS_PAGE_SIZE)),page=Math.min(f.page,pages)
  const rows=all<BehaviorRow>(f,` SELECT v.user_id,p.username,p.email,a.analytics_id,v.page,COUNT(*) AS visits,SUM(v.active_ms) AS active_ms,MAX(v.last_seen_at) AS last_seen_at${sql} GROUP BY v.user_id,v.page ORDER BY last_seen_at DESC,v.user_id,v.page LIMIT ${exporting?ANALYTICS_EXPORT_LIMIT:ANALYTICS_PAGE_SIZE} OFFSET ${exporting?0:(page-1)*ANALYTICS_PAGE_SIZE}`)
  return {rows,total,page,pages}
}
export function analyticsPreviousPeriod(f:AnalyticsFilters): AnalyticsFilters {
  const length=Date.parse(f.to)-Date.parse(f.from)+day
  return parseAnalyticsFilters({ ...Object.fromEntries(new URL(analyticsUrl(f),'https://iunlockmobile.com').searchParams),from:new Date(Date.parse(f.from)-length).toISOString().slice(0,10),to:new Date(Date.parse(f.from)-day).toISOString().slice(0,10) })
}
export function growthLabel(current:number,previous:number) {
  if(previous===0) return current===0?'No change':'New sales · no prior sales'
  const percent=(current-previous)/previous*100
  return `${percent>0?'+':''}${percent.toFixed(1)}% vs previous period`
}
