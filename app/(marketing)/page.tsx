import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { HeroPriceCheck, type PriceCheckProduct } from '@/components/hero-price-check'
import { Icon, type IconName } from '@/components/icons'
import { Testimonials } from '@/components/testimonials'
import { BRANDS, CARRIERS } from '@/lib/catalog'
import { serviceStatus, unlockOrderingEnabled } from '@/lib/provider'
import { listPublicProviderProducts } from '@/lib/public-provider-catalog'
import { SAMPLE_TESTIMONIALS } from '@/lib/testimonials'
import { unlockCategory } from '@/lib/unlock-catalog-view'
import { StructuredData } from './structured-data'

const ELIGIBILITY: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'shield',
    title: 'Not reported lost or stolen',
    body: 'A theft or loss report blocks every network. A Phone Check report shows the status before you spend anything.',
  },
  {
    icon: 'check',
    title: 'Account in good standing',
    body: 'An unpaid balance or an active contract on the original line is the most common reason a network says no.',
  },
  {
    icon: 'wallet',
    title: 'Financed? Often still fine',
    body: 'Many networks release financed handsets once the account is current. If yours refuses, the held credit returns in full.',
  },
]

const STEPS: Array<{ title: string; body: string; art: 'imei' | 'review' | 'done' }> = [
  {
    title: 'Enter the IMEI',
    body: 'Dial *#06# on the phone and type the 15 digits. We validate the number before anything becomes an order.',
    art: 'imei',
  },
  {
    title: 'Confirm the quote',
    body: 'The price and the typical wait for your network are shown first. Credit is held, not charged, while the network checks the device.',
    art: 'review',
  },
  {
    title: 'Use any SIM',
    body: 'Apple devices release over the air; other brands receive a code to type once. Refused devices give the whole amount back.',
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

const FAQ = [
  {
    question: 'Is this permanent, and is my warranty safe?',
    answer:
      'Yes to both. The unlock is recorded against the IMEI in the carrier or manufacturer database, so it survives updates, resets and new SIMs. Nothing is installed on the device and no software is modified, which is what puts a warranty at risk.',
  },
  {
    question: 'How long does it take?',
    answer:
      'It depends on the network — some authorise within hours, others take a couple of days. The turnaround for your exact carrier is quoted before you order, and the order shows its live status until it lands.',
  },
  {
    question: 'What if my device cannot be unlocked?',
    answer:
      'Your account credit is reserved while the order is with the carrier and charged only when the unlock is delivered. If the carrier refuses the order, the full reserved amount returns to your account balance. This releases account credit; it is not a refund to your original payment method.',
  },
  {
    question: 'Where do I find my IMEI?',
    answer:
      'Dial *#06# on the device — it works on iOS and Android. It is also printed on the SIM tray, on the original box, and shown in the settings app under the device’s About screen.',
  },
  {
    question: 'Do I have to send my phone anywhere?',
    answer:
      'No. Everything is done remotely against the IMEI. Apple devices are released over the air — connect to Wi-Fi and follow the prompt. Other brands receive a code you enter once, with a SIM from the new network in the device.',
  },
  {
    question: 'Can you unlock a phone that is still on contract?',
    answer:
      'Eligibility depends on the carrier. An unpaid balance, an active contract or a lost-or-stolen report may prevent unlocking. If the carrier refuses the order, the full reserved credit returns to your account balance.',
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
    priceCents: product.priceCents,
    etaLabel: product.etaLabel,
  }))
  const checkWidget: PriceCheckProduct[] = checkProducts.map((product) => ({
    code: product.productCode,
    name: product.name,
    category: product.group,
    priceCents: product.priceCents,
    etaLabel: product.etaLabel,
  }))

  const heroTiles: Array<{ icon: IconName; title: string; caption: string }> = [
    { icon: 'bolt', title: 'Remote', caption: 'Nothing installed, no shop visit' },
    { icon: 'shieldCheck', title: 'Held, not charged', caption: 'Credit returns if the network refuses' },
    { icon: 'lock', title: 'Permanent', caption: 'Recorded against the IMEI itself' },
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
              Filed with the network that holds the lock
            </span>

            <h1 className="t-hero">
              {ordering ? 'Unlock your phone by IMEI.' : 'Find the right service for your phone.'}
              <br />
              <span className="accent">
                {ordering ? 'See the price and the wait before you pay.' : 'Browse prices and check availability.'}
              </span>
            </h1>

            <p className="t-lead">
              {ordering
                ? 'Pick the network your phone is locked to and the quote appears — then enter the IMEI. Credit is held while the network works and returned in full if it refuses.'
                : 'Explore device reports and unlock services. Enter your IMEI to get started, or browse prices first. You can compare services before creating an account.'}
            </p>

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

            <p className="hero-asides">
              <Link href="/services/imei-check">Just want a device report?</Link>
              <span aria-hidden="true">·</span>
              <Link href="/track">Track an order</Link>
            </p>
          </div>

          <div className="hero-panel">
            <HeroPriceCheck unlock={unlockWidget} check={checkWidget} ordering={ordering} />
          </div>
        </div>
      </section>

      {/* 02 · Networks */}
      <section className="section section--tint home-section" id="networks">
        <div className="shell">
          <div className="section-head section-head--center">
            <span className="kicker">
              <Icon name="globe" strokeWidth={2} />
              Networks
            </span>
            <h2 className="t-section">
              Locked to one of these? <span className="accent">Start here.</span>
            </h2>
            <p className="t-lead">
              The networks the catalog lists today. Each one shows its own price and typical turnaround
              before you order.
            </p>
          </div>

          <ul className="tile-grid" aria-label="Networks">
            {CARRIERS.map((carrier) => (
              <li key={carrier.id}>
                <Link className="tile" href="/services/unlock">
                  <i aria-hidden="true">{carrier.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 2)}</i>
                  <span>
                    {carrier.name}
                    <small>{carrier.country}</small>
                  </span>
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
                the held credit returns to your balance — nothing is charged for a refusal.
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

      {/* 04 · Reviews — sample content, labelled as such */}
      <Testimonials items={SAMPLE_TESTIMONIALS} />

      {/* 05 · FAQ */}
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

      {/* 06 · Brands */}
      <section className="section section--tint home-section" id="brands">
        <div className="shell">
          <div className="section-head section-head--center">
            <span className="kicker">
              <Icon name="device" strokeWidth={2} />
              Supported devices
            </span>
            <h2 className="t-section">
              Brands we <span className="accent">work with.</span>
            </h2>
            <p className="t-lead">
              Apple devices are released over the air. Every other brand receives a code to type in once.
            </p>
          </div>

          <ul className="tile-grid" aria-label="Brands">
            {BRANDS.map((brand) => (
              <li key={brand.id}>
                <Link className="tile" href="/services/unlock">
                  <i aria-hidden="true">{brand.name.slice(0, 1)}</i>
                  <span>
                    {brand.name}
                    <small>{brand.delivery === 'remote' ? 'Released remotely' : 'Unlock code'}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 07 · Service hub + help band */}
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
