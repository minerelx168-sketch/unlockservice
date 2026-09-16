import type { Metadata } from 'next'
import Link from 'next/link'
import { requireSession } from '@/lib/auth'
import { creditSummary } from '@/lib/credits'
import { formatUsd } from '@/lib/money'
import { invoiceSummary, listInvoices, shortReference } from '@/lib/payments'

export const metadata: Metadata = { title: 'Payments' }
export const dynamic = 'force-dynamic'

const STATUS_BADGE: Record<string, string> = {
  success: 'badge badge--success',
  review: 'badge badge--pending',
  pending: 'badge badge--muted',
  failed: 'badge badge--error',
  refunded: 'badge badge--muted',
}

const STATUS_LABEL: Record<string, string> = {
  success: 'Verified',
  review: 'Checking',
  pending: 'Awaiting transfer',
  failed: 'Closed',
  refunded: 'Refunded',
}

const FILTERS = [
  { id: 'all', label: 'All payments' },
  { id: 'open', label: 'Open' },
  { id: 'success', label: 'Verified' },
  { id: 'closed', label: 'Closed' },
] as const

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { user } = await requireSession()
  const money = creditSummary(user.id)
  const counts = invoiceSummary(user.id)
  const requestedFilter = (await searchParams).status ?? 'all'
  const activeFilter = FILTERS.some((entry) => entry.id === requestedFilter) ? requestedFilter : 'all'
  const allInvoices = listInvoices(user.id, 100)
  const invoices = allInvoices.filter((invoice) => {
    if (activeFilter === 'open') return invoice.status === 'pending' || invoice.status === 'review'
    if (activeFilter === 'success') return invoice.status === 'success'
    if (activeFilter === 'closed') return invoice.status === 'failed' || invoice.status === 'refunded'
    return true
  })

  return (
    <>
      <div className="app-head payments-head">
        <div>
          <span className="eyebrow">Balance and payment requests</span>
          <h1>Payments</h1>
          <p>Track every request from transfer to on-chain verification. Credit is added only after settlement checks pass.</p>
        </div>
        <Link className="button button--accent" href="/user/add-funds">Add funds</Link>
      </div>

      <div className="stat-grid payment-stats">
        <div className="stat">
          <span className="label">Credit purchased</span>
          <span className="value">{formatUsd(money.purchasedCents)}</span>
          <span className="caption">{counts.successful} verified payments</span>
        </div>
        <div className="stat">
          <span className="label">Open requests</span>
          <span className="value">{counts.pendingReview}</span>
          <span className="caption">Awaiting transfer or checks</span>
        </div>
        <div className="stat">
          <span className="label">Spent on services</span>
          <span className="value">{formatUsd(money.usedCents)}</span>
          <span className="caption">Delivered orders only</span>
        </div>
        <div className="stat">
          <span className="label">Credit restored</span>
          <span className="value">{formatUsd(money.restoredCents)}</span>
          <span className="caption">Released from unavailable orders</span>
        </div>
      </div>

      <section className="panel payment-history-panel">
        <header>
          <div>
            <h2>Payment history</h2>
            <p className="t-small">{counts.all} total requests</p>
          </div>
          <nav className="payment-filters" aria-label="Filter payment history">
            {FILTERS.map((filter) => (
              <Link
                key={filter.id}
                className={activeFilter === filter.id ? 'payment-filter payment-filter--active' : 'payment-filter'}
                href={filter.id === 'all' ? '/user/payments' : `/user/payments?status=${filter.id}`}
                aria-current={activeFilter === filter.id ? 'page' : undefined}
              >
                {filter.label}
              </Link>
            ))}
          </nav>
        </header>
        <div className="table-wrap">
          <table role="table" className="grid account-table payment-table">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">Request</th>
                <th role="columnheader" scope="col">Method</th>
                <th role="columnheader" scope="col" className="num">Credit amount</th>
                <th role="columnheader" scope="col" className="num">Transfer / request</th>
                <th role="columnheader" scope="col">Status</th>
                <th role="columnheader" scope="col">Created</th>
                <th role="columnheader" scope="col"><span className="visually-hidden">Action</span></th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {invoices.map((invoice) => (
                <tr role="row" key={invoice.reference}>
                  <td role="cell" className="mono" data-label="Request">{shortReference(invoice.reference)}</td>
                  <td role="cell" data-label="Method">USDT · BNB Smart Chain</td>
                  <td role="cell" className="num" data-label="Credit amount">{formatUsd(invoice.credit_amount_cents)}</td>
                  <td role="cell" className="num" data-label="Transfer / request">{formatUsd(invoice.total_due_cents)}</td>
                  <td role="cell" data-label="Status">
                    <span className={STATUS_BADGE[invoice.status] ?? 'badge badge--muted'}>
                      {STATUS_LABEL[invoice.status] ?? invoice.status}
                    </span>
                  </td>
                  <td role="cell" data-label="Created">{invoice.created_at}</td>
                  <td role="cell" className="account-table-action" data-label="Action">
                    <Link className="link-arrow" href={`/user/invoice/${invoice.reference}`}>
                      {invoice.status === 'pending' ? 'Continue' : 'View details'}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 ? (
            <div className="empty payment-empty">
              <p>No payments match this filter.</p>
              <Link className="button button--secondary" href="/user/add-funds">Create payment request</Link>
            </div>
          ) : null}
        </div>
      </section>
    </>
  )
}
