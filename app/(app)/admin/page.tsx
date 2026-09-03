import type { Metadata } from 'next'
import { adminOverview, listAdminUsers } from '@/lib/admin'
import { listAdminCreditAdjustments } from '@/lib/admin-credit-adjustments'
import { requireAdmin } from '@/lib/auth'
import { formatUsd } from '@/lib/money'
import { AdminCreditAdjustment } from '@/components/admin-credit-adjustment'

export const metadata: Metadata = { title: 'Control panel' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { user: administrator, session } = await requireAdmin()
  const overview = adminOverview()
  const users = listAdminUsers(100)
  const adjustments = listAdminCreditAdjustments(25)

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Control panel</h1>
          <p>Signed in as {administrator.username}. Administrator access and every financial mutation are enforced on the server.</p>
        </div>
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
