import {GuideFaq} from './guide-faq'
import Link from 'next/link'
import { ArticleCarrierWidget } from './article-carrier-widget'
import { CanadaUnlockServices } from './canada-unlock-services'
import { guides,type GuideKey } from '@/lib/carrier-guides'
import { listStorefrontProviderProducts } from '@/lib/public-provider-catalog'
import { getServiceOutputExample } from '@/lib/service-output-examples'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { formatUsd } from '@/lib/money'
import { publicOrigin } from '@/lib/site'
import { GuideOrder } from './guide-order'
import { orderOptions } from './guide-layout'
import s from '@/styles/service-spoke.module.css'
import { PROVIDER_PRODUCTS } from '@/lib/provider-products'
import { itemIdFor } from '@/lib/acp-feed'
import { merchantReturnPolicy } from '@/lib/acp-feed-live'

const methods=[
 ['iOS Settings','Free','Carrier Lock field; requires the phone','Locking network, theft reports, payoff'],
 ['Swappa IMEI check (US)','Free lookup','Device and blocklist screening by IMEI','Original network or installment balance'],
 ['DeviceCheck Canada','Free lookup','Canadian lost/stolen reports by IMEI','Carrier policy, financing or Apple Account lock'],
 ['Original carrier','Free unlock request for eligible devices','Eligibility on its own network; may request account details','Who sold an unidentified handset'],
 ['Apple Carrier Lite / Pro','See prices below','Reported network policy and SIM lock; Pro can also report Find My','Proof of ownership or a complete blacklist search'],
]
export function CarrierGuide({id,children,product}:{id:GuideKey;product?:string;children?:React.ReactNode}){
 const g=guides[id],canada=id==='ca'||id==='sim',origin=publicOrigin(),url=origin+g.path
 const codes=canada?['UNLOCK_39','UNLOCK_36','UNLOCK_289','UNLOCK_329','UNLOCK_410','UNLOCK_711']:['UNLOCK_346','UNLOCK_649']
 const products=[...listStorefrontProviderProducts('imei_check').filter(p=>['APPLE_CARRIER_LITE','APPLE_CARRIER_PRO'].includes(p.productCode)),...listStorefrontProviderProducts('unlock').filter(p=>codes.includes(p.productCode) && (!canada || p.group==='Canada Networks'))]
 const available=products.filter(p=>p.status==='available'&&p.priceAvailable)
 const unlocks=available.filter(p=>p.domain==='unlock')
 const rules:Record<string,string>={
 UNLOCK_346:'AT&T: check purchase age, payoff and account standing through the free portal. Prepaid has a separate service period.',
 UNLOCK_649:'C Spire: the account holder or an authorized user should confirm the requirements and request release.',
 UNLOCK_36:'Rogers / Fido: request free release from the supplying carrier. Check the policy before ordering for a used phone.',
 UNLOCK_39:'TELUS / Koodo: ask the supplying carrier first. Recheck the IMEI if the handset was replaced.',
 UNLOCK_289:'Videotron: ask the carrier first. A Canadian service cannot release a US carrier’s lock.'}
 const faq=g.faq.map(([name,text])=>({'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}}))
 const schema={'@context':'https://schema.org','@graph':[{'@type':'FAQPage','@id':url+'#faq',mainEntity:faq},...available.map(p=>{const sid=PROVIDER_PRODUCTS.find(x=>x.productCode===p.productCode)?.serviceId;return {'@type':'Product','@id':url+'#'+p.productCode,name:p.name,...(sid?{sku:itemIdFor(sid)}:{}),brand:{'@type':'Brand',name:'iUnlockMobile'},offers:{'@type':'Offer',price:(p.priceCents/100).toFixed(2),priceCurrency:'USD',url:url+'#'+p.productCode,availability:'https://schema.org/InStock',hasMerchantReturnPolicy:merchantReturnPolicy(origin)}}})]}
 return <article className={"section "+s.page}><div className="shell"><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(schema).replace(/</g,'\\u003c')}}/>
 <nav className="service-breadcrumb"><Link href="/services">Services</Link><span>/</span>{canada?'Canada':'United States'}</nav><header className="service-hero-copy"><span className="hero-chip">{canada?'Canada':'United States'} · iPhone carrier guide</span><h1 className="service-entry-title">{g.title}</h1><p className="t-lead">{g.intro}</p></header>
 {id==='ca'&&<div className="requirements-card"><p>Choose the original Canadian network. Confirm ownership, payment status and carrier eligibility before ordering.</p></div>}{id==='ca'?<CanadaUnlockServices services={unlocks} product={product}/>:id==='sim'||id==='used'?<ArticleCarrierWidget/>:<div className={s.facts}><div className={s.card}><GuideOrder anchor="order" domain="imei_check" initial="APPLE_CARRIER_LITE" options={orderOptions(available.filter(p=>p.domain==='imei_check'))}/></div></div>}
 <section><h2>Which check answers your question?</h2><div className={s.tableWrap} role="region" aria-label="Compare verification methods" tabIndex={0}><table><caption>What you can learn before paying</caption><thead><tr>{['Method','Cost','What it verifies','What it cannot establish'].map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{methods.map(([m,c,a,b])=><tr key={m}><th scope="row">{m}</th><td>{c}</td><td>{a}</td><td>{b}</td></tr>)}</tbody></table></div>
 <div className={s.tableWrap} role="region" aria-label="Compare service prices" tabIndex={0}><table><caption>Independent services · current USD quotes</caption><thead><tr>{['Service','Base','Direct card','Estimated delivery','Free route and limits','Ordering'].map(c=><th scope="col" key={c}>{c}</th>)}</tr></thead><tbody>{products.map(p=><tr key={p.productCode} id={p.productCode}><th scope="row">{p.name}</th><td>{p.priceAvailable?formatUsd(p.priceCents):'Not quoted'}</td><td>{p.priceAvailable?formatUsd(guestCardQuote(p.priceCents).totalCents):'Not quoted'}</td><td>{p.etaLabel}</td><td>{rules[p.productCode]??(p.domain==='unlock'?'Ask the original carrier about eligibility before ordering.':'Read Carrier Lock in iOS for free. A report does not unlock the device.')}</td><td>{available.includes(p)?<Link href={p.domain==='imei_check'?'/services/imei-check?product='+p.productCode:!canada?'/services/unlock/us?product='+p.productCode+'#us-order':'/services/unlock/canada?product='+p.productCode+'#ca-order'}>Review service</Link>:'Unavailable'}</td></tr>)}</tbody></table></div></section>
 <section><h2>How to read a carrier report</h2><p>Read the policy and SIM-lock fields together. Find My concerns activation by an Apple Account; a lost or stolen report concerns access to participating mobile networks. Neither confirms payoff.</p>{products.filter(p=>p.domain==='imei_check').map(p=>{const v=getServiceOutputExample(p.productCode)?.variants[0];return v?<div key={p.productCode}><h3>{p.name} · sample output</h3><pre>{v.output.replace(/\b\d{14,16}\b/g,'[identifier masked]')}</pre></div>:null})}</section>
 <section><h2>{canada?'Canadian rules and US imports':'Start with the carrier’s free route'}</h2>{canada?<><p>The Wireless Code requires unlocked devices. On August 14, 2026, the CRTC issued a conditional temporary stay while consulting on the rule. A participating provider may lock a new device for up to two business days after purchase and must offer immediate unlocking on request. This does not release a US carrier’s lock on an imported phone.</p><p><a href="https://crtc.gc.ca/eng/archive/2026/2026-210.htm">CRTC notice and conditions</a> · <a href="https://crtc.gc.ca/eng/archive/2026/lt261030a.htm">October 30 review</a> · <a href="https://www.devicecheck.ca/">DeviceCheck Canada</a></p></>:<><p>AT&amp;T checks payoff, purchase age, account and device status. C Spire requires an eligible device and an authorized requester. Ask the locking carrier first; paying for a report does not change either carrier’s decision.</p><p><a href="https://www.att.com/deviceunlock/">AT&amp;T free unlock portal</a> · <a href="https://www.cspire.com/web/legal/terms-of-use#DLP">C Spire device policy</a> · <a href="https://swappa.com/imei">Swappa IMEI screening</a></p></>}<a href="https://support.apple.com/en-us/109316">Apple: check Carrier Lock and finish activation</a></section>
 <section><h2>Four checks before paying a seller</h2><ol><li>Ask for the final price. A paid lookup and an unlock are distinct purchases; a surprise compulsory second charge is a warning.</li><li>Have the owner remove Activation Lock. Check the lost/stolen registry separately.</li><li>Ask the carrier to confirm release. A SIM adapter or jailbreak is not a carrier release.</li><li>Read the refusal and refund terms. For an undeliverable direct card order, we request a refund to the original method; account credit and crypto follow different procedures. <Link href="/terms#refunds">Read refund conditions</Link>.</li></ol></section>
 <section id="faq"><h2>Questions about {canada?'Canadian phones and imports':'US carrier checks'}</h2><GuideFaq rows={g.faq}/></section>
 {children}<nav aria-label="Related carrier guides" className={s.hubLinks}>{Object.values(guides).filter(x=>x.path!==g.path).map(x=><Link key={x.path} href={x.path}>{x.title}</Link>)}</nav></div></article>
}
