import type { Metadata } from 'next'
import { adminOverview, listAdminUsers } from '@/lib/admin'
import { requireAdmin } from '@/lib/auth'
import { formatUsd } from '@/lib/money'

export const metadata: Metadata = { title: 'Control panel' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { user: administrator } = await requireAdmin()
  const overview = adminOverview()
  const users = listAdminUsers()

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Control panel</h1>
          <p>Signed in as {administrator.username}. Administrator access is enforced on the server.</p>
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
            <h2>Recent accounts</h2>
            <p className="t-small">The latest 25 accounts. Password hashes and session tokens are never displayed.</p>
          </div>
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
