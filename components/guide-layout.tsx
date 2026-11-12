import {localProduct} from '@/lib/i18n/catalog'
import type {ReactNode} from 'react'
import type {PublicProviderProduct} from '@/lib/public-provider-catalog'
import {GuideOrder} from './guide-order'
import type {GeoLocale} from '@/lib/geo-locales'
import us from '@/app/(marketing)/services/unlock/us/us-unlock.module.css'
import spoke from '@/styles/service-spoke.module.css'
export function orderOptions(products:PublicProviderProduct[]){return products.filter(p=>p.status==='available'&&p.priceAvailable).map(p=>({code:p.productCode,domain:p.domain,name:p.name,category:p.group,summary:p.summary,hasExample:p.hasExample,available:true,inputType:p.inputType,priceCents:p.priceCents,priceAvailable:true,etaLabel:p.etaLabel}))}
export function GuideLayout({locale,title,intro,note,tag,domain,products,children}:{locale:GeoLocale;title:string;intro:string;note?:string;tag:string;domain:'unlock'|'imei_check';products:PublicProviderProduct[];children?:ReactNode}){
 const check=domain==='imei_check'
 return <section lang={locale} className={'section section--tint service-entry-section unlock-landing '+(check?spoke.page:us.page)}><div className="shell"><nav className="service-breadcrumb" aria-label={tag}><a href={locale==='en'?'/':'/'+(locale==='fr'?'fr-ca':locale)}>iUnlockMobile</a><span>/</span><span>{tag}</span></nav><header className="service-hero-copy"><span className="hero-chip">{tag}</span><h1 className="service-entry-title">{title}</h1><p className="t-lead">{intro}</p></header><div className={check?spoke.facts:''}><div className={check?spoke.card:'requirements-card '+us.infoCard}>{note&&<p>{note}</p>}{children}</div></div><GuideOrder locale={locale} domain={domain} options={orderOptions(products).map(p=>localProduct(p,locale))}/></div></section>
}
