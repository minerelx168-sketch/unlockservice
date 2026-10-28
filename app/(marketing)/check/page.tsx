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
  const eligible = Boolean(found && found.user.account_type === 'customer' && found.user.email_verified_at)
  const unlock = storefrontAvailability('unlock')
  const products = listStorefrontProviderProducts('imei_check')

  return (
    <section className="section free-check-page apple-check-page">
      <div className="shell free-check-layout apple-check-layout">
        <div className="free-check-intro apple-check-intro">
          <span className="kicker"><Icon name="device" strokeWidth={2} /> APPLE DEVICE CHECK</span>
          <h1 className="t-section">Apple <span>Free Check</span></h1>
          <p className="t-lead">Get to know your Apple device. Enter its IMEI to see Apple Basic Info, with 3 free checks per verified account each day.</p>
          <ul className="apple-check-highlights" aria-label="Free check benefits">
            <li><Icon name="check" /> No payment required</li>
            <li><Icon name="shield" /> Private results</li>
          </ul>
        </div>

        <div className="card free-check-form apple-check-card">
          <div className="card-topline">
            <span className="apple-check-product"><span className="apple-check-product-icon" aria-hidden="true"><Icon name="device" /></span><span>Apple Basic Info<small>Free device check</small></span></span>
            {found ? <Link className="link-arrow apple-check-history" href="/user/checks">History <Icon name="arrowRight" /></Link> : <span className="apple-check-free-label">FREE</span>}
          </div>
          <h2 className="apple-check-form-title">Check your Apple device</h2>
          <ImeiCheckForm csrfToken={found?.session.csrfToken} initialQuota={eligible && found ? freeAppleQuota(found.user.id) : undefined} disabledReason={found && !eligible ? found.user.account_type !== 'customer' ? 'Apple Free Check is for customer accounts. Admin accounts do not use the free allowance.' : 'Verify your account email before using Apple Free Check.' : undefined} />
        </div>

        <div className="free-check-extras apple-check-extras">
          <div className="apple-check-notes">
            <div className="apple-check-note">
              <span className="apple-check-note-icon" aria-hidden="true"><Icon name="shield" /></span>
              <div><h2>Private by default</h2><p>Sign in to use your free allowance. Your results are saved privately in your account history.</p></div>
            </div>
            <div className="apple-check-note">
              <span className="apple-check-note-icon" aria-hidden="true"><Icon name="clock" /></span>
              <div><h2>A fresh allowance, every day</h2><p>Your 3 free checks reset at 00:00 UTC. Available report fields depend on the device data returned.</p></div>
            </div>
          </div>
          <div className="apple-check-next">
            <span>Looking for more?</span>
            <Link className="link-arrow" href="/services/imei-check">Browse Phone Check services <Icon name="arrowRight" /></Link>
            <Link className="link-arrow" href={unlock.accepting ? '/services/unlock' : '/unlock-waitlist'}>
              {unlock.accepting ? 'Browse Unlock services' : 'Unlock availability updates'} <Icon name="arrowRight" />
            </Link>
          </div>
        </div>
      </div>

      <section className="shell apple-check-paid" aria-labelledby="paid-check-heading">
        <div className="apple-check-paid-heading">
          <div><span className="kicker">WHEN YOU NEED MORE DETAIL</span><h2 id="paid-check-heading">Paid Phone Check services and prices</h2></div>
          <p>Compare reports and prices first. Pay per report, then receive the full result online and by email.</p>
        </div>
        <ServiceBrowser products={products} domain="imei_check" isAuthenticated={Boolean(found)} />
      </section>
    </section>
  )
}
