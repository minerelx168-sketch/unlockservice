'use client'
import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { formatUsd } from '@/lib/money'
import { isValidImei, normalizeImei } from '@/lib/imei'
import { paymentAnalyticsContext } from '@/lib/payment-analytics-client'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
export function GuestCheckoutForm({product,feeCents,initialImei,enabled}:{product:{code:string;name:string;priceCents:number};feeCents:number;initialImei:string;enabled:boolean}) {
  const [imei,setImei]=useState(initialImei),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('')
  const key=useRef(''),lock=useRef(false)
  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if(lock.current) return
    if(!isValidImei(normalizeImei(imei))) {setError('Check your 15-digit IMEI. Dial *#06# to find it.');return}
    lock.current=true;setBusy(true);setError('')
    if(!key.current) key.current=crypto.randomUUID()
    try {
      trackFunnelEvent('begin_checkout',{service_category:'guest_service',value:product.priceCents/100,currency:'USD'})
      const analyticsContext=await paymentAnalyticsContext()
      const response=await fetch('/api/checkout/guest',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({productCode:product.code,
        imei,email,expectedPriceCents:product.priceCents,requestKey:key.current,acceptedTerms:true,analyticsContext})})
      const data=await response.json()
      if(!response.ok || typeof data.url!=='string') throw new Error(data.error || 'Unable to open checkout.')
      const target=new URL(data.url,window.location.origin)
      if(target.origin!==window.location.origin && (target.protocol!=='https:' || !['whop.com','sandbox.whop.com'].includes(target.hostname))) throw new Error('Invalid checkout address.')
      window.location.assign(target.href)
    } catch(e) {setError(e instanceof Error ? e.message : 'Unable to open checkout. Please retry.');setBusy(false);lock.current=false}
  }
  return <form onSubmit={submit} className="guest-form" aria-busy={busy}>
    <label htmlFor="guest-imei">Device IMEI</label>
    <input id="guest-imei" name="imei" type="text" inputMode="numeric" autoComplete="off" maxLength={30} required value={imei} disabled={busy}
      onChange={e=>{setImei(e.target.value);key.current=''}} placeholder="15-digit IMEI" aria-describedby="guest-imei-hint" />
    <small id="guest-imei-hint">Dial *#06# or find it in Settings. Check every digit before paying.</small>
    <label htmlFor="guest-email">Email for your result</label>
    <input id="guest-email" name="email" type="email" autoComplete="email" maxLength={254} required value={email} disabled={busy}
      onChange={e=>{setEmail(e.target.value);key.current=''}} placeholder="you@example.com" aria-describedby="guest-email-hint" />
    <small id="guest-email-hint">Your confirmation, private tracking link and result go here. No account or password needed.</small>
    <label className="guest-agreement"><input type="checkbox" required disabled={busy} /><span>I own this device or am authorized to service it. I have checked the IMEI and service requirements and agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label>
    {error ? <p role="alert" className="guest-error">{error}</p>:null}
    <button className="button button--primary" type="submit" disabled={busy || !enabled}>{busy ? 'Opening secure payment…' : `Pay ${formatUsd(product.priceCents+feeCents)} by card`}</button>
    <p className="guest-note">One order. No wallet top-up. Any tax required by the payment provider is shown before you confirm payment.</p>
    {!enabled ? <p role="status">Direct card checkout is temporarily unavailable. Please contact support or <Link href={`/user/reports/new?product=${encodeURIComponent(product.code)}`}>use your existing account balance</Link>.</p>:null}
  </form>
}
