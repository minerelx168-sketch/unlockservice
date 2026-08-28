import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { getImeiCheck } from '@/lib/imei-checks'

export const metadata: Metadata = { title: 'IMEI check report' }
export const dynamic = 'force-dynamic'

type CheckItem = { label?: string; status?: string }

export default async function CheckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireSession()
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id < 1) notFound()

  const check = getImeiCheck(user.id, id)
  if (!check) notFound()

  const report = check.result ?? {}
  const items = Array.isArray(report.checks) ? (report.checks as CheckItem[]) : []

  return (
    <>
      <div className="app-head">
        <div>
          <Link className="link-arrow" href="/user/checks"><span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}><Icon name="arrowRight" /></span> Back to checks</Link>
          <h1 style={{ marginTop: 16 }}>IMEI check report</h1>
          <p>{check.maskedImei} · {new Date(check.createdAt).toLocaleString()}</p>
        </div>
        <span className={check.status === 'completed' ? 'badge badge--success' : 'badge'}>{check.status}</span>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-topline">
            <span className="kicker"><Icon name="check" /> Result</span>
            <span className="t-micro">{check.provider}</span>
          </div>
          <h2 className="t-card">{String(report.title ?? 'IMEI check')}</h2>
          <p className="t-small">{String(report.summary ?? check.message ?? 'The report is not available yet.')}</p>
          {items.length > 0 ? (
            <div className="data-table" style={{ marginTop: 20 }}>
              {items.map((item) => (
                <div className="row" key={item.label}>
                  <span>{item.label ?? 'Check'}</span>
                  <b className={item.status === 'passed' ? 'status' : undefined}>{item.status ?? 'pending'}</b>
                </div>
              ))}
            </div>
          ) : null}
        </section>

        <section className="card">
          <div className="card-topline">
            <span className="kicker"><Icon name="info" /> Next step</span>
          </div>
          <p className="t-small">{String(report.nextStep ?? 'You can run another check when you need a fresh result.')}</p>
          <Link className="button button--quiet" href="/check">Run another check</Link>
        </section>
      </div>
    </>
  )
}
