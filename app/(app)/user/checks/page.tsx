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
          <div className="data-table">
            <div className="row row--head">
              <span>Device</span>
              <span>Type</span>
              <span>Status</span>
              <span />
            </div>
            {checks.map((check) => (
              <div className="row" key={check.id}>
                <b className="mono">{check.maskedImei}</b>
                <span>{check.checkType === 'basic' ? 'Free IMEI check' : check.checkType}</span>
                <span className={check.status === 'completed' ? 'status' : undefined}>{statusLabel(check.status)}</span>
                <Link className="link-arrow" href={`/user/checks/${check.id}`}>
                  View <Icon name="arrowRight" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  )
}
