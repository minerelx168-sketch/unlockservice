import type { Metadata } from 'next'
import Link from 'next/link'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { listImeiChecks } from '@/lib/imei-checks'

export const metadata: Metadata = { title: 'Phone checks' }
export const dynamic = 'force-dynamic'

function statusLabel(status: string) {
  if (status === 'completed') return 'Complete'
  if (status === 'unavailable') return 'Unavailable'
  return 'Processing'
}

export default async function ChecksPage() {
  const { user } = await requireSession()
  const checks = listImeiChecks(user.id)

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Phone checks</h1>
          <p>Review your IMEI reports. A new check is independent, so you can re-check a device when its status changes.</p>
        </div>
        <Link className="button button--primary" href="/check">
          <Icon name="search" strokeWidth={1.9} />
          New check
        </Link>
      </div>

      {checks.length === 0 ? (
        <div className="card empty-state">
          <span className="icon-tile icon-tile--accent" aria-hidden="true"><Icon name="device" /></span>
          <h2 className="t-card">No checks yet</h2>
          <p className="t-small">Run a free IMEI format and checksum check before placing an unlock order.</p>
          <Link className="link-arrow" href="/check">Start a phone check <Icon name="arrowRight" /></Link>
        </div>
      ) : (
        <div className="card table-card">
          <div className="card-topline">
            <span className="kicker"><Icon name="search" /> Recent checks</span>
            <span className="t-micro">{checks.length} shown</span>
          </div>
          <div className="table-wrap">
            <table role="table" className="grid account-table" aria-label="Recent phone checks">
              <thead role="rowgroup"><tr role="row">
                <th role="columnheader" scope="col">Device</th>
                <th role="columnheader" scope="col">Type</th>
                <th role="columnheader" scope="col">Status</th>
                <th role="columnheader" scope="col"><span className="visually-hidden">Action</span></th>
              </tr></thead>
              <tbody role="rowgroup">
                {checks.map((check) => (
                  <tr role="row" key={check.id}>
                    <td role="cell" className="mono" data-label="Device">{check.maskedImei}</td>
                    <td role="cell" data-label="Type">{check.checkType === 'basic' ? 'Free IMEI check' : check.checkType}</td>
                    <td role="cell" data-label="Status">{statusLabel(check.status)}</td>
                    <td role="cell" className="account-table-action" data-label="Action">
                      <Link className="link-arrow" href={`/user/checks/${check.id}`} aria-label={`View check ${check.id}`}>
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
