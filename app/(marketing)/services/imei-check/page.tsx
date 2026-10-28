import Link from 'next/link'
import { pageMetadata } from '@/lib/seo'
import { ProductCatalog } from '@/components/product-catalog'
import { HeroPriceCheck, type PriceCheckProduct } from '@/components/hero-price-check'
import { Icon } from '@/components/icons'
import { ScrollTo } from '@/components/scroll-to'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor } from '@/lib/device-intent-value'
import { listStorefrontProviderProducts } from '@/lib/public-provider-catalog'

export const dynamic = 'force-dynamic'
export const metadata = pageMetadata('/services/imei-check', 'IMEI Check Reports: Carrier, Blacklist & Warranty', 'Compare paid IMEI reports for carrier, blacklist, warranty and lock-status information. See the price and delivery time, preview your order and choose card or crypto.')

export default async function ImeiCheckServicesPage({ searchParams }: { searchParams: Promise<{ product?: string | string[]; start?: string | string[] }> }) {
  const [intent, query] = await Promise.all([readDeviceIntent(), searchParams])
  const products = listStorefrontProviderProducts('imei_check')
  const available = products.some((product) => product.status === 'available')
  const requested = typeof query.product === 'string' ? query.product : undefined
  const initialProductCode = products.find((product) => product.productCode === requested)?.productCode ?? products.find((product) => product.productCode === intent?.productCode)?.productCode
  const quoteProducts: PriceCheckProduct[] = products.map((product) => ({ code: product.productCode, domain: product.domain, name: product.name, category: product.group, summary: product.summary, hasExample: product.hasExample, available: product.status === 'available', inputType: product.inputType, priceCents: product.priceCents, priceAvailable: product.priceAvailable, etaLabel: product.etaLabel }))

  return <section className="section section--tint service-entry-section unlock-landing">
    <div className="shell">
      <nav className="service-breadcrumb" aria-label="Breadcrumb"><Link href="/services">Services</Link><span aria-hidden="true">/</span><span aria-current="page">Phone Check</span></nav>
      <div className="unlock-landing-grid">
        <div className="service-hero-copy unlock-landing-intro"><span className="hero-chip"><Icon name="search" />Phone Check reports</span><h1 className="service-entry-title">Know more about<br /><span className="accent">your phone.</span></h1><p className="t-lead">Choose the report you need, with its price and delivery time shown upfront. Preview your order, pay once, and receive the full result online and by email.</p><ul className="service-micro" aria-label="Report facts"><li><Icon name="wallet" />Pay per report</li><li><Icon name="lock" />Secure checkout</li><li><Icon name="file" />Private results</li></ul></div>
        <div className="hero-panel unlock-landing-form" id="imei-check-browse">{query.start === '1' ? <ScrollTo targetId="imei-check-browse" /> : null}<HeroPriceCheck key={initialProductCode ?? 'unselected'} unlock={[]} check={quoteProducts} ordering={false} fixedDomain="imei_check" initialImei={intentImeiFor(intent, products.find((product) => product.productCode === initialProductCode)?.domain ?? 'imei_check')} initialProductCode={initialProductCode} initialEmail={intent?.productCode === initialProductCode ? intent?.email : undefined} /></div>
        <div className="requirements-card unlock-landing-requirements"><h2><Icon name="shieldCheck" />Choose the right report</h2><ul><li><Icon name="checkSmall" />Each report covers the information in its service description.</li><li><Icon name="checkSmall" />A Phone Check report provides information; it does not unlock your phone.</li><li><Icon name="checkSmall" />The real check starts after payment. Delivery time depends on the report.</li></ul><Link className="link-arrow" href="/services/unlock">Need to unlock your network instead?<Icon name="arrowRight" /></Link><p className="t-small">If we cannot deliver a direct card order, we request a full refund to the original payment method. A completed report describes the device at the time it was checked.</p></div>
      </div>
      <div className="expect expect--wide"><h2>From price to report in three steps</h2><ol><li><span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="search" /></span><b>1. Choose your report</b>See the service price, delivery estimate and included information.</li><li><span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="keypad" /></span><b>2. Add the required details</b>Enter your email and the identifier requested by your report, then choose card or crypto. Your payment total is shown before you continue.</li><li><span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="file" /></span><b>3. Open your result</b>Follow the private order link. Your full report appears as soon as it is ready and is also sent by email.</li></ol></div>
      {!available ? <p className="alert" role="status"><Icon name="info" /><span>Paid reports are temporarily unavailable. <Link href="/check">Try Apple Free Check</Link> or <Link href="/contact">contact support</Link>.</span></p> : null}
      <div className="service-entry-links"><Link href="/track">Track an existing order</Link><Link href="/check">Try Apple Free Check</Link></div>
      <details className="service-catalog-details" id="phone-check-catalog"><summary>Browse the full Phone Check catalog · {products.length} services</summary><ProductCatalog products={products} domain="imei_check" /><p className="t-small service-catalog-version">A report describes the phone at the moment it is run and does not prove who owns it.</p></details>
      <p className="service-guides">New to this? <Link href="/articles/what-an-imei-check-tells-you">What an IMEI check actually tells you</Link> · <Link href="/articles/checks-before-buying-a-used-phone">Checks to run before buying a used phone</Link></p>
    </div>
  </section>
}

