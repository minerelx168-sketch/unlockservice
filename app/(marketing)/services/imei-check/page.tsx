import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { ProductCatalog } from '@/components/product-catalog'
import { Icon, type IconName } from '@/components/icons'
import { ReportCard } from '@/components/report-card'
import { ServiceBrowser } from '@/components/service-browser'
import { currentSession } from '@/lib/auth'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor } from '@/lib/device-intent-value'
import { listPublicProviderProducts, type PublicProviderProduct } from '@/lib/public-provider-catalog'
import { getServiceOutputExample } from '@/lib/service-output-examples'
import { serviceText } from '@/lib/unlock-catalog-view'

export const dynamic = 'force-dynamic'

export const metadata = pageMetadata("/services/imei-check", "IMEI Check Reports: Carrier, Blacklist & Warranty", "Compare paid IMEI reports for carrier, blacklist, warranty and lock-status information. Check what each report includes, its price and availability.")

const STEPS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'keypad', title: 'Enter the IMEI', body: 'Dial *#06# on the phone, or read it from Settings or the SIM tray.' },
  { icon: 'search', title: 'Choose a report', body: 'Blacklist, carrier, warranty, activation lock — each priced on its own.' },
  { icon: 'wallet', title: 'Pay from credit', body: 'Credit is held while the report runs and charged only when it is delivered.' },
  { icon: 'file', title: 'Read the result', body: 'On the order page and by email, kept on the order for as long as you need it.' },
]

/* The three reports most buyers reach for first, found by name so the
   chips follow the catalog rather than a hard-coded code. */
function quickPicks(products: PublicProviderProduct[]) {
  const wanted: Array<{ pattern: RegExp; icon: IconName; kicker: string }> = [
    { pattern: /black ?list|lost|stolen/i, icon: 'shield', kicker: 'Any brand' },
    { pattern: /carrier|sim ?lock|network|unlock status/i, icon: 'lock', kicker: 'Lock status' },
    { pattern: /warranty|basic|info|activation/i, icon: 'device', kicker: 'Device facts' },
  ]
  const picks: Array<{ product: PublicProviderProduct; icon: IconName; kicker: string }> = []
  for (const want of wanted) {
    const product = products.find((entry) => want.pattern.test(entry.name) && !picks.some((pick) => pick.product === entry))
    if (product) picks.push({ product, icon: want.icon, kicker: want.kicker })
  }
  return picks
}

export default async function ImeiCheckServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>
}) {
  const [found, intent, query] = await Promise.all([currentSession(), readDeviceIntent(), searchParams])
  const products = listPublicProviderProducts('imei_check')
  const available = products.some((product) => product.status === 'available')
  /* A code in the address (from the hero widget or the drawer) preselects
     the report, but only if it is one we list — anything else is ignored. */
  const requested = typeof query.product === 'string' ? query.product : undefined
  const initialProductCode =
    (intent?.domain === 'imei_check' ? intent.productCode : undefined)
    ?? products.find((product) => product.productCode === requested)?.productCode

  /* The sample card shows a reviewed example from the catalog itself, so
     what the visitor sees is the shape of what they would buy. */
  const sample = products
    .map((product) => ({ product, example: getServiceOutputExample(product.productCode) }))
    .find((entry) => entry.example !== null)
  const picks = quickPicks(products)

  return (
    <section className="section section--tint service-entry-section">
      <div className="shell">
        <nav className="service-breadcrumb" aria-label="Breadcrumb">
          <Link href="/services">Services</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Phone Check</span>
        </nav>

        <div className="service-hero">
          <div className="service-hero-copy">
            <span className="hero-chip">
              <Icon name="shieldCheck" strokeWidth={2} />
              Read from the carrier and manufacturer records
            </span>
            <h1 className="service-entry-title">IMEI check reports</h1>
            <p className="service-hero-tagline">Know the phone before you pay for it.</p>
            <p className="t-lead">
              Blacklist, lost-or-stolen, carrier lock, warranty and activation status from the IMEI
              alone. Works on any brand, with the price shown before anything is ordered.
            </p>

            {picks.length ? (
              <div className="quick-picks">
                <div className="quick-picks-label">
                  <span>Quick picks</span>
                  <a href="#phone-check-catalog">See all {products.length} reports ↓</a>
                </div>
                <div className="quick-pick-row">
                  {picks.map((pick) => (
                    <Link
                      key={pick.product.productCode}
                      className="quick-pick"
                      href={`/services/imei-check?product=${encodeURIComponent(pick.product.productCode)}#imei-check-browse`}
                    >
                      <span className="icon-tile icon-tile--sm" aria-hidden="true">
                        <Icon name={pick.icon} />
                      </span>
                      <span>
                        {serviceText(pick.product.name)}
                        <small>{pick.kicker}</small>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            <ul className="service-micro" aria-label="How reports are delivered">
              <li><Icon name="bolt" strokeWidth={2} />Most reports in minutes</li>
              <li><Icon name="shieldCheck" strokeWidth={2} />Credit held, not charged</li>
              <li><Icon name="lock" strokeWidth={2} />IMEI masked in every list</li>
            </ul>
          </div>

          {sample?.example ? (
            <aside className="sample-report" aria-label="Sample report">
              <div className="sample-report-head">
                <span>
                  <span className="icon-tile icon-tile--sm" aria-hidden="true">
                    <Icon name="file" />
                  </span>
                  <span>
                    <small>Sample report</small>
                    <b>{serviceText(sample.product.name)}</b>
                  </span>
                </span>
                <span className="sample-pill">Illustrative</span>
              </div>
              <div className="sample-imei">
                <span>IMEI</span>
                <b>35•• •••• ••80</b>
                <span>masked</span>
              </div>
              <ReportCard text={sample.example.variants[0].output} fallbackClassName="provider-code-result" limit={{ critical: 5, identity: 3, details: 0 }} />
              <p className="sample-report-foot">
                <span><Icon name="checkSmall" strokeWidth={2.4} />Shortened — the full report has more rows</span>
                <span>Example data, not a real device</span>
              </p>
            </aside>
          ) : null}
        </div>

        <ol className="step-strip" aria-label="How a report works">
          {STEPS.map((step, index) => (
            <li key={step.title}>
              <em aria-hidden="true">{String(index + 1).padStart(2, '0')}</em>
              <span className="icon-tile icon-tile--sm" aria-hidden="true">
                <Icon name={step.icon} />
              </span>
              <b>{step.title}</b>
              <span>{step.body}</span>
            </li>
          ))}
        </ol>

        <div id="imei-check-browse">
          <ServiceBrowser
            products={products}
            domain="imei_check"
            initialImei={intentImeiFor(intent, 'imei_check')}
            initialProductCode={initialProductCode}
            isAuthenticated={found !== null}
            availableCents={found ? found.user.credit_cents - found.user.held_cents : undefined}
          />
        </div>

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
