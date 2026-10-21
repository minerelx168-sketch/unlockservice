import Link from 'next/link'
import { pageMetadata } from '@/lib/seo'
import { ProductCatalog } from '@/components/product-catalog'
import type { PriceCheckProduct } from '@/components/hero-price-check'
import { PhoneCheckExperience } from '@/components/phone-check-experience'
import { Icon } from '@/components/icons'
import { ScrollTo } from '@/components/scroll-to'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor } from '@/lib/device-intent-value'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'
import '@/styles/phone-check-page.css'

export const dynamic = 'force-dynamic'
export const metadata = pageMetadata('/services/imei-check', 'IMEI Check Reports: Carrier, Blacklist & Warranty', 'Compare paid IMEI reports for carrier, blacklist, warranty and lock-status information. See the price and delivery time, preview your order and choose card or crypto.')

export default async function ImeiCheckServicesPage({ searchParams }: { searchParams: Promise<{ product?: string | string[]; start?: string | string[] }> }) {
  const [intent, query] = await Promise.all([readDeviceIntent(), searchParams])
  const products = listPublicProviderProducts('imei_check')
  const available = products.some((product) => product.status === 'available')
  const requested = typeof query.product === 'string' ? query.product : undefined
  const initialProductCode = requested ?? (intent?.domain === 'imei_check' ? intent.productCode : undefined)
  const quoteProducts: PriceCheckProduct[] = products.map((product) => ({ code: product.productCode, name: product.name, category: product.group, summary: product.summary, available: product.status === 'available', priceCents: product.priceCents, etaLabel: product.etaLabel }))

  return <section className="section phone-check-page">
    <div className="shell">
      <nav className="service-breadcrumb" aria-label="Breadcrumb"><Link href="/services">Services</Link><span aria-hidden="true">/</span><span aria-current="page">Phone Check</span></nav>
      <header className="phone-check-intro"><span className="phone-check-eyebrow"><Icon name="search" />Phone Check</span><h1>Check your phone.<br /><span>Know before you buy.</span></h1><p>Carrier, blacklist and device reports. Choose a check and get the result online and by email.</p></header>
      <div id="imei-check-browse" className="phone-check-entry">{query.start === '1' ? <ScrollTo targetId="imei-check-browse" /> : null}<PhoneCheckExperience key={initialProductCode ?? 'quick-picks'} products={quoteProducts} initialImei={intentImeiFor(intent, 'imei_check')} initialProductCode={initialProductCode} initialEmail={intent?.domain === 'imei_check' ? intent.email : undefined} /></div>
      <section className="phone-check-how" aria-labelledby="phone-check-how-title"><h2 id="phone-check-how-title">From IMEI to answers.</h2><ol><li><span>01</span><div><h3>Choose your check</h3><p>See its price and delivery time.</p></div></li><li><span>02</span><div><h3>Review & pay</h3><p>Enter your IMEI and result email.</p></div></li><li><span>03</span><div><h3>Open your report</h3><p>Track online. Get the result by email.</p></div></li></ol></section>
      {!available ? <p className="alert" role="status"><Icon name="info" /><span>Paid reports are temporarily unavailable. <Link href="/check">Validate an IMEI for free</Link> or <Link href="/contact">contact support</Link>.</span></p> : null}
      <details className="service-catalog-details phone-check-catalog" id="phone-check-catalog"><summary>Explore all {products.length} checks</summary><ProductCatalog products={products} domain="imei_check" /><p className="t-small service-catalog-version">A report describes the phone at the moment it is run and does not prove who owns it.</p></details>
      <section className="phone-check-help" aria-labelledby="phone-check-help-title"><h2 id="phone-check-help-title">A few helpful details.</h2><details><summary>Which check do I need?</summary><p>Choose Blacklist for a lost or stolen status check, iPhone for Apple device information, or Samsung for device information. Use More reports to find warranty, lock-status and other checks. Each service lists what it includes.</p></details><details><summary>When will my result be ready?</summary><p>The estimated delivery time is shown with your selected check. Processing starts after payment is confirmed. Your private order link shows progress, and the completed result is sent by email.</p></details><details><summary>Does a report unlock my phone?</summary><p>No. A report gives you information about your device. If you want to remove a network lock, <Link href="/services/unlock">choose an unlock service</Link>.</p></details></section>
      <div className="phone-check-links"><Link href="/track"><Icon name="clock" />Track an order</Link><Link href="/check"><Icon name="shieldCheck" />Free IMEI format check</Link><Link href="/contact"><Icon name="question" />Need help choosing?</Link></div>
    </div>
  </section>
}
