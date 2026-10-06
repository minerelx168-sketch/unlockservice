import type { Metadata } from 'next'
import Link from 'next/link'
import { adminOverview, listAdminUsers } from '@/lib/admin'
import { listAdminCreditAdjustments } from '@/lib/admin-credit-adjustments'
import { requireAdmin } from '@/lib/auth'
import { formatUsd } from '@/lib/money'
import { AdminCreditAdjustment } from '@/components/admin-credit-adjustment'
import { AdminInvoiceReviewQueue } from '@/components/admin-invoice-review'
import { listAdminInvoiceReviews } from '@/lib/payment-verification'
import { AdminUnmatchedTransfers } from '@/components/admin-unmatched-transfers'
import { formatE4 } from '@/lib/payment-codes'
import { paymentRouteDefinition, paymentTransactionUrl } from '@/lib/payment-config'
import { unmatchedTransfers, watcherHealth } from '@/lib/payment-watcher'

export const metadata: Metadata = { title: 'Control panel' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { user: administrator, session } = await requireAdmin()
  const overview = adminOverview()
  const users = listAdminUsers(100)
  const adjustments = listAdminCreditAdjustments(25)
  const invoiceReviews = listAdminInvoiceReviews(50)
  const strays = unmatchedTransfers(50)
  const watch = watcherHealth()
  const strayItems = strays.rows.map((row) => {
    const route = paymentRouteDefinition(row.route_id)
    return {
      id: row.id,
      route_label: route ? `${route.asset} · ${route.network}` : row.route_id,
      tx_hash: row.tx_hash,
      explorer_url: paymentTransactionUrl(row.route_id, row.tx_hash),
      from_address: row.from_address,
      amount: `${formatE4(row.amount_e4)} ${route?.asset ?? ''}`.trim(),
      block_time: row.block_time,
      note: row.note,
      candidates: row.candidates.map((candidate) => ({
        reference: candidate.reference,
        username: candidate.username,
        amount: candidate.payment_amount_e4 !== null ? formatE4(candidate.payment_amount_e4) : null,
      })),
    }
  })

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Control panel</h1>
          <p>Signed in as {administrator.username}. Administrator access and every financial mutation are enforced on the server.</p>
        </div>
        <Link className="button button--secondary" href="/admin/payments">View payment history</Link>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span className="label">Accounts</span>
          <span className="value">{overview.users}</span>
          <span className="caption">{overview.activeUsers} active</span>
        </div>
        <div className="stat">
          <span className="label">Administrators</span>
          <span className="value">{overview.admins}</span>
          <span className="caption">Server-side RBAC enabled</span>
        </div>
        <div className="stat">
          <span className="label">Orders</span>
          <span className="value">{overview.orders}</span>
          <span className="caption">{overview.processingOrders} processing</span>
        </div>
        <div className="stat">
          <span className="label">Invoices awaiting review</span>
          <span className="value">{overview.pendingInvoices}</span>
          <span className="caption">Pending or under review</span>
        </div>
      </div>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <div>
            <h2>Adjust user credit</h2>
            <p className="t-small">Add or remove USD credit through the existing append-only ledger. A reason and confirmation are required.</p>
          </div>
          <span>Maximum ±{formatUsd(1_000_000)} per action</span>
        </header>
        <div className="panel-body">
          <AdminCreditAdjustment csrfToken={session.csrfToken} users={users} />
        </div>
      </section>

      <div style={{ height: 22 }} />

      <section className="panel admin-invoice-review-panel" id="payment-verification">
        <header>
          <div>
            <h2>Payment verification queue</h2>
            <p className="t-small">For manual payments, confirm customer ownership independently, then use Confirm manual payment &amp; credit below. The server rereads the chain receipt, applies only verified credit once, and audits the decision.</p>
          </div>
          <span>{invoiceReviews.length} awaiting decision</span>
        </header>
        <div className="panel-body">
          <AdminInvoiceReviewQueue csrfToken={session.csrfToken} items={invoiceReviews} />
        </div>
      </section>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <div>
            <h2>Unmatched transfers — manual payment check</h2>
            <p className="t-small">
              Exchange withdrawal fees can change an invoice code, including on deposits below $1. A nearby amount is never proof of the payer.
              Verify customer ownership first, then use Verify &amp; associate to reread the receipt. For code-changed payments,
              credit is added only after the separate Confirm manual payment &amp; credit action in the verification queue above.
              Reject or Dismiss closes the transfer without a refund or credit. If no payment request exists, investigate
              independently before using Adjust user credit, then Dismiss with the adjustment reference.
            </p>
          </div>
          <span>{strays.total} open</span>
        </header>
        <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
          <div className="watcher-health">
            {watch.length === 0 ? <span>No payment route is enabled.</span> : null}
            {watch.map((route) => (
              <span key={route.routeId}>
                <strong>{route.label}</strong>:{' '}
                {!route.watched
                  ? 'paste only'
                  : route.lastError
                    ? `watcher failing (${route.lastError})`
                    : route.lastOkAt
                      ? `watched, last good scan ${route.lastOkAt.replace('T', ' ').slice(0, 16)} UTC`
                      : 'watched, no scan yet'}
              </span>
            ))}
          </div>
          <AdminUnmatchedTransfers csrfToken={session.csrfToken} items={strayItems} total={strays.total} />
        </div>
      </section>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <div>
            <h2>Recent credit adjustments</h2>
            <p className="t-small">Permanent administrator audit. Rows cannot be edited or deleted.</p>
          </div>
          <span>{adjustments.length} shown</span>
        </header>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Reference</th>
                <th>User</th>
                <th>Administrator</th>
                <th className="num">Amount</th>
                <th className="num">Available after</th>
                <th>Reason</th>
                <th>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adjustment) => (
                <tr key={adjustment.public_id}>
                  <td className="mono">{adjustment.public_id}</td>
                  <td>
                    <strong>{adjustment.target_username}</strong>
                    <div className="t-small">{adjustment.target_email}</div>
                  </td>
                  <td>{adjustment.admin_username}</td>
                  <td className="num">
                    <span className={adjustment.amount_cents >= 0 ? 'money-positive' : 'money-negative'}>
                      {adjustment.amount_cents >= 0 ? '+' : ''}{formatUsd(adjustment.amount_cents)}
                    </span>
                  </td>
                  <td className="num">{formatUsd(adjustment.credit_after_cents - adjustment.held_after_cents)}</td>
                  <td>{adjustment.reason}</td>
                  <td>{adjustment.created_at.replace('T', ' ').slice(0, 16)} UTC</td>
                </tr>
              ))}
            </tbody>
          </table>
          {adjustments.length === 0 ? <p className="empty">No administrator credit adjustments yet.</p> : null}
        </div>
      </section>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <div>
            <h2>Accounts</h2>
            <p className="t-small">Up to 100 recent accounts. Password hashes and session tokens are never displayed.</p>
          </div>
          <span>{users.length} shown</span>
        </header>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Tier</th>
                <th className="num">Available credit</th>
                <th className="num">Held</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.username}</strong>
                    <div className="t-small">{user.email}</div>
                  </td>
                  <td>{user.account_type}</td>
                  <td>{user.status}</td>
                  <td>{user.membership_tier}</td>
                  <td className="num">{formatUsd(user.credit_cents - user.held_cents)}</td>
                  <td className="num">{formatUsd(user.held_cents)}</td>
                  <td>{user.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 ? <p className="empty">No accounts yet.</p> : null}
        </div>
      </section>
    </>
  )
}
