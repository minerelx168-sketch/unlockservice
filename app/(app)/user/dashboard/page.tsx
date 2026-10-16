import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Avatar } from '@/components/avatar'
import { Icon, type IconName } from '@/components/icons'
import { OrderStatusBadge } from '@/components/order-status'
import { requireSession } from '@/lib/auth'
import { creditSummary } from '@/lib/credits'
import { formatUsd } from '@/lib/money'
import { listOrders, orderStats } from '@/lib/orders'
import { listPaidReports, type PaidReportView } from '@/lib/paid-reports'
import { getAccountProfile } from '@/lib/profile'
import { unlockOrderingEnabled } from '@/lib/provider'

export const metadata: Metadata = { title: 'Dashboard' }
export const dynamic = 'force-dynamic'

type Tab = 'all' | 'unlocks' | 'reports'

function reportBadge(status: PaidReportView['status']) {
  const value = String(status)
  if (value === 'completed') return { className: 'badge badge--success', label: 'Delivered' }
  if (value === 'refunded') return { className: 'badge badge--muted', label: 'Refunded' }
  if (value === 'manual_review') return { className: 'badge badge--pending', label: 'In review' }
  return { className: 'badge badge--pending', label: 'Processing' }
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [{ user }, query] = await Promise.all([requireSession(), searchParams])
  const tab: Tab = query.tab === 'unlocks' || query.tab === 'reports' ? query.tab : 'all'
  const ordering = unlockOrderingEnabled()
  const available = user.credit_cents - user.held_cents
  const stats = orderStats(user.id)
  const money = creditSummary(user.id)
  const profile = getAccountProfile(user.id)
  const orders = listOrders(user.id, 8)
  const reports = listPaidReports(user.id, 8)

  /* One list, both families, newest first. Each row keeps its own route. */
  const rows = [
    ...orders.map((order) => ({
      key: `o${order.id}`,
      family: 'unlock' as const,
      href: `/user/orders/${order.id}`,
      title: order.title,
      device: <span className="t-mono">{order.imei}</span> as ReactNode,
      created: order.created_at,
      priceCents: order.price_cents,
      status: <OrderStatusBadge status={order.status} />,
    })),
    ...reports.map((report) => {
      const badge = reportBadge(report.status)
      return {
        key: `r${report.id}`,
        family: 'report' as const,
        href: `/user/reports/${report.id}`,
        title: report.productName,
        device: <span className="t-mono">{report.imei ?? report.maskedImei}</span> as ReactNode,
        created: report.createdAt,
        priceCents: report.priceCents,
        status: <span className={badge.className}>{badge.label}</span>,
      }
    }),
  ]
    .filter((row) => tab === 'all' || (tab === 'unlocks' ? row.family === 'unlock' : row.family === 'report'))
    .sort((left, right) => right.created.localeCompare(left.created))
    .slice(0, 8)

  const starts: Array<{ icon: IconName; tint: string; title: string; caption: string; href: string; disabled?: boolean }> = [
    { icon: 'search', tint: ' icon-tile--accent', title: 'Phone Check', caption: 'Reports from the IMEI', href: '/user/reports/new' },
    { icon: 'lock', tint: '', title: 'Unlock', caption: ordering ? 'Network unlock by IMEI' : 'Ordering paused — browse prices', href: ordering ? '/user/services/unlock' : '/services/unlock' },
    { icon: 'wallet', tint: ' icon-tile--moss', title: 'Add credit', caption: 'USDT on TRC20 or BEP20', href: '/user/add-funds' },
    { icon: 'keypad', tint: '', title: 'Free check', caption: 'Validate an IMEI number', href: '/check' },
  ]

  const tabs: Array<{ id: Tab; label: string; icon: IconName; count: number }> = [
    { id: 'all', label: 'All', icon: 'grid', count: orders.length + reports.length },
    { id: 'unlocks', label: 'Unlocks', icon: 'lock', count: orders.length },
    { id: 'reports', label: 'Reports', icon: 'file', count: reports.length },
  ]

  return (
    <>
      <div className="app-head dash-head">
        <div className="dash-welcome">
          <Avatar username={user.username} style={profile.avatarStyle} size={52} />
          <div>
            <h1>Welcome back, {user.username}.</h1>
            <p>Member since {user.created_at.slice(0, 10)}. Start an order, check a status, or manage your account.</p>
          </div>
        </div>
        <Link className="button button--quiet" href="/user/profile">
          <Icon name="user" strokeWidth={1.9} />
          Profile
        </Link>
      </div>

      <p className="dash-label" style={{ marginTop: 0 }}>Start a new order</p>
      <div className="start-grid">
        {starts.map((start) => (
          <Link className="start-tile" href={start.href} key={start.title} data-disabled={start.disabled ? 'true' : undefined}>
            <span className={`icon-tile${start.tint}`} aria-hidden="true">
              <Icon name={start.icon} strokeWidth={1.8} />
            </span>
            <b>{start.title}</b>
            <span>{start.caption}</span>
            <span className="start-arrow" aria-hidden="true">
              <Icon name="arrowRight" strokeWidth={2.2} />
            </span>
          </Link>
        ))}
      </div>

      <p className="dash-label">Account</p>
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

      <div className="app-head" style={{ marginTop: 28, marginBottom: 12 }}>
        <div>
          <p className="dash-label" style={{ margin: 0 }}>Recent orders</p>
        </div>
        <nav className="filter-tabs" aria-label="Filter recent orders">
          {tabs.map((entry) => (
            <Link
              key={entry.id}
              href={entry.id === 'all' ? '/user/dashboard' : `/user/dashboard?tab=${entry.id}`}
              aria-current={tab === entry.id ? 'page' : undefined}
            >
              <Icon name={entry.icon} strokeWidth={2} />
              {entry.label}
              <em>{entry.count}</em>
            </Link>
          ))}
        </nav>
      </div>

      <section className="panel">
        <header>
          <h2>{tab === 'all' ? 'Latest unlocks and reports' : tab === 'unlocks' ? 'Latest unlocks' : 'Latest reports'}</h2>
          <Link className="link-arrow" href={tab === 'reports' ? '/user/reports' : '/user/orders'}>
            See all
            <Icon name="arrowRight" strokeWidth={2.2} />
          </Link>
        </header>
        {rows.length ? (
          <ul className="order-list">
            {rows.map((row) => (
              <li key={row.key}>
                <Link className="order-row" href={row.href}>
                  <span className={`icon-tile${row.family === 'report' ? ' icon-tile--accent' : ''}`} aria-hidden="true">
                    <Icon name={row.family === 'report' ? 'file' : 'lock'} strokeWidth={1.8} />
                  </span>
                  <b>{row.title}</b>
                  <span className="order-meta">
                    {row.status}
                    {row.device}
                    <span>{row.created.slice(0, 10)}</span>
                  </span>
                  <span className="order-price">
                    {formatUsd(row.priceCents)}
                    <Icon name="chevronRight" strokeWidth={2} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">
            Nothing here yet.{' '}
            <Link href={ordering ? '/user/services/unlock' : '/user/reports/new'}>
              {ordering ? 'Unlock your first device' : 'Run your first phone check'}
            </Link>
            .
          </p>
        )}
      </section>
    </>
  )
}
