import Link from 'next/link'
import { Icon } from '@/components/icons'
import { HeroPriceCheck, type PriceCheckProduct } from '@/components/hero-price-check'
import { CARRIERS } from '@/lib/catalog'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor } from '@/lib/device-intent-value'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'
import { unlockOrderingEnabled } from '@/lib/provider'
import { unlockCategory } from '@/lib/unlock-catalog-view'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const metadata = pageMetadata(
  '/services/unlock',
  'Phone Unlock Services by Carrier & Device',
  'Compare phone unlock service prices and delivery estimates. Choose your service, enter the IMEI and review requirements before ordering.',
)

export default async function UnlockServicesPage() {
  const intent = await readDeviceIntent()
  const products = listPublicProviderProducts('unlock')
  const ordering = unlockOrderingEnabled() || products.some((product) => product.status === 'available')
  const quoteProducts: PriceCheckProduct[] = products.map((product) => ({
    code: product.productCode, name: product.name, category: unlockCategory(product),
    summary: product.summary, available: product.status === 'available',
    priceCents: product.priceCents, etaLabel: product.etaLabel,
  }))
  const networks = new Set(CARRIERS.map((carrier) => carrier.name)).size

  return (
    <section className="section section--tint service-entry-section unlock-landing">
      <div className="shell">
        <nav className="service-breadcrumb" aria-label="Breadcrumb">
          <Link href="/services">Services</Link><span aria-hidden="true">/</span><span aria-current="page">Unlock Service</span>
        </nav>
        <div className="unlock-landing-grid">
          <div className="service-hero-copy unlock-landing-intro">
            <span className="hero-chip"><Icon name="lock" />Network unlock services</span>
            <h1 className="service-entry-title">Keep your phone.<br /><span className="accent">Explore your options.</span></h1>
            <p className="t-lead">Choose the network your phone is locked to. See the price and delivery estimate, then review the requirements before ordering.</p>
            <ul className="service-micro" aria-label="Unlock facts">
              <li><Icon name="bolt" />Remote service</li>
              <li><Icon name="wallet" />Credit held until delivery</li>
              <li><Icon name="globe" />{networks} networks listed</li>
            </ul>
          </div>
          <div className="hero-panel unlock-landing-form" id="unlock-entry-heading">
            <HeroPriceCheck unlock={quoteProducts} check={[]} ordering={ordering} fixedDomain="unlock" initialImei={intentImeiFor(intent, 'unlock')} initialProductCode={intent?.domain === 'unlock' ? intent.productCode : undefined} />
          </div>
          <div className="requirements-card unlock-landing-requirements">
            <h2><Icon name="shieldCheck" />Before you order</h2>
            <ul>
              <li><Icon name="checkSmall" />Know the original carrier, not the network you want to switch to.</li>
              <li><Icon name="checkSmall" />Check lost-or-stolen status and the service’s device requirements.</li>
              <li><Icon name="checkSmall" />Financing and account rules depend on the carrier.</li>
            </ul>
            <Link className="link-arrow" href="/services/imei-check">Not sure which carrier? Check your phone<Icon name="arrowRight" /></Link>
            <p className="t-small">If a service is refused, reserved credit returns to your account balance. This is not a refund to the original payment method.</p>
          </div>
        </div>
        <div className="expect expect--wide">
          <h2>Three clear steps</h2>
          <ol>
            <li><span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="search" /></span><b>1. Choose a service</b>Compare its price, delivery time and device requirements.</li>
            <li><span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="keypad" /></span><b>2. Add your IMEI</b>Dial *#06#, enter the 15 digits and review your selection.</li>
            <li><span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="clock" /></span><b>3. Order and track</b>Confirm from your account and follow progress on the order page.</li>
          </ol>
        </div>
        <details className="service-catalog-details">
          <summary>Explore {networks} listed networks</summary>
          <ul className="tile-grid" id="networks" aria-label="Networks">
            {CARRIERS.map((carrier) => <li key={carrier.id}><a className="tile" href="#unlock-entry-heading"><Icon name="globe" /><span>{carrier.name}<small>{carrier.country}</small></span></a></li>)}
          </ul>
          <p className="t-small">Check the selector above for current online availability.</p>
        </details>
        <div className="service-entry-links"><Link href="/track">Track an existing order</Link><Link href="/support">Get help with your IMEI</Link></div>
        <p className="service-guides">New to unlocking? <Link href="/articles/network-unlock-explained">Read how network unlocking works</Link></p>
      </div>
    </section>
  )
}
