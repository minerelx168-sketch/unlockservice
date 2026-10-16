import Link from 'next/link'
import { Icon } from '@/components/icons'
import { PhoneArt, SampleReportCard } from '@/components/sample-report-card'
import { UnlockDeviceEntry } from '@/components/unlock-device-entry'
import { CARRIERS } from '@/lib/catalog'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor } from '@/lib/device-intent-value'
import type { SampleRow } from '@/lib/sample-report'
import { pageMetadata } from '@/lib/seo'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'
import { unlockPreviewProducts } from '@/lib/unlock-catalog-view'

export const dynamic = 'force-dynamic'

export const metadata = pageMetadata(
  '/services/unlock',
  'Phone Unlock Services by Carrier & Device',
  'Enter your IMEI to browse phone unlock services, then review service requirements, prices and delivery estimates before ordering.',
)

/* The sample order: the stages every unlock goes through, with the
   network's own figures from the catalog. Marked as an example on the
   card; nothing here is a real device or a real order. */
function sampleOrder(carrier: (typeof CARRIERS)[number]): SampleRow[] {
  return [
    { label: 'Network', value: `${carrier.name} · ${carrier.country}`, tone: null, icon: 'globe' },
    { label: 'Lock status', value: 'Locked to network', tone: 'warn', icon: 'lock' },
    { label: 'IMEI check', value: 'Clean — not reported', tone: 'good', icon: 'shield' },
    { label: 'Method', value: 'Remote · over the air or a one-time code', tone: null, icon: 'bolt' },
    { label: 'Typical turnaround', value: `About ${carrier.etaHours} hours`, tone: null, icon: 'clock' },
    { label: 'Order status', value: 'Delivered — unlocked', tone: 'good', icon: 'checkSmall' },
  ]
}

/** Only the curated carrier previews are serialized here; the full list requires the IMEI step. */
export default async function UnlockServicesPage() {
  const intent = await readDeviceIntent()
  const previews = unlockPreviewProducts(listPublicProviderProducts('unlock'))
  const networks = new Set(CARRIERS.map((carrier) => carrier.name)).size
  /* The quickest networks first: these are the ones a buyer asks about. */
  const popular = [...CARRIERS].sort((a, b) => a.etaHours - b.etaHours || a.id - b.id).slice(0, 4)
  const sample = CARRIERS.find((carrier) => carrier.country === 'United States') ?? CARRIERS[0]

  return (
    <section className="section section--tint service-entry-section">
      <div className="shell">
        <nav className="service-breadcrumb" aria-label="Breadcrumb">
          <Link href="/services">Services</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Unlock Service</span>
        </nav>

        <div className="service-hero">
          <div className="service-hero-copy">
            <span className="hero-chip">
              <Icon name="shieldCheck" strokeWidth={2} />
              Filed with the network that holds the lock
            </span>
            <h1 className="service-entry-title">Phone unlock services</h1>
            <p className="service-hero-tagline">Keep the phone, change the network.</p>
            <p className="t-lead">
              The lock is released in the network&rsquo;s own records against the IMEI, so it survives
              resets and updates. Most orders complete within the turnaround quoted for the network;
              if a network refuses, the held credit returns in full.
            </p>

            <div className="quick-picks">
              <div className="quick-picks-label">
                <span>Popular networks</span>
                <a href="#networks">See all {networks} networks ↓</a>
              </div>
              <div className="quick-pick-row">
                {popular.map((carrier) => (
                  <a key={carrier.id} className="quick-pick" href="#unlock-entry-heading">
                    <span className="icon-tile icon-tile--sm" aria-hidden="true">
                      <Icon name="globe" />
                    </span>
                    <span>
                      {carrier.name}
                      <small>{carrier.country} · ~{carrier.etaHours}h</small>
                    </span>
                  </a>
                ))}
              </div>
            </div>

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
          </div>

          <div className="sample-stage">
            <PhoneArt />
            <SampleReportCard
              eyebrow="Sample order"
              title="Network unlock"
              pill="Example"
              icon="lock"
              meta={['Escrow · charged on delivery', `${networks} networks listed`]}
              imei="35•• •••• ••80"
              rows={sampleOrder(sample)}
              facts={[
                { icon: 'wallet', text: 'Price and turnaround quoted per network before you order' },
                { icon: 'shieldCheck', text: 'A refused order returns the held credit in full' },
              ]}
              action={
                <Link className="button button--secondary" href="/articles/how-long-does-iphone-carrier-unlock-take">
                  How long an unlock takes
                  <Icon name="arrowRight" strokeWidth={2} />
                </Link>
              }
            />
          </div>
        </div>

        <div className="unlock-entry-wide">
          <UnlockDeviceEntry initialImei={intentImeiFor(intent, 'unlock')} previewProducts={previews} />
        </div>

        <div className="expect expect--wide">
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

        <ul className="tile-grid" id="networks" aria-label="Networks">
          {CARRIERS.map((carrier) => (
            <li key={carrier.id}>
              <a className="tile" href="#unlock-entry-heading">
                <i aria-hidden="true">{carrier.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2)}</i>
                <span>
                  {carrier.name}
                  <small>{carrier.country} · ~{carrier.etaHours}h</small>
                </span>
              </a>
            </li>
          ))}
        </ul>

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
