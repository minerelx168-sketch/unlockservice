import { ModelHardwareCheck } from '@/components/model-hardware-check'
import type { Metadata } from 'next'
import { headers } from 'next/headers'
import Link from 'next/link'
import us from '@/app/(marketing)/services/unlock/us/us-unlock.module.css'
import { GuideFaq } from '@/components/guide-faq'
import { orderOptions } from '@/components/guide-layout'
import { HeroPriceCheck } from '@/components/hero-price-check'
import { getPublishedProgrammaticRoutes } from '@/lib/data/programmatic-rollout'
import { formatUsd } from '@/lib/money'
import { listStorefrontProviderProducts } from '@/lib/public-provider-catalog'
import { pageMetadata } from '@/lib/seo'
import { publicOrigin } from '@/lib/site'
import styles from '@/styles/service-spoke.module.css'

type PublishedRoute = ReturnType<typeof getPublishedProgrammaticRoutes>[number]
export function toolMetadata(route: PublishedRoute): Metadata {
  const { model, carrier, path } = route
  const action = carrier?.kind === 'unlock' ? 'Unlock' : 'Lock Check'
  const title = [model.displayName, carrier?.name, action, '| iUnlockMobile'].filter(Boolean).join(' ')
  const description = carrier
    ? 'Compare regional SIM and radio hardware for ' + model.displayName + ' before choosing a ' + carrier.name + ' service. Check device eligibility and review the price before checkout.'
    : 'Identify your ' + model.displayName + ' by A-number, compare its SIM hardware by region and check its carrier lock before ordering a blacklist report.'
  return { ...pageMetadata(path, title, description), title: { absolute: title }, robots: { index: true, follow: true, googleBot: { 'max-snippet': -1 } } }
}
export async function ProgrammaticTool({ route }: { route: PublishedRoute }) {
  const { model, path, hub, carrier } = route
  const unlock = carrier?.kind === 'unlock'
  const domain = unlock ? 'unlock' : 'imei_check'
  const { displayName: name, modelNumbers: numbers, simArchitecture: sim, fiveGBandsSummary: bands } = model
  const catalog = listStorefrontProviderProducts(domain)
  const codes = carrier ? [carrier.primary] : ['APPLE_CARRIER_LITE', 'BLACKLIST_FULL']
  if (carrier?.secondary && (carrier.slug !== 'ee' || model.releaseYear <= 2022)) codes.push(carrier.secondary)
  const products = codes.flatMap(code => catalog.filter(item => item.productCode === code))
  const options = orderOptions(products)
  const primary = options.find(item => item.code === codes[0])
  const rows = [
    ['United States', numbers.us, sim.us, bands.us],
    ['Canada', numbers.canada, sim.canada, bands.international],
    ['Japan', numbers.japan, sim.japan, bands.international],
    ['UK / EU', numbers.globalUkEu, sim.globalUkEu, bands.international],
    ['Mainland China', numbers.chinaMainland, sim.chinaMainland, bands.international],
    ['Hong Kong', numbers.hongKong, sim.hongKong, bands.international],
  ]
  const heading = [name, carrier?.name, unlock ? 'unlock eligibility' : 'carrier lock check'].filter(Boolean).join(' ')
  const faq = [
    ['How do I identify my ' + name + ' variant?', 'In Settings → General → About, tap Model Number to reveal the A-number. Compare it with the table. The US variant is ' + numbers.us + ' and the UK variant is ' + numbers.globalUkEu + '.'],
    ['Can I test a different SIM in my US ' + name + '?', sim.us + '. Under Settings → General → About, read Carrier Lock before provisioning a travel plan. “No SIM restrictions” means the device is unlocked.'],
    ['Will releasing a carrier lock add 5G bands to ' + numbers.us + '?', 'No. Its radio supports ' + bands.us + '. ' + bands.roaming],
    ['Which report should I order for a used ' + name + '?', 'Use Apple Carrier Lite to look up the reported carrier policy. Choose Blacklist Full to check the submitted IMEI against loss or theft records. Neither report removes a network lock or verifies device ownership.'],
  ]
  if (carrier) faq[3] = ['Which ' + carrier.name + ' rule matters for this ' + name + '?', carrier.rule]
  const schema = {
    '@context': 'https://schema.org', '@graph': [
      { '@type': 'FAQPage', mainEntity: faq.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: answer } })) },
      { '@type': 'Service', name: heading, url: publicOrigin() + path,
        offers: options.map(product => ({ '@type': 'Offer', name: product.name, price: (product.priceCents / 100).toFixed(2), priceCurrency: 'USD' })) },
    ],
  }
  return <section className={'section section--tint service-entry-section unlock-landing ' + (unlock ? us.page : styles.page)}><div className="shell">
    <nav className="service-breadcrumb" aria-label="Breadcrumb"><Link href={hub}>{unlock ? carrier?.name + ' country hub' : 'IMEI checks'}</Link><span>/</span><span>{name}</span></nav>
    <header><span className="hero-chip">{unlock ? 'Network unlock' : 'Device diagnostic'}</span><h1 className="service-entry-title">{heading}</h1>
      <p className="t-lead">{carrier ? <>{carrier.rule} Compare {name} models {numbers.us} and {numbers.globalUkEu} before choosing a service. The US model uses {sim.us.toLowerCase()}. A network lock and regional radio support must be checked separately.</> : <>Check the carrier policy on your {name} before changing networks. The US variant ({numbers.us}) uses {sim.us.toLowerCase()}. In Canada, look for {numbers.canada} with {sim.canada}. Only the locking carrier can authorize release. Use the report below if the original network is unknown, or check Carrier Lock in Settings first.</>}</p></header>
    {primary ? <div className="hero-panel"><HeroPriceCheck ordering fixedDomain={domain} check={unlock ? [] : options} unlock={unlock ? options : []} initialProductCode={primary.code}/></div> : <p role="status">This service is temporarily unavailable.</p>}
    {carrier && <div className="requirements-card"><h2>Eligibility for {carrier.name}</h2><p>{carrier.rule}</p><a href={carrier.source}>Read the official policy</a></div>}
    <ModelHardwareCheck model={model}/>
    <div className={styles.facts}><section className={styles.card}><h2>Compare your regional hardware</h2>
      <div className={styles.tableWrap} tabIndex={0}><table><caption>{name} regional variants · introduced {model.releaseYear}</caption>
      <thead><tr>{['Market', 'A-number', 'SIM hardware', 'Radio', 'Report prices (USD)'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
      <tbody>{rows.map(([market, number, hardware, radio]) => <tr key={market}><th scope="row">{market}</th><td>{number}</td><td>{hardware}</td><td>{radio}</td><td>{options.map(product => product.name + ' ' + formatUsd(product.priceCents)).join(' / ') || 'Unavailable'}</td></tr>)}</tbody></table></div>
      <p>{model.tacNote}</p><a href="https://support.apple.com/en-us/108044">Identify your model with Apple</a></section></div>
    <section><h2>Before ordering a {name} report</h2><GuideFaq rows={faq}/></section>
    <script type="application/ld+json" nonce={(await headers()).get('x-nonce') ?? undefined} dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, '\\u003c') }}/>
  </div></section>
}
