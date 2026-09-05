import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { formatUsd } from '@/lib/money'
import { listPaidReports } from '@/lib/paid-reports'

export const metadata: Metadata = { title: 'Paid IMEI reports' }
export const dynamic = 'force-dynamic'

function statusLabel(status: string) {
  if (status === 'completed') return 'Report ready'
  if (status === 'refunded') return 'Credit returned'
  if (status === 'manual_review') return 'Manual review'
  return 'Processing'
}

export default async function PaidReportsPage() {
  const { user } = await requireSession()
  const reports = listPaidReports(user.id)

  return (
    <>
      <div className="app-head">
        <div>
          <span className="kicker">Paid reports</span>
          <h1>Paid IMEI reports</h1>
          <p>Every report you have ordered, and whether it was charged, is still held, or was refunded.</p>
        </div>
        <Link className="button button--primary" href="/user/reports/new">
          <Icon name="file" strokeWidth={1.9} />
          Buy a report
        </Link>
      </div>

      {reports.length === 0 ? (
        <div className="card empty-state">
          <span className="icon-tile icon-tile--accent" aria-hidden="true"><Icon name="file" /></span>
          <h2 className="t-card">No paid reports yet</h2>
          <p className="t-small">Paid Provider reports are separate from the Free IMEI Check.</p>
          <Link className="link-arrow" href="/user/reports/new">Choose a paid report <Icon name="arrowRight" /></Link>
        </div>
      ) : (
        <div className="card table-card">
          <div className="card-topline">
            <span className="kicker"><Icon name="file" /> Recent paid reports</span>
            <span className="t-micro">{reports.length} shown</span>
          </div>
          <div className="data-table">
            <div className="row row--head">
              <span>Report</span>
              <span>IMEI</span>
              <span>Price</span>
              <span>Status</span>
              <span />
            </div>
            {reports.map((report) => (
              <div className="row" key={report.id}>
                <b>{report.productName}</b>
                <span className="mono">{report.maskedImei}</span>
                <span>{formatUsd(report.priceCents)}</span>
                <span className={report.status === 'completed' ? 'status' : undefined}>{statusLabel(report.status)}</span>
                <Link className="link-arrow" href={`/user/reports/${report.id}`}>View <Icon name="arrowRight" /></Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
