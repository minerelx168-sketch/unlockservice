import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { HeroPriceCheck, type PriceCheckProduct } from '@/components/hero-price-check'
import { Icon, type IconName } from '@/components/icons'
import { BRANDS, CARRIERS } from '@/lib/catalog'
import { FAQ } from '@/lib/faq'
import { serviceStatus, unlockOrderingEnabled } from '@/lib/provider'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'
import { quickPicks } from '@/lib/quick-picks'
import { unlockCategory } from '@/lib/unlock-catalog-view'
import { StructuredData } from './structured-data'

const ELIGIBILITY: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'shield',
    title: 'Not reported lost or stolen',
    body: 'A lost-or-stolen report may prevent unlocking or activation. Review the selected report’s coverage and the carrier’s eligibility policy before ordering.',
  },
  {
    icon: 'check',
    title: 'Account in good standing',
    body: 'An unpaid balance or an active contract on the original line is the most common reason a network says no.',
  },
  {
    icon: 'wallet',
    title: 'Check financing requirements',
    body: 'Financing and account requirements depend on the original carrier. Check its current policy before ordering; if the service is refused, direct card payments are refunded to the original payment method.',
  },
]

const STEPS: Array<{ title: string; body: string; art: 'imei' | 'review' | 'done' }> = [
  {
    title: 'Choose your service',
    body: 'Select your original network or report. See the service price and estimated delivery before entering an IMEI.',
    art: 'imei',
  },
  {
    title: 'Add your IMEI and review',
    body: 'Dial *#06# to find the 15 digits. Add your result email, review the requirements, then choose card or crypto. Card orders below $1 need an account.',
    art: 'review',
  },
  {
    title: 'Use a supported SIM',
    body: 'When the service is delivered, follow its device-specific instructions. Use a SIM from a network whose bands your phone supports. A refused direct card order is refunded to the original payment method.',
    art: 'done',
  },
]

const HUB: Array<{ icon: IconName; tint: string; title: string; body: string; href: string; chip?: string }> = [
  {
    icon: 'lock',
    tint: '',
    title: 'Network unlock',
    body: 'Remove the carrier lock by IMEI. Price and turnaround quoted per network.',
    href: '/services/unlock',
  },
  {
    icon: 'search',
    tint: ' icon-tile--accent',
    title: 'Phone Check reports',
    body: 'Carrier, blacklist, warranty, activation lock and more, from the IMEI alone.',
    href: '/services/imei-check',
  },
  {
    icon: 'shield',
    tint: ' icon-tile--moss',
    title: 'Blacklist and lost-or-stolen',
    body: 'The one report to run before paying for a used phone.',
    href: '/services/imei-check',
  },
  {
    icon: 'keypad',
    tint: '',
    title: 'Basic IMEI validation',
    body: 'Confirms the number is a real, well-formed IMEI. Nothing is ordered.',
    href: '/check',
    chip: 'Free',
  },
  {
    icon: 'clock',
    tint: ' icon-tile--accent',
    title: 'Track an order',
    body: 'Live status for every order, and the result kept on the order page.',
    href: '/track',
  },
  {
    icon: 'file',
    tint: ' icon-tile--moss',
    title: 'Guides',
    body: 'Carrier policies, unlock timing and what an IMEI check really tells you.',
    href: '/articles',
  },
]


export const metadata = pageMetadata("/", "IMEI Phone Unlocking & Device Check Reports", "Compare IMEI phone unlock services and device reports. Review availability, prices and delivery estimates before ordering with iUnlockMobile.")

/* Small, original line drawings for the three steps. */
function StepArt({ kind }: { kind: 'imei' | 'review' | 'done' }) {
  if (kind === 'imei') {
    return (
      <svg viewBox="0 0 150 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect className="soft" x="52" y="8" width="46" height="84" rx="9" stroke="none" />
        <rect x="52" y="8" width="46" height="84" rx="9" />
        <path d="M68 16h14" />
        <rect x="60" y="30" width="30" height="12" rx="3" className="ink" />
        <path d="M64 36h4M70 36h4M76 36h4M82 36h4" className="ink" />
        <path d="M60 52h30M60 60h30M60 68h22" opacity=".55" />
        <path d="M18 50h22M28 40l10 10-10 10" />
      </svg>
    )
  }
  if (kind === 'review') {
    return (
      <svg viewBox="0 0 150 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect className="soft" x="22" y="18" width="106" height="64" rx="10" stroke="none" />
        <rect x="22" y="18" width="106" height="64" rx="10" />
        <path d="M34 34h40" className="ink" />
        <path d="M34 46h28" opacity=".55" />
        <rect x="86" y="30" width="30" height="20" rx="5" />
        <path d="M92 40h18" className="ink" />
        <path d="M34 64h82" opacity=".35" />
        <circle cx="112" cy="68" r="9" className="soft" stroke="none" />
        <path d="M107 68l3.5 3.5 6-7" className="ok" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 150 100" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect className="soft" x="54" y="8" width="42" height="84" rx="9" stroke="none" />
      <rect x="54" y="8" width="42" height="84" rx="9" />
      <path d="M69 16h12" />
      <rect x="64" y="34" width="22" height="30" rx="5" className="ink" />
      <path d="M70 34v-5a5 5 0 0 1 10 0" className="ink" />
      <path d="M22 30h8l6 10 6-20 6 24 6-14h10" className="ok" />
      <path d="M104 44l18-10M104 56h18M104 68l18 10" opacity=".5" />
    </svg>
  )
}

export default function HomePage() {
  const unlockProducts = listPublicProviderProducts('unlock')
  const checkProducts = listPublicProviderProducts('imei_check')
  const ordering = unlockOrderingEnabled() || unlockProducts.some((product) => product.status === 'available')
  const status = !ordering && serviceStatus()
  const networks = new Set(CARRIERS.map((carrier) => carrier.name)).size
  const countries = [...new Set(CARRIERS.map((carrier) => carrier.country))]

  const unlockWidget: PriceCheckProduct[] = unlockProducts.map((product) => ({
    code: product.productCode,
    name: product.name,
    category: unlockCategory(product),
    summary: product.summary,
    available: product.status === 'available',
    priceCents: product.priceCents,
    etaLabel: product.etaLabel,
  }))
  const checkWidget: PriceCheckProduct[] = checkProducts.map((product) => ({
    code: product.productCode,
    name: product.name,
    category: product.group,
    summary: product.summary,
    available: product.status === 'available',
    priceCents: product.priceCents,
    etaLabel: product.etaLabel,
  }))

  /* Two report chips from the catalog and the unlock itself: the three
     things a visitor arrives for, one tap from the headline. */
  const picks = quickPicks(checkProducts, 2)

  const heroTiles: Array<{ icon: IconName; title: string; caption: string }> = [
    { icon: 'bolt', title: 'Remote', caption: 'Nothing installed, no shop visit' },
    { icon: 'shieldCheck', title: 'Pay per order', caption: 'Card or crypto, with the total shown before payment' },
    { icon: 'lock', title: 'Carrier-approved', caption: 'Eligibility and method depend on the selected service' },
    { icon: 'globe', title: `${networks} networks`, caption: `Across ${countries.length} countries, more on request` },
  ]

  return (
    <>
      <StructuredData faq={FAQ} />

      {/* 01 · Hero */}
      <section className="hero home-hero" id="check">
        <div className="shell">
          <div className="hero-copy">
            {status ? (
              <p className="alert" role="status">
                <Icon name="info" strokeWidth={1.9} />
                <span>
                  <b>Unlock ordering is paused.</b> You can browse service prices and follow existing orders.
                </span>
              </p>
            ) : null}

            <span className="hero-chip">
              <Icon name="shieldCheck" strokeWidth={2} />
              Official carrier unlocks since 2016
            </span>

            <h1 className="t-hero">
              {ordering ? 'Unlock your phone.' : 'Know your phone.'}
              <br />
              <span className="accent">
                See your options.
              </span>
            </h1>

            <p className="t-lead">
              {ordering
                ? 'Compare prices and delivery times for your original network. Review the service before you pay.'
                : 'Explore device reports and unlock services. Compare prices and availability, then choose card or crypto at checkout.'}
            </p>


          </div>

          <div className="hero-panel">
            <HeroPriceCheck unlock={unlockWidget} check={checkWidget} ordering={ordering} />
          </div>

          <div className="hero-extras">
            <div className="quick-picks">
              <div className="quick-picks-label">
                <span>Quick picks</span>
                <Link href="/services">All services →</Link>
              </div>
              <div className="quick-pick-row">
                <Link className="quick-pick" href="/services/unlock">
                  <span className="icon-tile icon-tile--sm" aria-hidden="true">
                    <Icon name="lock" />
                  </span>
                  <span>
                    Unlock my phone
                    <small>{networks} networks</small>
                  </span>
                </Link>
                {picks.map((pick) => (
                  <Link
                    key={pick.product.productCode}
                    className="quick-pick"
                    href={`/services/imei-check?product=${encodeURIComponent(pick.product.productCode)}`}
                  >
                    <span className="icon-tile icon-tile--sm" aria-hidden="true">
                      <Icon name={pick.icon} />
                    </span>
                    <span>
                      {pick.short}
                      <small>{pick.kicker}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="hero-tiles">
              {heroTiles.map((tile) => (
                <div className="hero-tile" key={tile.title}>
                  <span className="trust-bar-icon" aria-hidden="true">
                    <Icon name={tile.icon} strokeWidth={1.9} />
                  </span>
                  <b>{tile.title}</b>
                  <span>{tile.caption}</span>
                </div>
              ))}
            </div>

            <p className="quick-form-help hero-imei-tip">
              Dial <kbd>*#06#</kbd> on the phone to see its IMEI.
              <Link href="/support#faq"><Icon name="question" strokeWidth={2} />How to find my IMEI</Link>
              <Link href="/track"><Icon name="clock" strokeWidth={2} />Track an order</Link>
            </p>
          </div>
        </div>
      </section>

      {/* 02 · Networks */}
      <section className="section section--tint home-section logo-section" id="networks">
        <div className="shell">
          <div className="section-head section-head--center">
            <span className="kicker">
              <Icon name="globe" strokeWidth={2} />
              Global carriers
            </span>
            <h2 className="t-section">
              Carriers <span className="accent">We Unlock</span>
            </h2>
            <p className="t-lead">
              Browse {networks} listed networks across {countries.length} countries. Check your carrier’s current
              availability, price and typical turnaround before you order.
            </p>
          </div>

          <ul className="logo-grid" aria-label="Networks">
            {CARRIERS.map((carrier) => (
              <li key={carrier.id}>
                <Link className="logo-card" href="/services/unlock">
                  <BrandLogo name={carrier.name} />
                  <h3>{carrier.name}</h3>
                </Link>
              </li>
            ))}
          </ul>

          <div className="tile-foot">
            <p className="t-small">
              Not listed? The unlock catalog carries more networks than fit here, and new ones are added as suppliers open them.
            </p>
            <Link className="button button--quiet" href="/services/unlock">
              <Icon name="search" strokeWidth={1.9} />
              Find your network
            </Link>
          </div>

          <div className="eligibility">
            <div className="section-head">
              <span className="kicker">
                <Icon name="check" strokeWidth={2} />
                Before you order
              </span>
              <h2 className="t-card" style={{ fontSize: 28, letterSpacing: '-0.03em' }}>
                Is your phone eligible?
              </h2>
              <p className="t-small">Thirty seconds of checking saves a refused order. Three things decide it.</p>
            </div>
            <div className="eligibility-grid">
              {ELIGIBILITY.map((item) => (
                <div className="eligibility-item" key={item.title}>
                  <span className="icon-tile icon-tile--sm" aria-hidden="true">
                    <Icon name={item.icon} />
                  </span>
                  <b>{item.title}</b>
                  <p>{item.body}</p>
                </div>
              ))}
            </div>
            <p className="eligibility-note">
              <Icon name="info" strokeWidth={1.9} />
              <span>
                Not sure? Order with the best information you have. If the network turns the device down,
                direct card orders receive an original-method refund; balance-paid orders release the reserved credit.
              </span>
            </p>
          </div>
        </div>
      </section>

      {/* 03 · How it works */}
      <section className="section home-section" id="how">
        <div className="shell">
          <div className="section-head section-head--center">
            <span className="kicker">
              <Icon name="pulse" strokeWidth={2} />
              How it works
            </span>
            <h2 className="t-section">
              Three steps. <span className="accent">Nothing to install.</span>
            </h2>
            <p className="t-lead">The phone stays in your hand the whole time.</p>
          </div>

          <div className="grid-3 home-card-grid">
            {STEPS.map((step, index) => (
              <article className="card card--step" key={step.title}>
                <span className="step-numeral" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="step-art" aria-hidden="true">
                  <StepArt kind={step.art} />
                </div>
                <h3 className="t-card">{step.title}</h3>
                <p className="t-small" style={{ marginTop: 9 }}>
                  {step.body}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 04 · FAQ */}
      <section className="section home-section" id="faq">
        <div className="shell faq">
          <div className="section-head">
            <span className="kicker">
              <Icon name="question" strokeWidth={2} />
              Common questions
            </span>
            <h2 className="t-section">Straight answers before you pay.</h2>
            <p className="t-lead">Including the one most unlock sites leave out — when it will not work.</p>
          </div>

          <div>
            <div className="faq-list">
              {FAQ.map((item, index) => (
                <details className="faq-item" key={item.question} open={index === 0}>
                  <summary>
                    {item.question}
                    <span className="plus" aria-hidden="true">
                      <Icon name="plus" strokeWidth={2.6} />
                    </span>
                  </summary>
                  <div className="answer">{item.answer}</div>
                </details>
              ))}
            </div>
            <p className="faq-foot">
              <Link className="link-arrow" href="/support">
                Still have a question? Visit the help centre
                <Icon name="arrowRight" strokeWidth={2.2} />
              </Link>
            </p>
          </div>
        </div>
      </section>

      {/* 05 · Brands */}
      <section className="section section--tint home-section logo-section" id="brands">
        <div className="shell">
          <div className="section-head section-head--center">
            <span className="kicker">
              <Icon name="device" strokeWidth={2} />
              Supported devices
            </span>
            <h2 className="t-section">
              Top Brands <span className="accent">We Support</span>
            </h2>
            <p className="t-lead">
              Explore services for {BRANDS.length} leading phone brands. Review eligibility and compatible radio bands before ordering.
            </p>
          </div>

          <ul className="logo-grid" aria-label="Brands">
            {BRANDS.map((brand) => (
              <li key={brand.id}>
                <Link className="logo-card" href="/services/unlock">
                  <BrandLogo name={brand.name} />
                  <h3>{brand.name}</h3>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 06 · Service hub + help band */}
      <section className="section home-section" id="services">
        <div className="shell">
          <div className="section-head section-head--center">
            <span className="kicker">
              <Icon name="grid" strokeWidth={2} />
              Everything on offer
            </span>
            <h2 className="t-section">
              One place for the lock <span className="accent">and the facts.</span>
            </h2>
          </div>

          <div className="hub-grid">
            {HUB.map((item) => (
              <Link className="hub-card" href={item.href} key={item.title}>
                <span className={`icon-tile${item.tint}`} aria-hidden="true">
                  <Icon name={item.icon} strokeWidth={1.8} />
                </span>
                <h3>
                  {item.title}
                  {item.chip ? <span className="hub-chip">{item.chip}</span> : null}
                </h3>
                <p>{item.body}</p>
                <span className="link-arrow">
                  Learn more
                  <Icon name="arrowRight" strokeWidth={2.2} />
                </span>
              </Link>
            ))}
          </div>

          <div className="help-band">
            <div>
              <h3>Not sure which one you need?</h3>
              <p>
                The help centre walks through the common cases — buying used, switching network, a phone
                that says “SIM not supported” — and points you at the right service.
              </p>
            </div>
            <div className="cta-actions">
              <Link className="button button--primary" href="/support">
                Open the help centre
                <Icon name="arrowRight" strokeWidth={2.2} />
              </Link>
              <Link className="button button--quiet" href="/contact">
                Contact support
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
