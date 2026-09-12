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
  if (status === 'completed') return `${formatUsd(priceCents)} was charged after the report was delivered.`
  if (status === 'refunded') return `The ${formatUsd(priceCents)} hold was released after a terminal failure.`
  if (status === 'manual_review') return `The ${formatUsd(priceCents)} credit remains held. The request will not be retried automatically.`
  return `${formatUsd(priceCents)} is held while the Provider finishes this request.`
}

function statusLabel(status: string) {
  if (status === 'completed') return 'Report ready'
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

  const sections = order.report?.sections ?? []
  const checks = order.report?.checks ?? []

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
        <span className={order.status === 'completed' ? 'badge badge--success' : 'badge'}>{statusLabel(order.status)}</span>
      </div>

      <div className="grid-2">
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

        <section className="card">
          <div className="card-topline">
            <span className="kicker"><Icon name="shield" /> Privacy</span>
          </div>
          <p className="t-small">
            The full Provider result is encrypted at rest and is shown only inside this owner-scoped report. It may contain original device identifiers, so share it carefully.
          </p>
          <p className="field-note" role="note"><Icon name="info" /><span>Provider data is a point-in-time lookup, not proof of ownership or a guarantee of unlock eligibility.</span></p>
        </section>
      </div>

      {order.providerCode ? (
        <section className="card" style={{ marginTop: 20 }}>
          <div className="card-topline">
            <span className="kicker"><Icon name="file" /> Full Provider result</span>
            <span className="t-micro">Code</span>
          </div>
          <p className="t-small">Complete business result returned in the Provider Code field.</p>
          <pre className="provider-code-result">{order.providerCode}</pre>
        </section>
      ) : null}

      {order.report ? (
        <>
          <section className="card" style={{ marginTop: 20 }}>
            <div className="card-topline">
              <span className="kicker"><Icon name="check" /> Report result</span>
              <span className="t-micro">{order.source}</span>
            </div>
            <h2 className="t-card">{order.report.title}</h2>
            <p className="t-small">{order.report.summary}</p>
            {checks.length > 0 ? (
              <dl className="report-details" style={{ marginTop: 20 }}>
                {checks.map((item) => (
                  <div key={item.key}>
                    <dt>{item.label}</dt>
                    <dd className={item.status === 'passed' ? 'status' : undefined}>{item.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>

          {sections.length > 0 ? (
            <div className="grid-2" style={{ marginTop: 20 }}>
              {sections.map((section) => (
                <section className="card" key={section.title}>
                  <div className="card-topline"><span className="kicker"><Icon name="device" /> {section.title}</span></div>
                  <dl className="report-details">
                    {section.items.map((item) => (
                      <div key={item.key}><dt>{item.label}</dt><dd>{item.value}</dd></div>
                    ))}
                  </dl>
                </section>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </>
  )
}
