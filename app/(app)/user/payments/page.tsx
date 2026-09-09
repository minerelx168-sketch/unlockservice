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
            Orders a carrier refused put their held credit straight back, and are counted
            separately — so spending only reflects unlocks that were actually delivered.
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
          <span className="label">Spent on unlocks</span>
          <span className="value">{formatUsd(money.usedCents)}</span>
          <span className="caption">Delivered orders only</span>
        </div>
        <div className="stat">
          <span className="label">Credit restored</span>
          <span className="value">{formatUsd(money.restoredCents)}</span>
          <span className="caption">Returned on refused devices</span>
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
          <table role="table" className="grid account-table">
            <thead role="rowgroup">
              <tr role="row">
                <th role="columnheader" scope="col">Invoice</th>
                <th role="columnheader" scope="col">Method</th>
                <th role="columnheader" scope="col" className="num">Credit</th>
                <th role="columnheader" scope="col" className="num">Total due</th>
                <th role="columnheader" scope="col">Status</th>
                <th role="columnheader" scope="col">Created</th>
                <th role="columnheader" scope="col"><span className="visually-hidden">Action</span></th>
              </tr>
            </thead>
            <tbody role="rowgroup">
              {invoices.map((invoice) => (
                <tr role="row" key={invoice.reference}>
                  <td role="cell" className="mono" data-label="Invoice">{shortReference(invoice.reference)}</td>
                  <td role="cell" data-label="Method">{invoice.gateway.replace(/_/g, ' ')}</td>
                  <td role="cell" className="num" data-label="Credit">{formatUsd(invoice.credit_amount_cents)}</td>
                  <td role="cell" className="num" data-label="Total due">{formatUsd(invoice.total_due_cents)}</td>
                  <td role="cell" data-label="Status">
                    <span className={STATUS_BADGE[invoice.status] ?? 'badge badge--muted'}>
                      {STATUS_LABEL[invoice.status] ?? invoice.status}
                    </span>
                  </td>
                  <td role="cell" data-label="Created">{invoice.created_at}</td>
                  <td role="cell" className="account-table-action" data-label="Action">
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
