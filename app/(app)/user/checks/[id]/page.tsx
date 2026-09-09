import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { getImeiCheck } from '@/lib/imei-checks'

export const metadata: Metadata = { title: 'IMEI check report' }
export const dynamic = 'force-dynamic'

type CheckItem = {
  key?: string
  label?: string
  status?: 'passed' | 'attention' | 'info' | string
  value?: string
}

type ReportItem = { key?: string; label?: string; value?: string }
type ReportSection = { title?: string; items?: ReportItem[] }

function checkValue(item: CheckItem) {
  return item.value ?? item.status ?? 'Information'
}

export default async function CheckDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireSession()
  const { id: idParam } = await params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id < 1) notFound()

  const check = getImeiCheck(user.id, id)
  if (!check) notFound()

  const report = check.result ?? {}
  const items = Array.isArray(report.checks) ? (report.checks as CheckItem[]) : []
  const sections = Array.isArray(report.sections) ? (report.sections as ReportSection[]) : []
  const isProviderReport = Number(report.schemaVersion) === 1 && check.provider !== 'local-validation'

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
          {isProviderReport ? (
            <p className="field-note" role="note">
              <Icon name="shield" strokeWidth={1.9} />
              <span>Identifiers are masked. Provider results are a point-in-time lookup, not proof of ownership or a guarantee of unlock eligibility.</span>
            </p>
          ) : null}
          {items.length > 0 ? (
            <dl className="report-details" style={{ marginTop: 20 }}>
              {items.map((item, index) => (
                <div key={item.key ?? item.label ?? index}>
                  <dt>{item.label ?? 'Check'}</dt>
                  <dd className={item.status === 'passed' ? 'status' : undefined}>{checkValue(item)}</dd>
                </div>
              ))}
            </dl>
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

      {sections.length > 0 ? (
        <div className="grid-2" style={{ marginTop: 20 }}>
          {sections.map((section, sectionIndex) => {
            const sectionItems = Array.isArray(section.items) ? section.items : []
            if (!sectionItems.length) return null
            return (
              <section className="card" key={section.title ?? sectionIndex}>
                <div className="card-topline">
                  <span className="kicker"><Icon name="device" /> {section.title ?? 'Report details'}</span>
                </div>
                <dl className="report-details">
                  {sectionItems.map((item, itemIndex) => (
                    <div key={item.key ?? item.label ?? itemIndex}>
                      <dt>{item.label ?? 'Detail'}</dt>
                      <dd>{item.value ?? 'Not returned'}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )
          })}
        </div>
      ) : null}
    </>
  )
}
