import { headers } from 'next/headers'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { HUBS, HUB_SCHEMA_IDS, hubPath, HUB_SLUGS, HUB_PREFIXES, isHubSlug, hubLanguages, type HubSlug } from '@/lib/check-hubs'
import { getPaidReportProduct } from '@/lib/paid-reports'
import { formatUsd } from '@/lib/money'
import { p2 } from '@/lib/i18n/phase2'
import { locales, type GeoLocale } from '@/lib/geo-locales'
import { croAssignment } from '@/lib/cro/server'
import { productSchemaNodes } from '@/lib/acp-feed-live'
import { serializeJsonLd } from '@/lib/json-ld'
import { publicOrigin } from '@/lib/site'
import { storefrontAvailability } from '@/lib/storefront-availability'
import { pageMetadata } from '@/lib/seo'
import { HubOrderForm, type HubOption } from './cro/hub-order-form'
import { UnlockDateCalculator } from './cro/unlock-date-calculator'
import { CroImpression } from './cro/cro-impression'
import { AiPriceBanner } from './cro/ai-price-banner'
import s from '@/styles/service-spoke.module.css'

const prefixFor = (locale: GeoLocale) => HUB_PREFIXES[locales.indexOf(locale)]

export function checkHubMetadata(slug: string, locale: GeoLocale) {
  if (!isHubSlug(slug)) return {}
  const hub = HUBS[slug]
  const path = hubPath(slug, prefixFor(locale))
  const base = pageMetadata(path, p2(locale, hub.title), p2(locale, hub.summary))
  return { ...base, alternates: { canonical: base.alternates?.canonical, languages: hubLanguages(slug) } }
}

export const checkHubParams = () => HUB_SLUGS.map((hub) => ({ hub }))

function hubOptions(slug: HubSlug, locale: GeoLocale): HubOption[] {
  const report = p2(locale, 'Report')
  const names: Record<string, string> = {
    APPLE_CARRIER_LITE: 'Apple Carrier Lite', APPLE_CARRIER_PRO: 'Apple Carrier Pro',
    VERIZON_USA_PRO: `Verizon USA · ${report}`, TMOBILE_USA: `T-Mobile USA · ${report}`,
  }
  return HUBS[slug].checks.flatMap((code) => {
    const product = getPaidReportProduct(code)
    return product?.providerReady && product.priceCents > 0 ? [{ code, name: names[code] ?? product.name, priceCents: product.priceCents }] : []
  })
}

function priceOf(code: string): string {
  const product = getPaidReportProduct(code)
  return product && product.priceCents > 0 ? formatUsd(product.priceCents) : '—'
}

export async function CheckHub({ slug, locale }: { slug: string; locale: GeoLocale }) {
  if (!isHubSlug(slug)) notFound()
  const hub = HUBS[slug]
  const prefix = prefixFor(locale)
  const url = publicOrigin() + hubPath(slug, prefix)
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const options = hubOptions(slug, locale)
  const teaser = await croAssignment('CRO-02')
  const lite = getPaidReportProduct('APPLE_CARRIER_LITE')
  const vars = { price: priceOf('APPLE_CARRIER_LITE'), att: priceOf('UNLOCK_346'), verizon: priceOf('VERIZON_USA_PRO'), tmobile: priceOf('TMOBILE_USA') }
  const waitlistOpen = hub.waitlist && !storefrontAvailability('unlock').accepting
  const graph = [
    { '@type': 'WebPage', '@id': url + '#page', url, name: p2(locale, hub.title), description: p2(locale, hub.summary), inLanguage: locale === 'fr' ? 'fr-CA' : locale, dateModified: hub.updated, citation: [...hub.sources] },
    ...productSchemaNodes(HUB_SCHEMA_IDS[slug], url),
  ]
  const related: Array<[string, string]> = [
    ...HUB_SLUGS.filter((other) => other !== slug).map((other): [string, string] => [hubPath(other, prefix), p2(locale, HUBS[other].title).split(':')[0]]),
    ['/reports/2026-used-iphone-carrier-lock-report', p2(locale, '2026 carrier lock report')],
    ['/services/unlock/us', p2(locale, 'US unlock services')],
    ['/services/unlock/canada', p2(locale, 'Canada unlock services')],
  ]
  return <article className={'section ' + s.page}>
    <div className="shell">
      <script nonce={nonce} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd({ '@context': 'https://schema.org', '@graph': graph }) }} />
      <header className="service-hero-copy">
        <span className="hero-chip">{p2(locale, 'Carrier check hub')} · 2026</span>
        <h1 className="service-entry-title">{p2(locale, hub.title)}</h1>
        <p className="t-lead"><strong>{p2(locale, 'Short answer')}:</strong> {p2(locale, hub.summary)}</p>
        <p className="t-micro">{p2(locale, 'Official policy')}: {hub.sources.map((src, index) => <span key={src}>{index ? ' · ' : ''}<a href={src} rel="noopener">{new URL(src).hostname.replace(/^www\./, '')}</a></span>)}</p>
      </header>
      <div className={s.facts}>
        <div className={s.card} id="order">
          <h2>{p2(locale, 'Check this phone before you pay')}</h2>
          <p>{p2(locale, 'Enter the 15-digit IMEI. You see the total before paying; the report runs after payment.')}</p>
          {lite ? <AiPriceBanner locale={locale} priceCents={lite.priceCents} /> : null}
          <CroImpression {...teaser} />
          <HubOrderForm locale={locale} options={options} teaser={teaser.variant === 'B'} />
        </div>
        <div className={s.card}>
          <h2>{p2(locale, 'Unlock date calculator')}</h2>
          <UnlockDateCalculator locale={locale} carrier={hub.carrier} />
        </div>
      </div>
      <section>
        <h2>{p2(locale, 'Published 2026 rules')}</h2>
        <div className={s.tableWrap} role="region" aria-label={p2(locale, 'Published 2026 rules')} tabIndex={0}>
          <table><thead><tr><th scope="col">{p2(locale, 'Plan')}</th><th scope="col">{p2(locale, 'Requirement')}</th></tr></thead>
            <tbody>{hub.rows.map(([plan, rule]) => <tr key={plan}><th scope="row">{p2(locale, plan)}</th><td>{p2(locale, rule)}</td></tr>)}</tbody></table>
        </div>
        <p className="t-micro">{p2(locale, 'Rules can change. Confirm with the carrier before relying on a date.')}</p>
      </section>
      <section>
        <h2>{p2(locale, hub.honesty.heading)}</h2>
        <p>{p2(locale, hub.honesty.body, vars)}</p>
        <h3>{p2(locale, 'What iUnlockMobile sells for this carrier')}</h3>
        <ul>{options.map((option) => <li key={option.code}><a href="#order">{option.name}</a> · {formatUsd(option.priceCents)}</li>)}
          {slug === 'cricket-wireless' ? <li><Link href="/services/unlock/us/att">AT&amp;T USA</Link> · {vars.att}</li> : null}</ul>
        {slug === 'cricket-wireless' ? <p>{p2(locale, 'We do not sell Cricket Wireless unlocks. We sell the carrier check above and, when the report shows AT&T USA, the AT&T clean-device unlock.')}</p> : null}
        {waitlistOpen ? <p><Link className="button button--quiet" href="/unlock-waitlist">{p2(locale, 'Get notified if an official route opens')}</Link></p> : null}
      </section>
      <nav aria-label={p2(locale, 'Related')} className={s.hubLinks}>{related.map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</nav>
    </div>
  </article>
}
