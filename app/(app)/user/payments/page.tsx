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
  success: 'Successful',
  review: 'In review',
  pending: 'Awaiting payment',
  failed: 'Closed',
  refunded: 'Refunded',
}

export default async function PaymentsPage() {
  const { user } = await requireSession()
  const money = creditSummary(user.id)
  const counts = invoiceSummary(user.id)
  const invoices = listInvoices(user.id)

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Payments</h1>
          <p>
            Failed provider checks that restored the held credit are counted separately, so service
            spending only reflects work that actually completed.
          </p>
        </div>
        <Link className="button button--accent" href="/user/add-funds">
          Add funds
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span className="label">Credit purchased</span>
          <span className="value">{formatUsd(money.purchasedCents)}</span>
          <span className="caption">{counts.successful} settled invoices</span>
        </div>
        <div className="stat">
          <span className="label">Credit used</span>
          <span className="value">{formatUsd(money.usedCents)}</span>
          <span className="caption">Completed checks only</span>
        </div>
        <div className="stat">
          <span className="label">Credit restored</span>
          <span className="value">{formatUsd(money.restoredCents)}</span>
          <span className="caption">Refunded after a failed lookup</span>
        </div>
        <div className="stat">
          <span className="label">Awaiting review</span>
          <span className="value">{counts.pendingReview}</span>
          <span className="caption">{counts.all} attempts in total</span>
        </div>
      </div>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <h2>Invoices</h2>
        </header>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Method</th>
                <th className="num">Credit</th>
                <th className="num">Total due</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {invoices.map((invoice) => (
                <tr key={invoice.reference}>
                  <td className="mono">{shortReference(invoice.reference)}</td>
                  <td>{invoice.gateway.replace(/_/g, ' ')}</td>
                  <td className="num">{formatUsd(invoice.credit_amount_cents)}</td>
                  <td className="num">{formatUsd(invoice.total_due_cents)}</td>
                  <td>
                    <span className={STATUS_BADGE[invoice.status] ?? 'badge badge--muted'}>
                      {STATUS_LABEL[invoice.status] ?? invoice.status}
                    </span>
                  </td>
                  <td>{invoice.created_at}</td>
                  <td>
                    <Link className="link-arrow" href={`/user/invoice/${invoice.reference}`}>
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {invoices.length === 0 ? <p className="empty">No invoices yet.</p> : null}
        </div>
      </section>
    </>
  )
}
