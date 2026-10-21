'use client'
import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { formatUsd } from '@/lib/money'
import { isValidImei, normalizeImei } from '@/lib/imei'
import { paymentAnalyticsContext } from '@/lib/payment-analytics-client'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { deviceEmail } from '@/lib/device-intent-value'
import { Icon } from './icons'
export function GuestCheckoutForm({product,feeCents,initialImei,initialEmail='',enabled,belowCardMinimum,method,onMethodChange,cryptoEnabled,cryptoRoutes}:{product:{code:string;name:string;priceCents:number;domain?:'unlock'|'imei_check'};feeCents:number;initialImei:string;initialEmail?:string;enabled:boolean;belowCardMinimum:boolean;method:'card'|'crypto';onMethodChange:(method:'card'|'crypto')=>void;cryptoEnabled:boolean;cryptoRoutes:{id:string;label:string;asset:string}[]}) {
  const [imei,setImei]=useState(initialImei),[email,setEmail]=useState(initialEmail),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const [editing,setEditing]=useState(!isValidImei(normalizeImei(initialImei)) || !deviceEmail(initialEmail))
  const key=useRef(''),lock=useRef(false)
  const [routeId,setRouteId]=useState(cryptoRoutes[0]?.id??'')
  const isCrypto=method==='crypto'
  function changeMethod() { key.current='';setError('');onMethodChange(isCrypto?'card':'crypto') }
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(lock.current) return
    if(isCrypto ? !cryptoEnabled || !routeId : !enabled || belowCardMinimum) return
    if(!isValidImei(normalizeImei(imei))) {setError('Check your 15-digit IMEI. Dial *#06# to find it.');return}
    if(!deviceEmail(email)) {setEditing(true);setError('Enter a valid email address for your result.');return}
    lock.current=true;setBusy(true);setError('')
    if(!key.current) key.current=crypto.randomUUID()
    try {
      trackFunnelEvent('begin_checkout',{service_category:product.domain??'guest_service',value:product.priceCents/100,currency:'USD',payment_method:method})
      const analyticsContext=await paymentAnalyticsContext()
      const response=await fetch(isCrypto?'/api/checkout/crypto':'/api/checkout/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productCode:product.code,
        imei,email,expectedPriceCents:product.priceCents,requestKey:key.current,acceptedTerms:true,analyticsContext,...(isCrypto?{routeId}:{})})})
      const data=await response.json()
      if(!response.ok || typeof data.url!=='string') throw new Error(data.error || 'Unable to open checkout.')
      const target=new URL(data.url,window.location.origin)
      if(target.origin!==window.location.origin && (target.protocol!=='https:' || !['whop.com','sandbox.whop.com'].includes(target.hostname))) throw new Error('Invalid checkout address.')
      window.location.assign(target.href)
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to open checkout. Please retry.');setBusy(false);lock.current=false}
  }
  return <form onSubmit={submit} className="guest-form" aria-busy={busy}>
    {!editing ? <div className="guest-details-review"><dl><div><dt>Device IMEI</dt><dd>{normalizeImei(imei)}</dd></div><div><dt>Result email</dt><dd>{email}</dd></div></dl><button className="guest-edit" type="button" onClick={()=>setEditing(true)} disabled={busy}>Edit details</button><p className="guest-note">Your details are saved for this order. No account or password needed to pay.</p></div> : <>
    <label htmlFor="guest-imei">Device IMEI</label>
    <input id="guest-imei" name="imei" type="text" inputMode="numeric" autoComplete="off" maxLength={30} required value={imei} disabled={busy}
      onChange={e=>{setImei(e.target.value);key.current=''}} placeholder="15-digit IMEI" aria-describedby="guest-imei-hint" />
    <small id="guest-imei-hint">Dial *#06# or find it in Settings. Check every digit before paying.</small>
    <label htmlFor="guest-email">Email for your result</label>
    <input id="guest-email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy}
      onChange={e=>{setEmail(e.target.value);key.current=''}} placeholder="you@example.com" aria-describedby="guest-email-hint" />
    <small id="guest-email-hint">Your confirmation, private tracking link and result go here. No account or password needed.</small>
    </>}
    {isCrypto ? <div className="guest-crypto-choice"><strong>Crypto · No fee · No minimum</strong><label htmlFor="guest-crypto-asset">Pay with</label><select id="guest-crypto-asset" value={routeId} disabled={busy || !cryptoEnabled} onChange={event=>{setRouteId(event.target.value);key.current=''}}>{cryptoRoutes.map(route=><option key={route.id} value={route.id}>{route.label}</option>)}</select><small>BNB Smart Chain (BEP-20) only. Network or exchange fees may apply.</small></div> : null}
    <label className="guest-agreement"><input type="checkbox" required disabled={busy} /><span>I own this device or am authorized to service it. I have checked the IMEI and service requirements and agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label>
    {error ? <p role="alert" className="guest-error">{error}</p>:null}
    <button className="button button--primary" type="submit" disabled={busy || (isCrypto ? !cryptoEnabled || !routeId : !enabled || belowCardMinimum)}>{busy ? 'Opening secure payment…' : isCrypto ? `Continue with crypto · ${formatUsd(product.priceCents)}` : belowCardMinimum ? 'Card checkout minimum: $1.00' : `Pay ${formatUsd(product.priceCents+feeCents)} by card`}</button>
    <button type="button" className="guest-payment-alternative" disabled={busy} onClick={changeMethod}><Icon name="wallet" /><span>{isCrypto?'Pay by card instead (+5%)':'Pay with crypto'}</span>{!isCrypto?<span className="guest-no-fee">No fee · No minimum</span>:null}</button>
    <p className="guest-note">{isCrypto?'Your QR code and exact transfer amount appear next. The service starts after your transfer is confirmed.':'One order. No wallet top-up. Any tax required by the payment provider is shown before you confirm payment.'}</p>
    {!isCrypto && belowCardMinimum ? <p role="status" className="guest-note">Card payments start at $1.00. You can pay this service’s price with crypto, with no minimum or processing fee.</p>:null}
    {(isCrypto ? !cryptoEnabled : !enabled) ? <p role="status">{isCrypto?'Crypto':'Card'} checkout is temporarily unavailable. Please choose another payment method or <Link href="/support">contact support</Link>.</p>:null}
  </form>
}
