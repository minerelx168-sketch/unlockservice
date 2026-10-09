import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { ImeiCheckForm } from '@/components/imei-check-form'
import { currentSession } from '@/lib/auth'
import { storefrontAvailability } from '@/lib/storefront-availability'
import { ServiceBrowser } from '@/components/service-browser'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'
import { Icon } from '@/components/icons'


export const dynamic = 'force-dynamic'

export const metadata = pageMetadata("/check", "IMEI Number Validation: Format & Checksum", "Validate an IMEI number format and checksum free in your browser, without signing in. For carrier, blacklist or warranty information, browse our separate paid IMEI reports.")

export default async function CheckPage() {
  const found = await currentSession()
  const unlock = storefrontAvailability('unlock')
  const products = listPublicProviderProducts('imei_check')

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
          <div className="cta-actions">
            <Link className="button button--primary" href="/services/imei-check">
              Browse Phone Check services <Icon name="arrowRight" />
            </Link>
            <Link className="button button--secondary" href={unlock.accepting ? '/services/unlock' : '/unlock-waitlist'}>
              {unlock.accepting ? 'Browse Unlock services' : 'Unlock availability updates'} <Icon name="arrowRight" />
            </Link>
          </div>
          <div className="feature-list">
            <div>
              <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="shield" /></span>
              <span><b>Private by default</b><span>Free validation is available without signing in. Signed-in checks are saved privately in your history.</span></span>
            </div>
            <div>
              <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="check" /></span>
              <span><b>Check again when needed</b><span>Format and checksum checks do not confirm device status or ownership.</span></span>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-topline">
            <span className="kicker"><Icon name="device" /> Basic IMEI validation</span>
            {found ? <Link className="link-arrow" href="/user/checks">History <Icon name="arrowRight" /></Link> : null}
          </div>
          <ImeiCheckForm csrfToken={found?.session.csrfToken} />
        </div>
      </div>
      <div className="shell" style={{ marginTop: 32 }}>
        <h2 className="t-section">Paid Phone Check services and prices</h2>
        <p className="t-small">Browse categories and live prices before signing in. An account is only needed to review and confirm a paid order.</p>
        <ServiceBrowser products={products} domain="imei_check" isAuthenticated={Boolean(found)} />
      </div>
    </section>
  )
}
