import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon } from '@/components/icons'
import { formatEta, OrderStatusBadge } from '@/components/order-status'
import { requireSession } from '@/lib/auth'
import { formatUsd } from '@/lib/money'
import { getOrder } from '@/lib/orders'

export const metadata: Metadata = { title: 'Order' }
export const dynamic = 'force-dynamic'

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireSession()
  const { id } = await params
  const order = getOrder(Number(id), user.id)
  if (!order) notFound()

  const result = order.result_json
    ? (JSON.parse(order.result_json) as Record<string, unknown>)
    : null
  const entries = Object.entries(result ?? {}).filter(
    ([key]) => key !== 'note' && key !== 'source' && key !== 'identifier',
  )
  const note = typeof result?.note === 'string' ? result.note : null

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Order #{order.id}</h1>
          <p>{order.title}</p>
        </div>
        <Link className="button button--quiet" href="/user/orders">
          All orders
        </Link>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>
        <section className="panel">
          <header>
            <h2>Status</h2>
            <span>
              {order.status === 'delivered'
                ? `${formatUsd(order.price_cents)} charged`
                : order.status === 'unavailable'
                  ? `${formatUsd(order.price_cents)} returned`
                  : `Held · ${formatEta(order.eta_hours)}`}
            </span>
          </header>
          <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <OrderStatusBadge status={order.status} />
              <span className="t-mono" style={{ fontSize: 13 }}>
                {order.imei}
              </span>
            </div>

            {order.unlock_code ? (
              <div className="code-slab">
                <span className="label">Unlock code</span>
                <span className="value">{order.unlock_code}</span>
              </div>
            ) : null}

            {order.status === 'processing' ? (
              <p className="alert" role="status">
                <Icon name="info" strokeWidth={1.9} />
                <span>
                  With the carrier now, typically {formatEta(order.eta_hours)}. The result lands here
                  and goes to {order.delivery_email}.
                </span>
              </p>
            ) : null}

            {order.error_message ? (
              <p className="alert alert--error" role="status">
                <Icon name="info" strokeWidth={1.9} />
                <span>{order.error_message} The full {formatUsd(order.price_cents)} went back to your balance.</span>
              </p>
            ) : null}

            <dl className="result-grid">
              <div>
                <dt>Placed</dt>
                <dd>{order.created_at}</dd>
              </div>
              <div>
                <dt>Price</dt>
                <dd>{formatUsd(order.price_cents)}</dd>
              </div>
              <div>
                <dt>Delivered as</dt>
                <dd>{order.delivery === 'remote' ? 'Remote release' : 'Unlock code'}</dd>
              </div>
              <div>
                <dt>Result sent to</dt>
                <dd>{order.delivery_email}</dd>
              </div>
            </dl>
          </div>
        </section>

        {entries.length > 0 ? (
          <section className="panel">
            <header>
              <h2>What the supplier returned</h2>
            </header>
            <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
              <dl className="result-grid">
                {entries.map(([key, value]) => (
                  <div key={key}>
                    <dt>{key.replace(/([A-Z])/g, ' $1')}</dt>
                    <dd>{String(value)}</dd>
                  </div>
                ))}
              </dl>
              {note ? <p className="t-small">{note}</p> : null}
            </div>
          </section>
        ) : null}
      </div>
    </>
  )
}
