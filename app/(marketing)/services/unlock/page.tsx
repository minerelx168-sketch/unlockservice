import Link from 'next/link'
import { UnlockDeviceEntry } from '@/components/unlock-device-entry'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor } from '@/lib/device-intent-value'
import { pageMetadata } from '@/lib/seo'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'
import { unlockPreviewProducts } from '@/lib/unlock-catalog-view'

export const dynamic = 'force-dynamic'

export const metadata = pageMetadata(
  '/services/unlock',
  'Phone Unlock Services by Carrier & Device',
  'Enter your IMEI to browse phone unlock services, then review service requirements, prices and delivery estimates before ordering.',
)

/** Only the curated carrier previews are serialized here; the full list requires the IMEI step. */
export default async function UnlockServicesPage() {
  const intent = await readDeviceIntent()
  const previews = unlockPreviewProducts(listPublicProviderProducts('unlock'))
  return (
    <section className="section section--tint service-entry-section">
      <div className="shell">
        <nav className="service-breadcrumb" aria-label="Breadcrumb">
          <Link href="/services">Services</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Unlock Service</span>
        </nav>
        <h1 className="service-entry-title">Phone unlock services</h1>
        <UnlockDeviceEntry initialImei={intentImeiFor(intent, 'unlock')} previewProducts={previews} />
        <div className="service-entry-links">
          <Link href="/services/imei-check">Check your device before unlocking</Link>
          <Link href="/contact">Need help finding your IMEI?</Link>
        </div>
        <p className="service-guides">
          Not sure an unlock is what you need?{' '}
          <Link href="/articles/network-unlock-explained">Network unlocking, explained honestly</Link>
        </p>
      </div>
    </section>
  )
}
