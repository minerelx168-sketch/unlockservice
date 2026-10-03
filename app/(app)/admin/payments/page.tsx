import type { Metadata } from 'next'
import Link from 'next/link'
import { requireAdmin } from '@/lib/auth'
import { adminPaymentSummary, listAdminPaymentHistory, type AdminPaymentFilter, type AdminPaymentRow } from '@/lib/admin-payment-history'
import { formatUsd } from '@/lib/money'

export const metadata: Metadata = { title: 'Payment history | Control panel', robots: { index: false, follow: false } }
export const dynamic = 'force-dynamic'

const FILTERS: { id: AdminPaymentFilter; label: string }[] = [
  { id: 'all', label: 'All requests' },
  { id: 'open', label: 'Open' },
  { id: 'success', label: 'Paid & credited' },
  { id: 'closed', label: 'Closed' },
]

const NETWORKS: Record<string, string> = {
  'tron-mainnet': 'TRC-20',
  'bsc-mainnet': 'BEP-20',
  'ethereum-mainnet': 'ERC-20',
}

function paymentMethod(row: AdminPaymentRow): string {
  const network = NETWORKS[row.payment_network_id ?? '']
  if (network) return `${row.payment_asset_code ?? 'Token'} · ${network}`
  return row.gateway || 'Legacy payment request'
}

function paymentStatus(row: AdminPaymentRow): { label: string; className: string } {
  if (row.status === 'success') return { label: 'Paid & credited', className: 'badge badge--success' }
  if (row.status === 'failed') return { label: 'Closed', className: 'badge badge--error' }
  if (row.status === 'refunded') return { label: 'Refunded', className: 'badge badge--muted' }
  if (row.verification_status === 'manual_review') return { label: 'Needs review', className: 'badge badge--pending' }
  if (row.verification_status) return { label: 'Verifying transfer', className: 'badge badge--pending' }
  if (row.status === 'review') return { label: 'Checking', className: 'badge badge--pending' }
  return { label: 'Awaiting transfer', className: 'badge badge--muted' }
}

function utcDate(value: string | null): string {
  return value ? `${value.replace('T', ' ').slice(0, 16)} UTC` : '—'
}

function historyUrl(filter: AdminPaymentFilter, reference: string, page = 1): string {
  const query = new URLSearchParams()
  if (filter !== 'all') query.set('status', filter)
  if (reference) query.set('ref', reference)
  if (page > 1) query.set('page', String(page))
  return `/admin/payments${query.size ? `?${query}` : ''}`
}

export default async function AdminPaymentHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ref?: string; page?: string }>
}) {
  // Never query or render another customer's financial records before server-side RBAC.
  await requireAdmin()
  const params = await searchParams
  const filter = FILTERS.find(({ id }) => id === params.status)?.id ?? 'all'
  const rawReference = typeof params.ref === 'string' ? params.ref.slice(0, 64) : ''
  const requestedPage = typeof params.page === 'string' && /^[1-9]\d{0,8}$/.test(params.page) ? Number(params.page) : 1
  const summary = adminPaymentSummary()
  const history = listAdminPaymentHistory({ filter, reference: rawReference, page: requestedPage })
  const reference = history.invalidReference ? '' : rawReference.trim().toLowerCase()

  return (
    <>
      <div className="app-head">
        <div>
          <span className="eyebrow">Administration · Read-only</span>
          <h1>Payment history</h1>
          <p>Review payment requests across accounts. Only a verified, credited invoice counts as paid.</p>
        </div>
        <Link className="button button--secondary" href="/admin">Back to control panel</Link>
      </div>

      <div className="stat-grid">
        <div className="stat"><span className="label">All requests</span><span className="value">{summary.requests}</span><span className="caption">Including pending requests</span></div>
        <div className="stat"><span className="label">Awaiting payment or review</span><span className="value">{summary.open}</span><span className="caption">Not yet credited</span></div>
        <div className="stat"><span className="label">Paid & credited</span><span className="value">{summary.verified}</span><span className="caption">Completed invoices only</span></div>
        <div className="stat"><span className="label">Credit added from payments</span><span className="value">{formatUsd(summary.creditedCents)}</span><span className="caption">Verified invoices only</span></div>
      </div>

      <section className="panel payment-history-panel">
        <header>
          <div>
            <h2>Invoice records</h2>
            <p className="t-small">{history.total} matching request{history.total === 1 ? '' : 's'} · newest first · 25 per page</p>
          </div>
          <nav className="payment-filters" aria-label="Filter admin payment history">
            {FILTERS.map(({ id, label }) => (
              <Link key={id} href={historyUrl(id, reference)} className={filter === id ? 'payment-filter payment-filter--active' : 'payment-filter'} aria-current={filter === id ? 'page' : undefined}>{label}</Link>
            ))}
          </nav>
        </header>
        <div className="panel-body">
          <form className="admin-payment-search" action="/admin/payments" method="get" role="search">
            {filter !== 'all' ? <input type="hidden" name="status" value={filter} /> : null}
            <label htmlFor="admin-payment-reference">Find exact invoice reference</label>
            <input id="admin-payment-reference" name="ref" type="search" inputMode="text" pattern="[0-9a-fA-F]{32}" maxLength={32} defaultValue={rawReference} placeholder="32-character invoice reference" autoComplete="off" />
            <button className="button button--secondary" type="submit">Search</button>
            {rawReference ? <Link className="link-arrow" href={historyUrl(filter, '')}>Clear</Link> : null}
          </form>
          {history.invalidReference ? <p className="alert alert--error" role="alert">Enter a complete 32-character hexadecimal invoice reference.</p> : null}
          <p className="t-small">Pending means no verified payment or credited balance has been recorded. Transaction identifiers and wallet addresses are not shown in this history.</p>
        </div>
        <div className="table-wrap">
          <table role="table" className="grid account-table payment-table">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">Invoice</th>
                <th role="columnheader" scope="col">Account</th>
                <th role="columnheader" scope="col">Method</th>
                <th role="columnheader" scope="col" className="num">Credit</th>
                <th role="columnheader" scope="col" className="num">Amount due</th>
                <th role="columnheader" scope="col">Status</th>
                <th role="columnheader" scope="col">Created</th>
                <th role="columnheader" scope="col">Credited</th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {history.rows.map((invoice) => {
                const status = paymentStatus(invoice)
                return (
                  <tr role="row" key={invoice.reference}>
                    <td role="cell" className="mono" data-label="Invoice">{invoice.reference}</td>
                    <td role="cell" data-label="Account"><strong>{invoice.username}</strong><div className="t-small">{invoice.email}</div></td>
                    <td role="cell" data-label="Method">{paymentMethod(invoice)}</td>
                    <td role="cell" className="num" data-label="Credit">{formatUsd(invoice.credit_amount_cents)}</td>
                    <td role="cell" className="num" data-label="Amount due">{formatUsd(invoice.total_due_cents)} {invoice.currency !== 'USD' ? invoice.currency : ''}</td>
                    <td role="cell" data-label="Status"><span className={status.className}>{status.label}</span></td>
                    <td role="cell" data-label="Created">{utcDate(invoice.created_at)}</td>
                    <td role="cell" data-label="Credited">{utcDate(invoice.credited_at)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {history.rows.length === 0 ? <p className="empty">No payment requests match this filter.</p> : null}
        </div>
        {history.pageCount > 1 ? (
          <nav className="pager" aria-label="Payment history pages">
            {history.page > 1 ? <Link className="button button--secondary" href={historyUrl(filter, reference, history.page - 1)}>Previous</Link> : <span />}
            <span>Page {history.page} of {history.pageCount}</span>
            {history.page < history.pageCount ? <Link className="button button--secondary" href={historyUrl(filter, reference, history.page + 1)}>Next</Link> : <span />}
          </nav>
        ) : null}
      </section>
    </>
  )
}
