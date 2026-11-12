'use client'
import {useState} from 'react'
import {HeroPriceCheck,type PriceCheckProduct} from './hero-price-check'
import {formatUsd} from '@/lib/money'
import type {GeoLocale} from '@/lib/geo-locales'
import us from '@/app/(marketing)/services/unlock/us/us-unlock.module.css'
import spoke from '@/styles/service-spoke.module.css'

const copy={
 en:['Service','Price · USD','Estimated delivery','Choose service','Currently unavailable'],
 es:['Servicio','Precio · USD','Entrega estimada','Elegir servicio','No disponible'],
 fr:['Service','Prix · USD','Délai estimé','Choisir ce service','Non disponible'],
 pt:['Serviço','Preço · USD','Prazo estimado','Escolher serviço','Indisponível'],
 de:['Dienst','Preis · USD','Bearbeitungszeit','Dienst auswählen','Derzeit nicht verfügbar'],
 ar:['الخدمة','السعر · دولار','المدة التقديرية','اختيار الخدمة','غير متاح حالياً']
}
export function GuideOrder({options,domain,locale='en',initial,anchor='guide-order'}:{options:PriceCheckProduct[];domain:'unlock'|'imei_check';locale?:GeoLocale;initial?:string;anchor?:string}){
 const [selected,select]=useState(options.find(p=>p.code===initial)?.code??options[0]?.code)
 const [service,price,eta,choose,empty]=copy[locale]
 if(!options.length)return <p className="requirements-card">{empty}</p>
 return <>{domain==='unlock'?<ul className={us.serviceGrid}>{options.map((p,i)=><li key={p.code} className={'card card--step '+us.serviceCard}><span className="step-numeral" aria-hidden="true">{String(i+1).padStart(2,'0')}</span><h3 className="t-card">{p.name}</h3><div className={us.price}><span>{price}</span><strong>{formatUsd(p.priceCents)}</strong></div><div className={us.delivery}><span>{eta}</span><strong>{p.etaLabel}</strong></div><a href={'#'+anchor} className={'button button--primary '+us.chooseButton} onClick={()=>select(p.code)}>{choose} →</a></li>)}</ul>:<div className={spoke.tableWrap} tabIndex={0}><table><caption>{service}</caption><thead><tr>{[service,price,eta].map(x=><th key={x} scope="col">{x}</th>)}</tr></thead><tbody>{options.map(p=><tr key={p.code}><th scope="row">{p.name}</th><td>{formatUsd(p.priceCents)}</td><td>{p.etaLabel}</td></tr>)}</tbody></table></div>}
 <div id={anchor} className={'hero-panel '+us.orderPanel}><HeroPriceCheck key={selected} ordering fixedDomain={domain} initialProductCode={selected} check={domain==='imei_check'?options:[]} unlock={domain==='unlock'?options:[]}/></div></>
}
