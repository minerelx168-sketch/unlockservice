import type { Metadata } from 'next'
import Link from 'next/link'
import { OrderStatusBadge } from '@/components/order-status'
import { requireSession } from '@/lib/auth'
import { creditSummary } from '@/lib/credits'
import { maskIdentifier } from '@/lib/imei'
import { formatUsd } from '@/lib/money'
import { listOrders, orderStats } from '@/lib/orders'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { user } = await requireSession()
  const available = user.credit_cents - user.held_cents
  const stats = orderStats(user.id)
  const money = creditSummary(user.id)
  const recent = listOrders(user.id, 6)

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Welcome back, {user.username}.</h1>
          <p>
            {user.membership_tier} · member since {user.created_at.slice(0, 10)}
          </p>
        </div>
        <Link className="button button--primary" href="/user/unlock">
          Unlock a device
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span className="label">Available credit</span>
          <span className="value">{formatUsd(available)}</span>
          <span className="caption">
            {user.held_cents > 0
              ? `${formatUsd(user.held_cents)} held by ${stats.processing} order${stats.processing === 1 ? '' : 's'}`
              : 'Nothing held'}
          </span>
        </div>
        <div className="stat">
          <span className="label">Orders placed</span>
          <span className="value">{stats.total}</span>
          <span className="caption">
            {stats.delivered} unlocked · {stats.processing} with a carrier
          </span>
        </div>
        <div className="stat">
          <span className="label">Spent on unlocks</span>
          <span className="value">{formatUsd(money.usedCents)}</span>
          <span className="caption">{formatUsd(money.restoredCents)} returned on refused devices</span>
        </div>
        <div className="stat">
          <span className="label">Placed today</span>
          <span className="value">{stats.today}</span>
          <span className="caption">Across every brand and network</span>
        </div>
      </div>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <h2>Recent orders</h2>
          <Link className="link-arrow" href="/user/orders">
            See all
          </Link>
        </header>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Order</th>
                <th>Device</th>
                <th>Service</th>
                <th>Status</th>
                <th className="num">Price</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((order) => (
                <tr key={order.id}>
                  <td className="mono">#{order.id}</td>
                  <td className="mono">{maskIdentifier(order.imei)}</td>
                  <td>{order.title}</td>
                  <td>
                    <OrderStatusBadge status={order.status} />
                  </td>
                  <td className="num">{formatUsd(order.price_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.length === 0 ? (
            <p className="empty">
              Nothing yet. <Link href="/user/unlock">Unlock your first device</Link>.
            </p>
          ) : null}
        </div>
      </section>
    </>
  )
}
