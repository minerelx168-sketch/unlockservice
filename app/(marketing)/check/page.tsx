import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { ImeiCheckForm } from '@/components/imei-check-form'
import { currentSession } from '@/lib/auth'
import { serviceStatus } from '@/lib/provider'
import { Icon } from '@/components/icons'


export const dynamic = 'force-dynamic'

export const metadata = pageMetadata("/check", "IMEI Number Validation: Format & Checksum", "Validate an IMEI number format and checksum after signing in. For carrier, blacklist or warranty information, browse our separate paid IMEI reports.")

export default async function CheckPage() {
  const found = await currentSession()
  const status = serviceStatus()

  return (
    <section className="section">
      <div className="shell split">
        <div className="stack" style={{ gap: 18 }}>
          <span className="kicker">
            <Icon name="search" strokeWidth={2} />
            Phone Check
          </span>
          <h1 className="t-section">Validate your IMEI number format and checksum.</h1>
          <p className="t-lead">
            This free tool validates IMEI format and checksum only. For carrier, blacklist, warranty,
            lock-status and device reports, choose a paid Phone Check service.
          </p>
          {status ? (
            <p className="alert" role="status">
              <Icon name="info" strokeWidth={1.9} />
              <span>
                <b>{status.heading}.</b> {status.detail} The free check below is unaffected.{' '}
                <Link href="/unlock-waitlist">Get told when unlocking opens</Link>.
              </span>
            </p>
          ) : null}
          <div className="cta-actions">
            <Link className="button button--primary" href="/services/imei-check">
              Browse Phone Check services <Icon name="arrowRight" />
            </Link>
          </div>
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
            <span className="kicker"><Icon name="device" /> Basic IMEI validation</span>
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
    </section>
  )
}
