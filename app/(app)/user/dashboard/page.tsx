import type { Metadata } from 'next'
import Link from 'next/link'
import { StatusBadge } from '@/components/check-console'
import { requireSession } from '@/lib/auth'
import { checkStats, listChecks } from '@/lib/checks'
import { creditSummary } from '@/lib/credits'
import { maskIdentifier } from '@/lib/imei'
import { formatUsd } from '@/lib/money'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const { user } = await requireSession()
  const available = user.credit_cents - user.held_cents
  const stats = checkStats(user.id)
  const money = creditSummary(user.id)
  const recent = listChecks(user.id, 6)

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Welcome back, {user.username}.</h1>
          <p>
            {user.membership_tier} · member since {user.created_at.slice(0, 10)}
          </p>
        </div>
        <Link className="button button--primary" href="/user/check">
          Run a check
        </Link>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span className="label">Available credit</span>
          <span className="value">{formatUsd(available)}</span>
          <span className="caption">
            {user.held_cents > 0 ? `${formatUsd(user.held_cents)} held` : 'Nothing held'}
          </span>
        </div>
        <div className="stat">
          <span className="label">Checks run</span>
          <span className="value">{stats.total}</span>
          <span className="caption">{stats.today} today · {stats.succeeded} completed</span>
        </div>
        <div className="stat">
          <span className="label">Credit used</span>
          <span className="value">{formatUsd(money.usedCents)}</span>
          <span className="caption">{formatUsd(money.restoredCents)} restored by failed checks</span>
        </div>
        <div className="stat">
          <span className="label">Most-used service</span>
          <span className="value" style={{ fontSize: 17, lineHeight: 1.3 }}>
            {stats.favourite ?? '—'}
          </span>
          <span className="caption">Across all time</span>
        </div>
      </div>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <h2>Recent checks</h2>
          <Link className="link-arrow" href="/user/history">
            See all
          </Link>
        </header>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Identifier</th>
                <th>Service</th>
                <th>Status</th>
                <th className="num">Price</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => (
                <tr key={row.id}>
                  <td className="mono">{maskIdentifier(row.identifier)}</td>
                  <td>{row.service_name}</td>
                  <td>
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="num">{formatUsd(row.sell_price_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {recent.length === 0 ? (
            <p className="empty">
              Nothing yet. <Link href="/user/check">Run your first check</Link>.
            </p>
          ) : null}
        </div>
      </section>
    </>
  )
}
