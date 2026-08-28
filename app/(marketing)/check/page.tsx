import type { Metadata } from 'next'
import Link from 'next/link'
import { ImeiCheckForm } from '@/components/imei-check-form'
import { currentSession } from '@/lib/auth'
import { Icon } from '@/components/icons'

export const metadata: Metadata = { title: 'Phone Check' }
export const dynamic = 'force-dynamic'

export default async function CheckPage() {
  const found = await currentSession()

  return (
    <main className="section">
      <div className="shell split">
        <div className="stack" style={{ gap: 18 }}>
          <span className="kicker">
            <Icon name="search" strokeWidth={2} />
            Phone Check
          </span>
          <h1 className="t-section">Know the phone before you unlock it.</h1>
          <p className="t-lead">
            Start with a free format and checksum check. A future authorized provider can add carrier,
            blacklist, warranty and device history data without changing your account or order flow.
          </p>
          <div className="feature-list">
            <div>
              <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="shield" /></span>
              <span><b>Private by default</b><span>Reports are visible only to your account and identifiers are masked.</span></span>
            </div>
            <div>
              <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="check" /></span>
              <span><b>Check again when needed</b><span>Repeated checks are allowed because device status can change.</span></span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-topline">
            <span className="kicker"><Icon name="device" /> Free IMEI check</span>
            {found ? <Link className="link-arrow" href="/user/checks">History <Icon name="arrowRight" /></Link> : null}
          </div>
          {found ? (
            <ImeiCheckForm csrfToken={found.session.csrfToken} />
          ) : (
            <div className="stack" style={{ gap: 14 }}>
              <p className="t-small">Sign in or create an account to run a check and keep the report private.</p>
              <div className="cta-actions">
                <Link className="button button--primary" href="/login">Sign in</Link>
                <Link className="button button--quiet" href="/register">Create account</Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
