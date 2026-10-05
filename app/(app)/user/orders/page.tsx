import type { Metadata } from 'next'
import Link from 'next/link'
import { OrderStatusBadge } from '@/components/order-status'
import { requireSession } from '@/lib/auth'
import { unlockOrderingEnabled } from '@/lib/provider'
import { countLedger, listLedger } from '@/lib/credits'
import { formatUsd } from '@/lib/money'
import { countOrders, listOrders } from '@/lib/orders'

export const metadata: Metadata = { title: 'Orders' }
export const dynamic = 'force-dynamic'

const LEDGER_LABEL: Record<string, string> = {
  topup: 'Top-up',
  hold: 'Held for an order',
  charge: 'Order charged',
  refund: 'Credit returned',
  adjustment: 'Adjustment',
}

const PER_PAGE = 25

/* The rows are read one page at a time rather than capped at fifty. A
   reseller's fifty-first order was simply not in the table, with nothing to
   say so. */
function pageNumber(raw: string | undefined, total: number): number {
  const asked = Number(raw)
  const last = Math.max(1, Math.ceil(total / PER_PAGE))
  if (!Number.isInteger(asked) || asked < 1) return 1
  return Math.min(asked, last)
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; page?: string }>
}) {
  const { user } = await requireSession()
  const ordering = unlockOrderingEnabled()
  const params = await searchParams
  const tab = params.tab === 'credit' ? 'credit' : 'orders'

  const total = tab === 'orders' ? countOrders(user.id) : countLedger(user.id)
  const page = pageNumber(params.page, total)
  const offset = (page - 1) * PER_PAGE
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE))

  const orders = tab === 'orders' ? listOrders(user.id, PER_PAGE, offset) : []
  const ledger = tab === 'credit' ? listLedger(user.id, PER_PAGE, offset) : []

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Orders</h1>
          <p>
            Every order and every movement of credit, with the complete IMEI visible only inside your signed-in account.
          </p>
        </div>
        <div className="app-head-actions" aria-label="Order history view">
          <a className={`button ${tab === 'orders' ? 'button--primary' : 'button--quiet'}`} href="?tab=orders&page=1">
            Orders
          </a>
          <a className={`button ${tab === 'credit' ? 'button--primary' : 'button--quiet'}`} href="?tab=credit&page=1">
            Credit history
          </a>
        </div>
      </div>

      <div className="panel">
        {tab === 'orders' ? (
          <div className="table-wrap">
            <table role="table" className="grid account-table">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader" scope="col">Order</th>
                  <th role="columnheader" scope="col">Device</th>
                  <th role="columnheader" scope="col">Service</th>
                  <th role="columnheader" scope="col">Status</th>
                  <th role="columnheader" scope="col" className="num">Price</th>
                  <th role="columnheader" scope="col">Placed</th>
                  <th role="columnheader" scope="col"><span className="visually-hidden">Action</span></th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {orders.map((order) => (
                  <tr role="row" key={order.id}>
                    <td role="cell" className="mono" data-label="Order">#{order.id}</td>
                    <td role="cell" className="mono" data-label="Device">{order.imei}</td>
                    <td role="cell" data-label="Service">{order.title}</td>
                    <td role="cell" data-label="Status">
                      <OrderStatusBadge status={order.status} />
                    </td>
                    <td role="cell" className="num" data-label="Price">{formatUsd(order.price_cents)}</td>
                    <td role="cell" data-label="Placed">{order.created_at}</td>
                    <td role="cell" className="account-table-action" data-label="Action">
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
                Nothing yet.{' '}
                <Link href={ordering ? '/user/unlock' : '/user/reports/new'}>
                  {ordering ? 'Unlock a device' : 'Run a phone check'}
                </Link>
                .
              </p>
            ) : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table role="table" className="grid account-table">
              <thead role="rowgroup">
                <tr role="row">
                  <th role="columnheader" scope="col">Movement</th>
                  <th role="columnheader" scope="col">Reference</th>
                  <th role="columnheader" scope="col" className="num">Amount</th>
                  <th role="columnheader" scope="col" className="num">Available after</th>
                  <th role="columnheader" scope="col">When</th>
                </tr>
              </thead>
              <tbody role="rowgroup">
                {ledger.map((row) => (
                  <tr role="row" key={row.id}>
                    <td role="cell" data-label="Movement">{LEDGER_LABEL[row.type] ?? row.type}</td>
                    <td role="cell" className="mono" data-label="Reference">
                      {row.ref_type === 'invoice' && row.ref_id
                        ? `#${row.ref_id.slice(0, 10).toUpperCase()}`
                        : row.ref_id
                          ? `order #${row.ref_id}`
                          : '—'}
                    </td>
                    <td role="cell" className="num" data-label="Amount">{formatUsd(row.amount_cents)}</td>
                    <td role="cell" className="num" data-label="Available after">{formatUsd(row.balance_after_cents)}</td>
                    <td role="cell" data-label="When">{row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.length === 0 ? <p className="empty">Nothing yet — top-ups and charges will appear here.</p> : null}
          </div>
        )}

        {lastPage > 1 ? (
          <nav className="pager" aria-label="Pagination">
            {page > 1 ? (
              <a className="button button--quiet" href={`?tab=${tab}&page=${page - 1}`} rel="prev">
                Newer
              </a>
            ) : (
              <span className="button button--quiet" aria-disabled="true">
                Newer
              </span>
            )}
            <span className="t-small">
              Page {page} of {lastPage} · {total} in total
            </span>
            {page < lastPage ? (
              <a className="button button--quiet" href={`?tab=${tab}&page=${page + 1}`} rel="next">
                Older
              </a>
            ) : (
              <span className="button button--quiet" aria-disabled="true">
                Older
              </span>
            )}
          </nav>
        ) : null}
      </div>
    </>
  )
}
