import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { ProductCatalog } from '@/components/product-catalog'
import { Icon, type IconName } from '@/components/icons'
import { ImeiQuickForm } from '@/components/imei-quick-form'
import { PhoneArt, SampleReportCard } from '@/components/sample-report-card'
import { ScrollTo } from '@/components/scroll-to'
import { ServiceBrowser } from '@/components/service-browser'
import { ServiceOutputExample } from '@/components/service-output-example'
import { currentSession } from '@/lib/auth'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor } from '@/lib/device-intent-value'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'
import { preferredSample, quickPicks } from '@/lib/quick-picks'
import { sampleRows } from '@/lib/sample-report'
import { getServiceOutputExample } from '@/lib/service-output-examples'
import { serviceText } from '@/lib/unlock-catalog-view'

export const dynamic = 'force-dynamic'

export const metadata = pageMetadata("/services/imei-check", "IMEI Check Reports: Carrier, Blacklist & Warranty", "Compare paid IMEI reports for carrier, blacklist, warranty and lock-status information. Check what each report includes, its price and availability.")

const STEPS: Array<{ icon: IconName; title: string; body: string }> = [
  { icon: 'keypad', title: 'Enter the IMEI', body: 'Dial *#06# on the phone, or read it from Settings or the SIM tray.' },
  { icon: 'search', title: 'Choose a report', body: 'Blacklist, carrier, warranty, activation lock — each priced on its own.' },
  { icon: 'wallet', title: 'Pay for your report', body: 'Pay by card without an account, or use your existing credit. Receive the result online and by email.' },
  { icon: 'file', title: 'Read the result', body: 'On the order page and by email, kept on the order for as long as you need it.' },
]

export default async function ImeiCheckServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[]; start?: string | string[] }>
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
  const sample = preferredSample(
    products
      .map((product) => {
        const example = getServiceOutputExample(product.productCode)
        const table = example ? sampleRows(example.variants[0].output, 6) : null
        return { product, example, table }
      })
      /* A one-line verdict makes no card; only a report with rows is shown. */
      .filter((entry) => entry.example !== null && entry.table !== null && entry.table.rows.length >= 4),
  )
  const sampleTable = sample?.table ?? null
  const picks = quickPicks(products)
  const start = query.start === '1'
  const instant = products.filter((product) => /^instant/i.test(product.etaLabel)).length

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
              {products.length} reports · read from carrier and manufacturer records
            </span>
            <h1 className="service-entry-title">IMEI check reports</h1>
            <p className="service-hero-tagline">Know the phone before you pay for it.</p>
            <p className="t-lead">
              Blacklist, lost-or-stolen, carrier lock, warranty and activation status from the IMEI
              alone. Works on any brand, with the price shown before anything is ordered.
            </p>

            <ImeiQuickForm
              picks={picks.map((pick) => ({ code: pick.product.productCode, short: pick.short, kicker: pick.kicker, icon: pick.icon }))}
              initialCode={initialProductCode}
              allHref="#phone-check-catalog"
              allLabel={`See all ${products.length} reports ↓`}
            />

            <ul className="service-micro" aria-label="How reports are delivered">
              <li><Icon name="bolt" strokeWidth={2} />{instant} of {products.length} reports are instant</li>
              <li><Icon name="shieldCheck" strokeWidth={2} />Credit held, not charged</li>
              <li><Icon name="lock" strokeWidth={2} />IMEI masked in every list</li>
            </ul>
          </div>

          {sample?.example && sampleTable ? (
            <div className="sample-stage">
              <PhoneArt />
              <SampleReportCard
                eyebrow="Sample report"
                title={serviceText(sample.product.name)}
                pill="Example data"
                icon="shield"
                meta={['Format · as delivered', `${sampleTable.rows.length} of ${sampleTable.total} fields shown`]}
                imei="35•• •••• ••80"
                rows={sampleTable.rows}
                facts={[
                  { icon: 'clock', text: `Typical delivery: ${serviceText(sample.product.etaLabel)}` },
                  { icon: 'checkSmall', text: 'Example data from a reviewed sample, not a real device' },
                ]}
                action={
                  <ServiceOutputExample
                    productCode={sample.product.productCode}
                    productName={serviceText(sample.product.name)}
                    label={`See the full ${sample.product.name.match(/black ?list/i) ? 'blacklist' : 'report'} sample`}
                  />
                }
              />
            </div>
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
          {start ? <ScrollTo targetId="imei-check-browse" /> : null}
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
