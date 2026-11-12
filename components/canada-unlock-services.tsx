import Link from 'next/link'
import { HeroPriceCheck, type PriceCheckProduct } from './hero-price-check'
import type { PublicProviderProduct } from '@/lib/public-provider-catalog'
import { formatUsd } from '@/lib/money'
import { guestCardQuote } from '@/lib/guest-card-quote'
import styles from '@/app/(marketing)/services/unlock/us/us-unlock.module.css'

export function CanadaUnlockServices({services,product}:{services:PublicProviderProduct[];product?:string}) {
  const options:PriceCheckProduct[] = services.map(p=>({code:p.productCode,domain:p.domain,name:p.name,
    category:p.group,summary:p.summary,hasExample:p.hasExample,available:true,inputType:p.inputType,
    priceCents:p.priceCents,priceAvailable:true,etaLabel:p.etaLabel}))
  const selected=options.find(p=>p.code===product)?.code
  return <section aria-labelledby="ca-services-title">
    <div className={styles.sectionHeading}><span className="kicker">Canadian networks</span>
      <h2 id="ca-services-title">Choose your carrier service</h2>
      <p>Select the network that locked your phone. For an iPhone, choose the iPhone service rather than a generic unlock code.</p></div>
    {services.length ? <><ul className={styles.serviceGrid} aria-label="Canadian unlock services">{services.map((p,i)=>
      <li key={p.productCode} className={`card card--step ${styles.serviceCard}`}>
        <span className="step-numeral" aria-hidden="true">{String(i+1).padStart(2,'0')}</span>
        <h3 className="t-card">{p.name}</h3>
        <div className={styles.price}><span>Card total · USD</span><strong>{formatUsd(guestCardQuote(p.priceCents).totalCents)}</strong></div>
        <div className={styles.delivery}><span>Estimated delivery</span><strong>{p.etaLabel}</strong></div>
        <p className={styles.priceNote}>Base service price: {formatUsd(p.priceCents)} USD</p>
        <Link className={`button button--primary ${styles.chooseButton}`} href={'/services/unlock/canada?product='+p.productCode+'#ca-order'} aria-label={'Choose '+p.name}>Choose service →</Link>
      </li>)}</ul>
      <div className={`hero-panel ${styles.orderPanel}`} id="ca-order"><HeroPriceCheck key={selected??'ca'} unlock={options} check={[]} ordering fixedDomain="unlock" initialProductCode={selected}/></div></>
      : <p>No Canadian service is currently available to order. <Link href="/support">Contact support</Link>.</p>}
  </section>
}
