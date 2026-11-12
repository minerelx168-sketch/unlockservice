import {GuideHero} from '@/components/guide-ui'
import Link from "next/link"
import {notFound} from 'next/navigation'
import {FreeGeoTool} from '@/components/free-geo-tool'
import {toolList} from '@/lib/geo-tools'
import {geoOffers} from '@/lib/geo-offers'
import {pageMetadata} from '@/lib/seo'
export const dynamic='force-dynamic'
type Props={params:Promise<{slug:string}>}
export async function generateMetadata({params}:Props){const {slug}=await params,t=toolList.find(x=>x.slug===slug);return t?pageMetadata('/tools/'+slug,t.title,t.intro):{}}
export default async function Page({params}:Props){const {slug}=await params,idx=toolList.findIndex(x=>x.slug===slug);if(idx<0)notFound();const t=toolList[idx];const graph=[{'@type':'WebApplication',name:t.title,description:t.intro,applicationCategory:'UtilitiesApplication',operatingSystem:'Any',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'}},{'@type':'FAQPage',mainEntity:[{'@type':'Question',name:t.q,acceptedAnswer:{'@type':'Answer',text:t.a}}]}]
return <article className="guide-page shell"><Link href="/tools">← All free tools</Link><GuideHero tag="Free device tool" title={t.title}><p>{t.intro}</p></GuideHero><FreeGeoTool idx={idx} products={geoOffers('imei_check',idx===2?['APPLE_CARRIER_LITE','BLACKLIST_FULL']:['APPLE_CARRIER_LITE'])}/><section className="guide-side"><h2>{t.q}</h2><p>{t.a}</p><a href={t.source}>Source and further reading ↗</a></section><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c')}}/></article>}
