import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { UnlockServiceCatalog } from '@/components/unlock-service-catalog'
import { currentSession } from '@/lib/auth'
import { readDeviceIntent } from '@/lib/device-intent'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'
export const dynamic = 'force-dynamic'

export const metadata = {
  ...pageMetadata('/services/unlock/catalog', 'Choose Your Unlock Service', 'Review unlock service prices, requirements and delivery estimates before ordering.'),
  robots: { index: false, follow: false, noarchive: true },
}

export default async function UnlockServicesPage() {
  const intent = await readDeviceIntent()
  // Check before constructing catalog props: closed client UI still exposes SSR/RSC data.
  // This browsing step is shared by all visitors; it does not verify device ownership.
  if (!intent || intent.domain !== 'unlock') redirect('/services/unlock')
  const found = await currentSession()
  const products = listPublicProviderProducts('unlock')
  const available = products.some((product) => product.status === 'available')

  return (
      <section className="section section--tint service-entry-section">
        <div className="shell">
          <nav className="service-breadcrumb" aria-label="Breadcrumb">
            <Link href="/services">Services</Link>
            <span aria-hidden="true">/</span>
            <Link href="/services/unlock">Unlock Service</Link>
            <span aria-hidden="true">/</span>
            <span aria-current="page">Choose a service</span>
          </nav>
          <h1 className="service-entry-title">Choose your unlock service</h1>
          <UnlockServiceCatalog
            products={products}
            imei={intent.imei}
            initialProductCode={intent.productCode}
            isAuthenticated={found !== null}
            availableCents={found ? found.user.credit_cents - found.user.held_cents : undefined}
          />

          <div className="service-entry-links">
            <Link href="/services/imei-check">Check your device before unlocking</Link>
            {!available ? <Link href="/unlock-waitlist">Notify me when ordering opens</Link> : null}
          </div>

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
