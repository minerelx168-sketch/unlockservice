import { freeAppleQuota } from '@/lib/imei-checks'
import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { ImeiCheckForm } from '@/components/imei-check-form'
import { currentSession } from '@/lib/auth'
import { storefrontAvailability } from '@/lib/storefront-availability'
import { ServiceBrowser } from '@/components/service-browser'
import { listStorefrontProviderProducts } from '@/lib/public-provider-catalog'
import { Icon } from '@/components/icons'


export const dynamic = 'force-dynamic'

export const metadata = pageMetadata("/check", "Apple Free Check", "Get Apple Basic Info with 3 free checks per verified account each day. See real provider data before choosing a paid Phone Check service.")

export default async function CheckPage() {
  const found = await currentSession()
  const unlock = storefrontAvailability('unlock')
  const products = listStorefrontProviderProducts('imei_check')

  return (
    <section className="section free-check-page">
      <div className="shell free-check-layout">
        <div className="stack free-check-intro" style={{ gap: 12 }}>
          <span className="kicker">
            <Icon name="search" strokeWidth={2} />
            Phone Check
          </span>
          <h1 className="t-section">Apple Free Check</h1>
          <p className="t-lead">
            Get Apple Basic Info for your device, free. Each verified account gets 3 checks per day.
            Need more detail? Choose a paid Phone Check service.
          </p>

        </div>

        <div className="card free-check-form">
          <div className="card-topline">
            <span className="kicker"><Icon name="device" /> Apple Basic Info · Free</span>
            {found ? <Link className="link-arrow" href="/user/checks">History <Icon name="arrowRight" /></Link> : null}
          </div>
          <ImeiCheckForm csrfToken={found?.session.csrfToken} initialQuota={found ? freeAppleQuota(found.user.id) : undefined} />
        </div>
        <div className="stack free-check-extras">
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
              <span><b>Private by default</b><span>Sign in to use your free allowance. Results are saved privately in your account history.</span></span>
            </div>
            <div>
              <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="check" /></span>
              <span><b>3 free checks every day</b><span>Your daily allowance resets at 00:00 UTC. Available report fields depend on the device data returned.</span></span>
            </div>
          </div>
        </div>
      </div>
      <div className="shell free-check-paid">
        <div className="section-head">
          <h2 className="t-section">Paid Phone Check services and prices</h2>
          <p className="t-small">Compare reports and prices first. Pay per report without an account, then receive the full result online and by email.</p>
        </div>
        <ServiceBrowser products={products} domain="imei_check" isAuthenticated={Boolean(found)} />
      </div>
    </section>
  )
}

