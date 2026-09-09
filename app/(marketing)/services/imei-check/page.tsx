import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductCatalog } from '@/components/product-catalog'
import { Icon } from '@/components/icons'
import { ServiceBrowser } from '@/components/service-browser'
import { currentSession } from '@/lib/auth'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor } from '@/lib/device-intent-value'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'

export const metadata: Metadata = {
  title: 'Phone Check services and prices',
  description: 'Browse Phone Check services with prices, availability and delivery estimates.',
}

export const dynamic = 'force-dynamic'

export default async function ImeiCheckServicesPage() {
  const [found, intent] = await Promise.all([currentSession(), readDeviceIntent()])
  const products = listPublicProviderProducts('imei_check')
  const available = products.some((product) => product.status === 'available')
  return (
      <section className="section section--tint service-entry-section">
        <div className="shell">
          <nav className="service-breadcrumb" aria-label="Breadcrumb">
            <Link href="/services">Services</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Phone Check</span>
          </nav>
          <h1 className="service-entry-title">Phone Check services</h1>
          <ServiceBrowser
            products={products}
            domain="imei_check"
            initialImei={intentImeiFor(intent, 'imei_check')}
            initialProductCode={intent?.domain === 'imei_check' ? intent.productCode : undefined}
            isAuthenticated={found !== null}
            availableCents={found ? found.user.credit_cents - found.user.held_cents : undefined}
          />

          {!available ? <p className="alert" role="status"><Icon name="info" /><span>Paid reports are temporarily unavailable. You can <Link href="/check">validate an IMEI for free</Link> or <Link href="/contact">contact support</Link>.</span></p> : null}

          <div className="service-entry-links">
            <Link href="/services/unlock">Looking for an unlock service?</Link>
            <Link href="/check">Validate an IMEI for free</Link>
          </div>

          <details className="service-catalog-details" id="phone-check-catalog">
            <summary>Browse the full Phone Check catalog · {products.length} services</summary>
            <ProductCatalog products={products} domain="imei_check" />
            <p className="t-small service-catalog-version">
              A report describes the phone at the moment it is run, and does not prove who owns it.
            </p>
          </details>

          <p className="service-guides">
            New to this? <Link href="/articles/what-an-imei-check-tells-you">What an IMEI check
            actually tells you</Link> · <Link href="/articles/checks-before-buying-a-used-phone">Checks
            to run before buying a used phone</Link>
          </p>
        </div>
      </section>
  )
}
