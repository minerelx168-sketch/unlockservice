'use client'
import {useActionState} from 'react'
import {continueDeviceServiceAction} from '@/lib/device-intent-actions'
export function LocalOrder({fr,products}:{fr:boolean,products:{code:string,name:string,domain:string,cents:number}[]}) {
 const [state,action,pending]=useActionState(continueDeviceServiceAction, {})
 if (!products.length) return <p>{fr?'Commande en ligne temporairement indisponible.':'Los pedidos no están disponibles por el momento.'}</p>
 return <form action={action} className="stack">
 <input type="hidden" name="domain" value={products[0].domain}/>
 <label className="field">{fr?'Service et prix de base (USD)':'Servicio y precio base (USD)'}<select required name="productCode">{products.map(p=><option key={p.code} value={p.code}>{p.name} · {(p.cents/100).toFixed(2)} USD</option>)}</select></label>
 <label className="field">IMEI<input required name="imei" type="text" inputMode="numeric" pattern="[0-9]{15}" maxLength={15} placeholder={fr?'15 chiffres':'15 dígitos'}/></label>
 <label className="field">{fr?'Courriel pour recevoir le résultat':'Correo para recibir el resultado'}<input required name="email" type="email" autoComplete="email"/></label>
 {state.error && <p role="alert">{state.error}</p>}
 <button className="button button--primary" disabled={pending}>{fr?'Vérifier ma commande':'Revisar mi pedido'}</button>
 <p className="t-small">{fr?'Le paiement se fait en anglais. Vérifiez le total avant de payer.':'El pago se realiza en inglés. Revisa el total antes de pagar.'}</p></form>
}
