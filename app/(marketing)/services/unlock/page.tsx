import type { Metadata } from 'next'
import Link from 'next/link'
import { ProductCatalog } from '@/components/product-catalog'
import { ServiceBrowser } from '@/components/service-browser'
import { currentSession } from '@/lib/auth'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor } from '@/lib/device-intent-value'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'

export const metadata: Metadata = {
  title: 'Phone unlock services and prices',
  description: 'Browse phone unlock services and published prices by network, country and device type.',
}

export const dynamic = 'force-dynamic'

export default async function UnlockServicesPage() {
  const [found, intent] = await Promise.all([currentSession(), readDeviceIntent()])
  const products = listPublicProviderProducts('unlock')
  const available = products.some((product) => product.status === 'available')

  return (
      <section className="section section--tint service-entry-section">
        <div className="shell">
          <nav className="service-breadcrumb" aria-label="Breadcrumb">
            <Link href="/services">Services</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Unlock Service</span>
          </nav>
          <h1 className="service-entry-title">Unlock services</h1>
          <ServiceBrowser
            products={products}
            domain="unlock"
            initialImei={intentImeiFor(intent, 'unlock')}
            initialProductCode={intent?.domain === 'unlock' ? intent.productCode : undefined}
            isAuthenticated={found !== null}
            availableCents={found ? found.user.credit_cents - found.user.held_cents : undefined}
          />

          <div className="service-entry-links">
            <Link href="/services/imei-check">Check your device before unlocking</Link>
            {!available ? <Link href="/unlock-waitlist">Notify me when ordering opens</Link> : null}
          </div>

          <details className="service-catalog-details" id="unlock-catalog">
            <summary>Browse the full Unlock catalog · {products.length} services</summary>
            <ProductCatalog products={products} domain="unlock" />
            <p className="t-small service-catalog-version">
              Compare the price, device requirements and delivery estimate for each service.
              Services marked unavailable cannot be ordered online yet.
            </p>
          </details>

          <p className="service-guides">
            Not sure an unlock is what you need?{' '}
            <Link href="/articles/network-unlock-explained">Network unlocking, explained
            honestly</Link> · <Link href="/articles/what-an-imei-check-tells-you">What an IMEI check
            actually tells you</Link>
          </p>
        </div>
      </section>
  )
}
