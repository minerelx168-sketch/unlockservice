import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon } from '@/components/icons'
import { PaidReportRefresh } from '@/components/paid-report-refresh'
import { requireSession } from '@/lib/auth'
import { formatUsd } from '@/lib/money'
import { getPaidReport } from '@/lib/paid-reports'

export const metadata: Metadata = { title: 'Paid IMEI report' }
export const dynamic = 'force-dynamic'

function statusCopy(status: string, priceCents: number) {
  if (status === 'refunded') return `The ${formatUsd(priceCents)} hold was released after a terminal failure.`
  if (status === 'manual_review') return `The ${formatUsd(priceCents)} credit remains held. The request will not be retried automatically.`
  return `${formatUsd(priceCents)} is held while the Provider finishes this request.`
}

function statusLabel(status: string) {
  if (status === 'refunded') return 'Credit returned'
  if (status === 'manual_review') return 'Manual review'
  return 'Processing'
}

export default async function PaidReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, session } = await requireSession()
  const id = Number((await params).id)
  if (!Number.isSafeInteger(id) || id < 1) notFound()
  const order = getPaidReport(user.id, id)
  if (!order) notFound()

  if (order.status === 'completed') {
    return (
      <section className="report-result-only" aria-label="Result">
        <h1 className="visually-hidden">{order.productName}</h1>
        {order.providerCode ? (
          <pre className="provider-code-result provider-code-result--standalone">{order.providerCode}</pre>
        ) : (
          <p className="alert alert--error" role="status">
            The Provider result is unavailable. Please contact support.
          </p>
        )}
      </section>
    )
  }

  return (
    <>
      <div className="app-head">
        <div>
          <Link className="link-arrow" href="/user/reports">
            <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="arrowRight" /></span>
            Back to paid reports
          </Link>
          <h1 style={{ marginTop: 16 }}>{order.productName}</h1>
          <p>{order.maskedImei} · {new Date(order.createdAt).toLocaleString()}</p>
        </div>
        <span className="badge">{statusLabel(order.status)}</span>
      </div>

      <section className="card">
        <div className="card-topline">
          <span className="kicker"><Icon name="file" /> Billing status</span>
          <span className="t-micro">{formatUsd(order.priceCents)}</span>
        </div>
        <h2 className="t-card">{statusLabel(order.status)}</h2>
        <p className="t-small">{order.message ?? statusCopy(order.status, order.priceCents)}</p>
        {order.status === 'processing' ? <PaidReportRefresh orderId={order.id} csrfToken={session.csrfToken} /> : null}
        {order.status === 'manual_review' ? (
          <p className="field-note" role="note"><Icon name="shield" /><span>Provider timeout or ambiguity is never retried automatically, which prevents a possible duplicate Provider charge.</span></p>
        ) : null}
      </section>
    </>
  )
}
