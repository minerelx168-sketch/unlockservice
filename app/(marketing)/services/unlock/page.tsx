import Link from 'next/link'
import { Icon } from '@/components/icons'
import { UnlockDeviceEntry } from '@/components/unlock-device-entry'
import { CARRIERS } from '@/lib/catalog'
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
  const networks = new Set(CARRIERS.map((carrier) => carrier.name)).size

  return (
    <section className="section section--tint service-entry-section">
      <div className="shell">
        <nav className="service-breadcrumb" aria-label="Breadcrumb">
          <Link href="/services">Services</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Unlock Service</span>
        </nav>

        <div className="unlock-two-col">
          <div className="unlock-intro">
            <h1 className="service-entry-title">Phone unlock services</h1>
            <p className="service-hero-tagline">Keep the phone, change the network.</p>
            <p className="t-lead">
              The lock is released in the network&rsquo;s own records against the IMEI, so it survives
              resets and updates. Most orders complete within the turnaround quoted for the network;
              if a network refuses, the held credit returns in full.
            </p>

            <ul className="service-micro" aria-label="Unlock facts">
              <li><Icon name="shieldCheck" strokeWidth={2} />Permanent</li>
              <li><Icon name="bolt" strokeWidth={2} />Remote, nothing installed</li>
              <li><Icon name="wallet" strokeWidth={2} />Held, then charged</li>
              <li><Icon name="globe" strokeWidth={2} />{networks} networks listed</li>
            </ul>

            <div className="requirements-card">
              <h2>
                <Icon name="info" strokeWidth={2} />
                Before you order
              </h2>
              <ul>
                <li><Icon name="checkSmall" strokeWidth={2.4} />Not reported lost, stolen or blacklisted</li>
                <li><Icon name="checkSmall" strokeWidth={2.4} />No unpaid balance on the original line (financed is usually fine)</li>
                <li><Icon name="checkSmall" strokeWidth={2.4} />You know which network it is locked to</li>
              </ul>
              <Link className="button button--secondary" href="/services/imei-check">
                <Icon name="search" strokeWidth={1.9} />
                Check lock and blacklist status first
              </Link>
              <p className="t-small">A Phone Check report shows the carrier, the lock and whether the IMEI is clean.</p>
            </div>

            <div className="expect">
              <h2>What to expect</h2>
              <ol>
                <li>
                  <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="keypad" /></span>
                  <b>1. Enter the IMEI</b>
                  Open the catalog for your device and pick the network service.
                </li>
                <li>
                  <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="clock" /></span>
                  <b>2. The network decides</b>
                  Credit is held while it works. Status is live on the order page.
                </li>
                <li>
                  <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="check" /></span>
                  <b>3. Use any SIM</b>
                  Apple releases over the air; other brands get a code to type once.
                </li>
              </ol>
            </div>
          </div>

          <UnlockDeviceEntry initialImei={intentImeiFor(intent, 'unlock')} previewProducts={previews} />
        </div>

        <div className="service-entry-links">
          <Link href="/services/imei-check">Check your device before unlocking</Link>
          <Link href="/support">Need help finding your IMEI?</Link>
        </div>
        <p className="service-guides">
          Not sure an unlock is what you need?{' '}
          <Link href="/articles/network-unlock-explained">Network unlocking, explained honestly</Link>
        </p>
      </div>
    </section>
  )
}
