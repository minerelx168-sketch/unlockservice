import type { Metadata } from 'next'
import Link from 'next/link'
import { OrderStatusBadge } from '@/components/order-status'
import { requireSession } from '@/lib/auth'
import { listLedger } from '@/lib/credits'
import { maskIdentifier } from '@/lib/imei'
import { formatUsd } from '@/lib/money'
import { listOrders } from '@/lib/orders'

export const metadata: Metadata = { title: 'Orders' }
export const dynamic = 'force-dynamic'

const LEDGER_LABEL: Record<string, string> = {
  topup: 'Top-up',
  hold: 'Held for an order',
  charge: 'Order charged',
  refund: 'Credit returned',
  adjustment: 'Adjustment',
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { user } = await requireSession()
  const tab = (await searchParams).tab === 'credit' ? 'credit' : 'orders'

  const orders = listOrders(user.id, 50)
  const ledger = listLedger(user.id, 50)

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Orders</h1>
          <p>
            Every order and every movement of credit, kept readable. Identifiers are masked to the
            first two and last four digits.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className={`button ${tab === 'orders' ? 'button--primary' : 'button--quiet'}`} href="?tab=orders">
            Orders
          </a>
          <a className={`button ${tab === 'credit' ? 'button--primary' : 'button--quiet'}`} href="?tab=credit">
            Credit movement
          </a>
        </div>
      </div>

      <div className="panel">
        {tab === 'orders' ? (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Device</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th className="num">Price</th>
                  <th>Placed</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id}>
                    <td className="mono">#{order.id}</td>
                    <td className="mono">{maskIdentifier(order.imei)}</td>
                    <td>{order.title}</td>
                    <td>
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td className="num">{formatUsd(order.price_cents)}</td>
                    <td>{order.created_at}</td>
                    <td>
                      <Link className="link-arrow" href={`/user/orders/${order.id}`}>
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {orders.length === 0 ? (
              <p className="empty">
                Nothing yet. <Link href="/user/unlock">Unlock a device</Link>.
              </p>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Movement</th>
                  <th>Reference</th>
                  <th className="num">Amount</th>
                  <th className="num">Available after</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.id}>
                    <td>{LEDGER_LABEL[row.type] ?? row.type}</td>
                    <td className="mono">
                      {row.ref_type === 'invoice' && row.ref_id
                        ? `#${row.ref_id.slice(0, 10).toUpperCase()}`
                        : row.ref_id
                          ? `order #${row.ref_id}`
                          : '—'}
                    </td>
                    <td className="num">{formatUsd(row.amount_cents)}</td>
                    <td className="num">{formatUsd(row.balance_after_cents)}</td>
                    <td>{row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.length === 0 ? <p className="empty">No credit movement yet.</p> : null}
          </div>
        )}
      </div>
    </>
  )
}
