'use client'
import {useActionState} from 'react'
import {continueDeviceServiceAction} from '@/lib/device-intent-actions'
import type {GeoLocale} from '@/lib/geo-locales'
import {msg} from '@/lib/i18n/messages'
export type Option={code:string;name:string;domain:string;cents:number}
export function QuickImeiCheckCard({locale,products,imei,paymentMethod,priceLabel}:{locale:GeoLocale;products:Option[];imei?:string;paymentMethod?:'card'|'crypto';priceLabel?:string}){
 const [state,action,pending]=useActionState(continueDeviceServiceAction,{});const t=(k:Parameters<typeof msg>[1])=>msg(locale,k)
 if(!products.length)return <p>{t('Unavailable online')}</p>
 return <form className="price-check" action={action}><input type="hidden" name="locale" value={locale}/><input type="hidden" name="domain" value={products[0].domain}/>
 {paymentMethod && <input type="hidden" name="paymentMethod" value={paymentMethod}/>}
 <label className="field">{t('Service & price')}<select name="productCode">{products.map(p=><option key={p.code} value={p.code}>{p.name} · {(products.length === 1 && priceLabel) || '$' + (p.cents/100).toFixed(2)}</option>)}</select></label>
 <label className="field">IMEI<input key={imei} defaultValue={imei} dir="ltr" name="imei" inputMode="numeric" maxLength={15} pattern="[0-9]{15}" required/></label>
 <label className="field">{t('Email for your result')}<input type="email" name="email" dir="ltr" autoComplete="email" required/></label>{state.error&&<p role="alert">{locale==='en'?state.error:t('Try again')}</p>}<button className="button button--primary" disabled={pending}>{t('Review order')}</button><small>{t('Review your details and total. The real check starts after payment.')}</small></form>
}
