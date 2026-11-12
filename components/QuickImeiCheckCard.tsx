'use client'
import {useActionState} from 'react'
import {continueDeviceServiceAction} from '@/lib/device-intent-actions'
import type {GeoLocale} from '@/lib/geo-locales'
const labels={
 en:['Service · USD','Delivery email','Review order','Unavailable for ordering','Checkout is in English. Review the total before payment.'],
 es:['Servicio · USD','Correo de entrega','Revisar pedido','No disponible','El pago se realiza en inglés. Revisa el total antes de pagar.'],
 fr:['Service · USD','Courriel de livraison','Vérifier la commande','Indisponible','Le paiement se fait en anglais. Vérifiez le total avant de payer.'],
 pt:['Serviço · USD','E-mail para receber o resultado','Conferir pedido','Indisponível no momento','O pagamento é em inglês. Confira o total antes de pagar.'],
 de:['Dienst · USD','E-Mail für das Ergebnis','Bestellung prüfen','Derzeit nicht verfügbar','Die Zahlung erfolgt auf Englisch. Prüfen Sie den Gesamtpreis vor dem Bezahlen.'],
 ar:['الخدمة · دولار أمريكي','البريد الإلكتروني لاستلام النتيجة','مراجعة الطلب','الخدمة غير متاحة حالياً','الدفع باللغة الإنجليزية. راجع المبلغ الإجمالي قبل الدفع.']
}
export type Option={code:string;name:string;domain:string;cents:number}
export function QuickImeiCheckCard({locale,products,imei}:{locale:GeoLocale;products:Option[];imei?:string}){
 const [state,action,pending]=useActionState(continueDeviceServiceAction,{});const l=labels[locale]
 if(!products.length)return <p>{l[3]}</p>
 return <form className="stack" action={action}><input type="hidden" name="domain" value={products[0].domain}/>
 <label className="field">{l[0]}<select name="productCode">{products.map(p=><option key={p.code} value={p.code}>{p.name} · ${(p.cents/100).toFixed(2)}</option>)}</select></label>
 <label className="field">IMEI<input key={imei} defaultValue={imei} dir="ltr" name="imei" inputMode="numeric" maxLength={15} pattern="[0-9]{15}" required/></label>
 <label className="field">{l[1]}<input type="email" name="email" dir="ltr" autoComplete="email" required/></label>{state.error&&<p role="alert">{state.error}</p>}<button className="button button--primary" disabled={pending}>{l[2]}</button><small>{l[4]}</small></form>
}
