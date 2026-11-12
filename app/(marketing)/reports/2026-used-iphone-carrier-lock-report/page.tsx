import Link from 'next/link'
import { ArticleCarrierWidget } from '@/components/article-carrier-widget'
import { serializeJsonLd } from '@/lib/json-ld'
import { pageMetadata } from '@/lib/seo'
import { publicOrigin } from '@/lib/site'
import {GuideFaq} from '@/components/guide-faq'

export const dynamic = 'force-dynamic'
const path = '/reports/2026-used-iphone-carrier-lock-report'
const title = '2026 used iPhone carrier lock report: United States and Canada'
const description = 'Compare SIM-lock rules for eight carrier groups. Check the original carrier, plan type and activation date before buying a used iPhone.'
const date = '2026-11-12'
export const metadata = pageMetadata(path, title, description)
const fcc = 'https://www.fcc.gov/document/fcc-proposes-mobile-phone-unlocking-requirement-0'
const crtc = 'https://crtc.gc.ca/eng/archive/2026/2026-210.htm'
const rows = [
 ['AT&T','US','Postpaid: more than 60 days since purchase and no installment balance. AT&T Prepaid has a separate six-month paid-service requirement.','The phone cannot be active on another AT&T account or flagged for theft, loss or fraud. Current accounts must be up to date. A noncustomer may request an eligible unlock.','https://www.att.com/support/article/wireless/KM1008728/'],
 ['Verizon','US','For devices under the policy beginning January 27, 2026, standard postpaid release follows full payment. Prepaid normally requires 365 days of paid, active service. Earlier activations had a different 60-day rule.','Check the activation date with the seller. Payment method can delay release, and a fraud or lost/stolen flag prevents it.','https://www.verizon.com/support/device-unlocking-policy/','https://www.verizon.com/support/device-locking-faqs/'],
 ['T-Mobile','US','Postpaid: at least 40 days on the requesting line and any device financing paid off. Prepaid normally requires 365 days since activation; an earlier refill-based exception has additional conditions.','The phone must have been sold by T-Mobile, meet account-standing requirements and not be blocked, lost or stolen. A closed postpaid account must have a zero balance.','https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy'],
 ['C Spire','US','Postpaid: 30 days activated, including 15 on the requesting line. No-contract: nine paid service cycles and 15 days on the requesting number.','The account holder or authorized user must request release of a C Spire device. Postpaid installments and promotional obligations must be satisfied. Lost, stolen or fraud-flagged devices are excluded.','https://www.cspire.com/web/legal/terms-of-use#DLP'],
 ['Rogers / Fido','Canada','Both brands say new phones bought directly from them come unlocked. A locked older phone must go back to the brand that sold it.','For consumer requests, an active account in good standing or an eligible account cancelled within 12 months can qualify. The IMEI must not be blacklisted; former accounts must be settled and not closed for fraud.','https://www.rogers.com/support/mobility/device-unlocking-faqs','https://www.fido.ca/support/mobility/device-unlocking-faqs'],
 ['TELUS / Koodo','Canada','Both describe a two-day security lock for new phones. Koodo dates its policy to October 2026 and counts from activation.','Ask the supplying brand for earlier release if eligible. TELUS Assist and Koodo Assist handle requests; an ordinary carrier unlock does not clear a stolen-device flag.','https://www.telus.com/en/support/article/unlock-mobile-device','https://www.koodomobile.com/en/help/article-categories/activating-0'],
 ['Bell','Canada','Bell describes a two-day lock after activation, followed by automatic release at no charge.','Contact Bell for earlier release of an otherwise eligible Bell-locked device. Bell checks for lost or stolen status and can reject fraudulent requests.','https://support.bell.ca/Mobility/smartphones_and_mobile_internet/unlock_your_Bell_device'],
 ['Vidéotron','Canada','Vidéotron says devices it sold after December 1, 2017 are already unlocked. Its unlocking guide is for older devices.','For a locked phone sold by Vidéotron, ask the carrier for its free unlock. If another carrier sold the phone, contact that carrier instead.','https://www.videotron.com/en/support/mobile/devices/unlock-mobile']
]
const faq = [
 ['Must every US carrier unlock my iPhone after 60 days?', 'No. FCC 24-77 proposed a common rule. Use the original carrier’s policy for your plan and activation date; an AT&T purchase-age requirement and a Verizon prepaid service period are different tests.'],
 ['Can I ask a Canadian provider to unlock a new phone before two business days?', 'Yes. A provider using the CRTC temporary stay must honour a customer’s unlock request and automatically unlock within two business days of purchase. The stay permits a short lock; it does not require every provider to impose one.'],
 ['Does an IMEI carrier report unlock a phone or prove it is paid off?', 'No. The report identifies the reported carrier policy and SIM-lock status. Ask the original carrier about financing and eligibility, and check lost or stolen status separately before paying the seller.']
]
export default function Page() {
 const url = publicOrigin()+path
 const graph = [
  {'@type':'Article','@id':url+'#article',headline:title,description,url,datePublished:date,dateModified:date,author:{'@type':'Organization',name:'iUnlockMobile'},hasPart:{'@id':url+'#comparison'},citation:[fcc,crtc,...rows.flatMap(r=>r.slice(4))]},
  {'@type':'Dataset','@id':url+'#comparison',url:url+'#comparison',name:'Carrier policy comparison',description:'A qualitative comparison of published consumer SIM-lock policies, not a survey of phones or unlock success rates.',dateModified:date,variableMeasured:rows.map(([name,country,rule,action])=>({'@type':'PropertyValue',name:name+' ('+country+')',value:rule+' '+action}))},
  {'@type':'FAQPage','@id':url+'#faq',mainEntity:faq.map(([name,text])=>({'@type':'Question',name,acceptedAnswer:{'@type':'Answer',text}}))}
 ]
 return <article><section className="section section--tint"><div className="shell"><nav className="service-breadcrumb"><Link href="/articles">Guides</Link><span>/</span>Buyer’s report</nav><div className="article-head">
 <script type="application/ld+json" dangerouslySetInnerHTML={{__html:serializeJsonLd({'@context':'https://schema.org','@graph':graph})}}/>
 <span className="kicker">Buyer’s report</span><h1 className="t-section">{title}</h1><p className="t-lead">{description}</p><p className="t-micro article-meta">iUnlockMobile · Reviewed November 12, 2026</p>
 <p>With the phone in hand, open Settings → General → About. “No SIM restrictions” means you do not need a carrier unlock. If the phone is locked and the seller cannot identify the network, the optional check below can help.</p>
 <ArticleCarrierWidget/></div></div></section><section className="section"><div className="shell article-layout"><div className="article-content">
 <section id="policy"><h2>What the regulators actually said</h2><p><a href={fcc}>FCC 24-77</a> proposed unlocking after 60 days from activation, with a fraud exception. That proposal is not a nationwide unlock deadline. Verizon’s own rule changed in January 2026; check the activation date before relying on older advice.</p><p><a href={crtc}>CRTC Telecom Notice of Consultation 2026-210</a> grants a conditional temporary stay. Providers using it must automatically unlock within two business days of purchase, unlock on customer request and explain the restriction. Some carrier help pages describe their process from activation; the regulator’s condition counts from purchase.</p></section>
 <section id="comparison"><h2>Carrier policy comparison</h2><p>A qualitative comparison of published consumer SIM-lock policies, not a survey of phones or unlock success rates.</p><div className="table-wrap" role="region" aria-label="Carrier policy comparison" tabIndex={0}><table><caption>Used iPhone eligibility by original carrier · November 2026</caption><thead><tr>{['Original carrier','Market','Lock and release rule','What a buyer should verify','Official policy'].map(h=><th key={h} scope="col">{h}</th>)}</tr></thead><tbody>{rows.map(([name,country,rule,action,...sources])=><tr key={name}><th scope="row">{name}</th><td>{country}</td><td>{rule}</td><td>{action}</td><td>{sources.map(src=><p key={src}><a href={src}>{new URL(src).hostname.replace(/^www\./,'')}</a></p>)}</td></tr>)}</tbody></table></div></section>
 <div className="article-faq" id="faq"><h2>Questions before buying</h2><GuideFaq rows={faq}/></div></div><aside className="article-aside"><details className="article-contents" open><summary>On this page</summary><nav aria-label="On this page"><ul>{[['policy','Regulatory guidance'],['comparison','Carrier comparison'],['faq','Questions before buying']].map(([id,label])=><li key={id}><a href={'#'+id}>{label}</a></li>)}</ul></nav></details></aside></div></section></article>
}
