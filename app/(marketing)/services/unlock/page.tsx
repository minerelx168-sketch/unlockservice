import Link from 'next/link'
import { Icon } from '@/components/icons'
import { HeroPriceCheck, type PriceCheckProduct } from '@/components/hero-price-check'
import { CARRIERS } from '@/lib/catalog'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor } from '@/lib/device-intent-value'
import { listStorefrontProviderProducts } from '@/lib/public-provider-catalog'
import { unlockOrderingEnabled } from '@/lib/provider'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'
export const metadata = pageMetadata(
  '/services/unlock',
  'Phone Unlock Services by Carrier & Device',
  'Compare phone unlock service prices and delivery estimates. Choose your service, enter the IMEI and review requirements before ordering.',
)

export default async function UnlockServicesPage({ searchParams }: { searchParams: Promise<{ product?: string | string[] }> }) {
  const [intent, query] = await Promise.all([readDeviceIntent(), searchParams])
  const products = listStorefrontProviderProducts('unlock')
  const requested = typeof query.product === 'string' ? query.product : undefined
  const initialProductCode = products.find((product) => product.productCode === requested)?.productCode ?? products.find((product) => product.productCode === intent?.productCode)?.productCode
  const ordering = unlockOrderingEnabled() || products.some((product) => product.status === 'available')
  const quoteProducts: PriceCheckProduct[] = products.map((product) => ({
    code: product.productCode, domain: product.domain, name: product.name, category: product.group,
    summary: product.summary, hasExample: product.hasExample, available: product.status === 'available',
    inputType: product.inputType, priceCents: product.priceCents, priceAvailable: product.priceAvailable, etaLabel: product.etaLabel,
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
            <p className="t-lead">Choose the network your phone is locked to. See the price and delivery time first, then enter the required device details and your email to review your order. Choose card or crypto at checkout.</p>
            <p><Link className="link-arrow" href="/services/unlock/us">US customer? View available US carrier services →</Link></p>
            <ul className="service-micro" aria-label="Unlock facts">
              <li><Icon name="bolt" />Remote service</li>
              <li><Icon name="wallet" />Pay per order</li>
              <li><Icon name="globe" />{networks} networks listed</li>
            </ul>
          </div>
          <div className="hero-panel unlock-landing-form" id="unlock-entry-heading">
            <HeroPriceCheck key={initialProductCode ?? 'unselected'} unlock={quoteProducts} check={[]} ordering={ordering} fixedDomain="unlock" initialImei={intentImeiFor(intent, products.find((product) => product.productCode === initialProductCode)?.domain ?? 'unlock')} initialProductCode={initialProductCode} initialEmail={intent?.productCode === initialProductCode ? intent?.email : undefined} />
          </div>
          <div className="requirements-card unlock-landing-requirements">
            <h2><Icon name="shieldCheck" />Before you order</h2>
            <ul>
              <li><Icon name="checkSmall" />Know the original carrier, not the network you want to switch to.</li>
              <li><Icon name="checkSmall" />Check lost-or-stolen status and the service’s device requirements.</li>
              <li><Icon name="checkSmall" />Financing and account rules depend on the carrier.</li>
            </ul>
            <Link className="link-arrow" href="/services/imei-check">Not sure which carrier? Check your phone<Icon name="arrowRight" /></Link>
            <p className="t-small">If a direct card order cannot be delivered, the system initiates a refund to the original payment method. Bank processing time varies; payments requiring review are handled by support. Orders paid with existing account credit release that credit back to the balance.</p>
          </div>
        </div>
        <div className="expect expect--wide">
          <h2>Three clear steps</h2>
          <ol>
            <li><span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="search" /></span><b>1. Choose a service</b>Compare its price, delivery time and device requirements.</li>
            <li><span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="keypad" /></span><b>2. Add device details and email</b>Enter the IMEI, serial or other identifier requested by your service, then review your order before paying.</li>
            <li><span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="clock" /></span><b>3. Order and track</b>Choose your payment method at checkout. Track your order using its private link and receive the result by email.</li>
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

