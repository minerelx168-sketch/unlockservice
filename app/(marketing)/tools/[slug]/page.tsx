import {GuideFaq} from '@/components/guide-faq'
import {policies} from '@/lib/geo-tools'

import {notFound} from 'next/navigation'
import {FreeGeoTool} from '@/components/free-geo-tool'
import {toolList} from '@/lib/geo-tools'
import {geoOffers} from '@/lib/geo-offers'
import {pageMetadata} from '@/lib/seo'
export const dynamic='force-dynamic'
type Props={params:Promise<{slug:string}>}
export async function generateMetadata({params}:Props){const {slug}=await params,t=toolList.find(x=>x.slug===slug);return t?pageMetadata('/tools/'+slug,t.title,t.intro):{}}
export default async function Page({params}:Props){const {slug}=await params,idx=toolList.findIndex(x=>x.slug===slug);if(idx<0)notFound();const t=toolList[idx];const graph=[{'@type':'WebApplication',name:t.title,description:t.intro,applicationCategory:'UtilitiesApplication',operatingSystem:'Any',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'}},{'@type':'FAQPage',mainEntity:[{'@type':'Question',name:t.q,acceptedAnswer:{'@type':'Answer',text:t.a}}]}]
const refs: string[][][]= [[['M / F','Retail / refurbished distribution'],['N / P','Replacement / personalized distribution'],['LL/A · VC/A · J/A','US · Canada · Japan']],Object.entries(policies).map(([carrier,[,rule]])=>[carrier,rule]),[['Digits 1–8','Type Allocation Code'],['Digits 9–14','Device serial portion'],['Digit 15','Luhn check digit']],[['A2649 / A2632','US iPhone 14 / 14 Plus: eSIM only'],['A2884 / A2888','Mainland China variants: dual physical SIM']]]
return <article><FreeGeoTool idx={idx} products={geoOffers('imei_check',idx===2?['APPLE_CARRIER_LITE','BLACKLIST_FULL']:['APPLE_CARRIER_LITE'])}/><section className="section"><div className="shell"><h2 className="t-section">Reference</h2><div className="table-wrap" tabIndex={0}><table><caption>{t.title}</caption><thead><tr><th scope="col">Reference</th><th scope="col">What it means</th></tr></thead><tbody>{refs[idx].map(([k,v])=><tr key={k}><th scope="row">{k}</th><td>{v}</td></tr>)}</tbody></table></div><a href={t.source}>Source and further reading ↗</a><div className="article-faq"><h2>Common questions</h2><GuideFaq rows={[[t.q,t.a]]}/></div></div></section><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}}/></article>}
