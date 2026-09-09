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
          <div className="table-wrap">
            <table role="table" className="grid account-table" aria-label="Recent paid reports">
              <thead role="rowgroup"><tr role="row">
                <th role="columnheader" scope="col">Report</th>
                <th role="columnheader" scope="col">IMEI</th>
                <th role="columnheader" scope="col" className="num">Price</th>
                <th role="columnheader" scope="col">Status</th>
                <th role="columnheader" scope="col"><span className="visually-hidden">Action</span></th>
              </tr></thead>
              <tbody role="rowgroup">
                {reports.map((report) => (
                  <tr role="row" key={report.id}>
                    <td role="cell" data-label="Report">{report.productName}</td>
                    <td role="cell" className="mono" data-label="IMEI">{report.maskedImei}</td>
                    <td role="cell" className="num" data-label="Price">{formatUsd(report.priceCents)}</td>
                    <td role="cell" data-label="Status">{statusLabel(report.status)}</td>
                    <td role="cell" className="account-table-action" data-label="Action">
                      <Link className="link-arrow" href={`/user/reports/${report.id}`} aria-label={`View report ${report.id}`}>
                        View <Icon name="arrowRight" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}
