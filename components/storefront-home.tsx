import {homeText,homeFaq} from '@/lib/i18n/home'
import {localProduct} from '@/lib/i18n/catalog'
import {formatServiceMeta} from '@/lib/i18n/messages'
import {type GeoLocale,locales,paths,homePaths} from '@/lib/geo-locales'

import Link from 'next/link'
import { BrandLogo } from '@/components/brand-logo'
import { HeroPriceCheck, type PriceCheckProduct } from '@/components/hero-price-check'
import { Icon, type IconName } from '@/components/icons'
import { BRANDS, CARRIERS } from '@/lib/catalog'
import { FAQ } from '@/lib/faq'
import { serviceStatus, unlockOrderingEnabled } from '@/lib/provider'
import { listStorefrontProviderProducts } from '@/lib/public-provider-catalog'
import { quickPicks } from '@/lib/quick-picks'
import { StructuredData } from '@/app/(marketing)/structured-data'

const ELIGIBILITY: Array<{ icon: IconName; title: string; body: string }> = [
  {
    icon: 'shield',
    title: 'Not reported missing or stolen',
    body: 'A missing-device report can block the unlock. Run a Phone Check first if unsure.',
  },
  {
    icon: 'check',
    title: 'Account in good standing',
    body: 'An unpaid balance or active contract is the most common reason for a refusal.',
  },
  {
    icon: 'wallet',
    title: 'Check financing requirements',
    body: 'Rules depend on the original carrier. If it refuses, card payments are refunded.',
  },
]

const STEPS: Array<{ title: string; body: string; art: 'imei' | 'review' | 'done' }> = [
  {
    title: 'Choose your service',
    body: 'Pick your network or report and see the price and delivery time.',
    art: 'imei',
  },
  {
    title: 'Add your IMEI and review',
    body: 'Dial *#06# for the 15-digit IMEI, add your email, then pay by card or crypto.',
    art: 'review',
  },
  {
    title: 'Use a supported SIM',
    body: 'Follow the instructions you receive and insert your new SIM. Refused orders are refunded.',
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
    title: 'Blacklist and missing-device',
    body: 'The one report to run before paying for a used phone.',
    href: '/services/imei-check',
  },
  {
    icon: 'keypad',
    tint: '',
    title: 'Apple Free Check',
    body: 'Get Apple Basic Info with 3 free checks per verified account each day.',
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

export function StorefrontHome({locale}:{locale:GeoLocale}) {
  const t=(key:string)=>homeText(locale,key)
  const ix=locales.indexOf(locale)
  const url=(path:string)=>locale==='en'?path:path==='/articles'?homePaths[ix]+'/articles':path==='/services/unlock'?paths[1][ix]:path==='/services/imei-check'?paths[0][ix]:path
  const faq=homeFaq(locale,FAQ)

  const unlockProducts = listStorefrontProviderProducts('unlock')
  // Keep the homepage picker focused on general diagnostics. The full checks page retains its own catalog.
  const checkProducts = listStorefrontProviderProducts('imei_check').filter(product =>
    !/\b(?:lost|owner id|bypass|mdm)\b/i.test([product.name, product.group, product.summary].join(' ')))
  const ordering = unlockOrderingEnabled() || unlockProducts.some((product) => product.status === 'available')
  const status = !ordering && serviceStatus()
  const unlockCarriers = CARRIERS.filter(c => !(c.country === 'United States' && ['T-Mobile', 'Verizon'].includes(c.name)))
  const networks = new Set(unlockCarriers.map((carrier) => carrier.name)).size
  const countries = [...new Set(unlockCarriers.map((carrier) => carrier.country))]

  const unlockWidget: PriceCheckProduct[] = unlockProducts.map((product) => ({
    code: product.productCode, domain: product.domain,
    name: product.name,
    category: product.group,
    summary: product.summary, hasExample: product.hasExample,
    available: product.status === 'available',
    inputType: product.inputType, priceCents: product.priceCents, priceAvailable: product.priceAvailable,
    etaLabel: product.etaLabel,
  }))
  const checkWidget: PriceCheckProduct[] = checkProducts.map((product) => ({
    code: product.productCode, domain: product.domain,
    name: product.name,
    category: product.group,
    summary: product.summary, hasExample: product.hasExample,
    available: product.status === 'available',
    inputType: product.inputType, priceCents: product.priceCents, priceAvailable: product.priceAvailable,
    etaLabel: product.etaLabel,
  }))

  /* Two report chips from the catalog and the unlock itself: the three
     things a visitor arrives for, one tap from the headline. */
  const picks = quickPicks(checkProducts, 2)

  const heroTiles: Array<{ icon: IconName; title: string; caption: string }> = [
    { icon: 'bolt', title: 'Remote', caption: 'No shop visit' },
    { icon: 'shieldCheck', title: 'Pay per order', caption: 'Card or crypto' },
    { icon: 'lock', title: 'Carrier-approved', caption: 'Permanent unlock' },
    { icon: 'globe', title:t('{n} networks').replace('{n}',String(networks)), caption:t('In {n} countries').replace('{n}',String(countries.length)) },
  ]

  return (
    <>
      <StructuredData faq={faq} />

      {/* 01 · Hero */}
      <section className="hero home-hero" id="check">
        <div className="shell">
          <div className="hero-copy">
            {status ? (
              <p className="alert" role="status">
                <Icon name="info" strokeWidth={1.9} />
                <span>
                  <b>{t("Unlock ordering is paused.")}</b>{t("You can browse service prices and follow existing orders.")}</span>
              </p>
            ) : null}

            <span className="hero-chip">
              <Icon name="shieldCheck" strokeWidth={2} />{t("iUnlockmobile since 2016")}</span>

            <h1 className="t-hero">
              {ordering ? t('Unlock your phone.') : t('Know your phone.')}
              <br />
              <span className="accent">{t("See your options.")}</span>
            </h1>

            <p className="t-lead">
              {ordering
                ? t('See the price and delivery time for your network before you pay.')
                : t('Compare device reports and unlock services, then pay by card or crypto.')}
            </p>


          </div>

          <div className="hero-panel">
            <HeroPriceCheck unlock={unlockWidget.map(p=>localProduct({...p,summary:p.summary??'',etaLabel:formatServiceMeta(p.etaLabel,locale),category:formatServiceMeta(p.category,locale)},locale))} homeUnlockMenu check={checkWidget.map(p=>localProduct({...p,summary:p.summary??'',etaLabel:formatServiceMeta(p.etaLabel,locale),category:formatServiceMeta(p.category,locale)},locale))} ordering={ordering} />
          </div>

          <div className="hero-extras">
            <div className="quick-picks">
              <div className="quick-picks-label">
                <span>{t("Quick picks")}</span>
                <Link href="/services">{t("All services →")}</Link>
              </div>
              <div className="quick-pick-row">
                <Link className="quick-pick" href={url("/services/unlock")}>
                  <span className="icon-tile icon-tile--sm" aria-hidden="true">
                    <Icon name="lock" />
                  </span>
                  <span>{t("Unlock my phone")}<small>{t('{n} networks').replace('{n}',String(networks))}</small>
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
                      {t(pick.short)}
                      <small>{t(pick.kicker)}</small>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            <div className="hero-tiles">
              {heroTiles.map((tile) => (
                <div className="hero-tile" key={t(tile.title)}>
                  <span className="trust-bar-icon" aria-hidden="true">
                    <Icon name={tile.icon} strokeWidth={1.9} />
                  </span>
                  <b>{t(tile.title)}</b>
                  <span>{t(tile.caption)}</span>
                </div>
              ))}
            </div>

          </div>
        </div>
      </section>

      {/* 02 · Networks */}
      <section className="section section--tint home-section logo-section" id="networks">
        <div className="shell">
          <div className="section-head section-head--center">
            <span className="kicker">
              <Icon name="globe" strokeWidth={2} />{t("Global carriers")}</span>
            <h2 className="t-section">{t("Carriers")} {' '}<span className="accent">{t("We Unlock")}</span>
            </h2>
            <p className="t-lead">
              {t('{n} networks in {c} countries. See the price and turnaround before you order.').replace('{n}',String(networks)).replace('{c}',String(countries.length))}
            </p>
          </div>

          <ul className="logo-grid" aria-label={t("Networks")}>
            {unlockCarriers.map((carrier) => (
              <li key={carrier.id}>
                <Link className="logo-card" href={url("/services/unlock")}>
                  <BrandLogo name={carrier.name} />
                  <h3>{carrier.name}</h3>
                </Link>
              </li>
            ))}
          </ul>

          <div className="tile-foot">
            <p className="t-small">{t("Not listed? The full catalog has more networks.")}</p>
            <Link className="button button--quiet" href={url("/services/unlock")}>
              <Icon name="search" strokeWidth={1.9} />{t("Find your network")}</Link>
          </div>

          <div className="eligibility">
            <div className="section-head">
              <span className="kicker">
                <Icon name="check" strokeWidth={2} />{t("Before you order")}</span>
              <h2 className="t-card t-card--lg">{t("Is your phone eligible?")}</h2>
              <p className="t-small">{t("Thirty seconds of checking saves a refused order. Three things decide it.")}</p>
            </div>
            <div className="eligibility-grid">
              {ELIGIBILITY.map((item) => (
                <div className="eligibility-item" key={t(item.title)}>
                  <span className="icon-tile icon-tile--sm" aria-hidden="true">
                    <Icon name={item.icon} />
                  </span>
                  <b>{t(item.title)}</b>
                  <p>{t(item.body)}</p>
                </div>
              ))}
            </div>
            <p className="eligibility-note">
              <Icon name="info" strokeWidth={1.9} />
              <span>{t("Not sure? If the network refuses the device, your payment or credit comes back.")}</span>
            </p>
          </div>
        </div>
      </section>

      {/* 03 · How it works */}
      <section className="section home-section" id="how">
        <div className="shell">
          <div className="section-head section-head--center">
            <span className="kicker">
              <Icon name="pulse" strokeWidth={2} />{t("How it works")}</span>
            <h2 className="t-section">{t("Three steps.")} {' '}<span className="accent">{t("Nothing to install.")}</span>
            </h2>
            <p className="t-lead">{t("The phone stays in your hand the whole time.")}</p>
          </div>

          <div className="grid-3 home-card-grid">
            {STEPS.map((step, index) => (
              <article className="card card--step" key={t(step.title)}>
                <span className="step-numeral" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="step-art" aria-hidden="true">
                  <StepArt kind={step.art} />
                </div>
                <h3 className="t-card">{t(step.title)}</h3>
                <p className="t-small" style={{ marginTop: 9 }}>
                  {t(step.body)}
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
              <Icon name="question" strokeWidth={2} />{t("Common questions")}</span>
            <h2 className="t-section">{t("Straight answers before you pay.")}</h2>
            <p className="t-lead">{t("Including the one most unlock sites leave out — when it will not work.")}</p>
          </div>

          <div>
            <div className="faq-list">
              {faq.map((item, index) => (
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
              <Link className="link-arrow" href="/support">{t("Still have a question? Visit the help centre")}<Icon name="arrowRight" strokeWidth={2.2} />
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
              <Icon name="device" strokeWidth={2} />{t("Supported devices")}</span>
            <h2 className="t-section">{t("Top Brands")} {' '}<span className="accent">{t("We Support")}</span>
            </h2>
            <p className="t-lead">
              {t('Explore services for {n} leading phone brands. Review eligibility and compatible radio bands before ordering.').replace('{n}',String(BRANDS.length))}
            </p>
          </div>

          <ul className="logo-grid" aria-label={t("Brands")}>
            {BRANDS.map((brand) => (
              <li key={brand.id}>
                <Link className="logo-card" href={url("/services/unlock")}>
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
              <Icon name="grid" strokeWidth={2} />{t("Everything on offer")}</span>
            <h2 className="t-section">{t("One place for the lock")} {' '}<span className="accent">{t("and the facts.")}</span>
            </h2>
          </div>

          <div className="hub-grid">
            {HUB.map((item) => (
              <Link className="hub-card" href={url(item.href)} key={t(item.title)}>
                <span className={`icon-tile${item.tint}`} aria-hidden="true">
                  <Icon name={item.icon} strokeWidth={1.8} />
                </span>
                <h3>
                  {t(item.title)}
                  {item.chip ? <span className="hub-chip">{t(item.chip)}</span> : null}
                </h3>
                <p>{t(item.body)}</p>
                <span className="link-arrow">{t("Learn more")}<Icon name="arrowRight" strokeWidth={2.2} />
                </span>
              </Link>
            ))}
          </div>

          <div className="help-band">
            <div>
              <h3>{t("Not sure which one you need?")}</h3>
              <p>{t("Buying used, switching network or seeing “SIM not supported”? The help centre points you to the right service.")}</p>
            </div>
            <div className="cta-actions">
              <Link className="button button--primary" href="/support">{t("Open the help centre")}<Icon name="arrowRight" strokeWidth={2.2} />
              </Link>
              <Link className="button button--quiet" href="/contact">{t("Contact support")}</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
