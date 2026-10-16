import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon, type IconName } from '@/components/icons'
import { OrderRefresh } from '@/components/order-refresh'
import { formatEta, OrderStatusBadge } from '@/components/order-status'
import { requireSession } from '@/lib/auth'
import { formatUsd } from '@/lib/money'
import { getOrder } from '@/lib/orders'

export const metadata: Metadata = { title: 'Order' }
export const dynamic = 'force-dynamic'

const DISC: Record<'processing' | 'delivered' | 'unavailable', { icon: IconName; title: string; lead: string }> = {
  processing: { icon: 'clock', title: 'With the carrier', lead: 'Your credit is held, not charged, until the network answers.' },
  delivered: { icon: 'check', title: 'Unlocked', lead: 'The result is below and was sent by email. It stays on this page.' },
  unavailable: { icon: 'cross', title: 'Refused — refunded', lead: 'The network turned the device down. The held credit is back in your balance.' },
}

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const found = await requireSession()
  const { user } = found
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
  const disc = DISC[order.status]

  return (
    <>
      <Link className="back-link" href="/user/dashboard">
        <Icon name="arrowLeft" strokeWidth={2} />
        Back to dashboard
      </Link>

      <div className="status-hero">
        <span className={`status-disc status-disc--${order.status}`} aria-hidden="true">
          <Icon name={disc.icon} strokeWidth={2.2} />
        </span>
        <h1>Order status</h1>
        <p>{disc.lead}</p>
      </div>

      <section className="panel order-info">
        <header>
          <h2>
            <span className="icon-tile icon-tile--sm" aria-hidden="true">
              <Icon name="shieldCheck" strokeWidth={2} />
            </span>
            Order information
          </h2>
          <OrderStatusBadge status={order.status} />
        </header>
        <div className="panel-body" style={{ display: 'grid', gap: 18 }}>
          <dl className="field-grid">
            <div className="field-box">
              <dt><Icon name="file" strokeWidth={2} />Order ID</dt>
              <dd className="t-mono">#{order.id}</dd>
            </div>
            <div className="field-box">
              <dt><Icon name="device" strokeWidth={2} />IMEI / device</dt>
              <dd className="t-mono">{order.imei}</dd>
            </div>
            <div className="field-box field-box--accent">
              <dt><Icon name="lock" strokeWidth={2} />Service</dt>
              <dd>{order.title}</dd>
            </div>
            <div className="field-box">
              <dt><Icon name="grid" strokeWidth={2} />Brand / network</dt>
              <dd>{[order.brand_name, order.carrier_name].filter(Boolean).join(' · ') || '—'}</dd>
            </div>
            <div className="field-box field-box--money">
              <dt><Icon name="wallet" strokeWidth={2} />Amount</dt>
              <dd>
                {formatUsd(order.price_cents)}
                {order.status === 'delivered' ? ' charged' : order.status === 'unavailable' ? ' returned' : ' held'}
              </dd>
            </div>
            <div className="field-box">
              <dt><Icon name="clock" strokeWidth={2} />Created</dt>
              <dd>{order.created_at}</dd>
            </div>
            <div className="field-box">
              <dt><Icon name="bolt" strokeWidth={2} />Delivered as</dt>
              <dd>{order.delivery === 'remote' ? 'Remote release' : 'Unlock code'}</dd>
            </div>
            <div className="field-box">
              <dt><Icon name="mail" strokeWidth={2} />Result sent to</dt>
              <dd>{order.delivery_email}</dd>
            </div>
          </dl>

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

          <div className="order-foot">
            {order.status === 'processing' ? (
              <OrderRefresh orderId={order.id} csrfToken={found.session.csrfToken} />
            ) : (
              <span className="t-small">Nothing more to do on this order.</span>
            )}
            <Link className="button button--quiet" href="/user/orders">
              All orders
            </Link>
          </div>
        </div>
      </section>

      {entries.length > 0 ? (
        <section className="panel order-info" style={{ marginTop: 20 }}>
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
    </>
  )
}
