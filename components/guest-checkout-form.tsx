'use client'
import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { formatUsd } from '@/lib/money'
import { serviceIdentifier, identifierField, type ServiceInputType } from '@/lib/service-identifier'
import { paymentAnalyticsContext } from '@/lib/payment-analytics-client'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { deviceEmail } from '@/lib/device-intent-value'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { Icon } from './icons'

export function GuestCheckoutForm({ product, initialImei, initialEmail = '', enabled, method, onMethodChange, cryptoEnabled, cryptoRoutes }: {
  product: { inputType: ServiceInputType; code: string; name: string; priceCents: number; domain: 'unlock' | 'imei_check' }
  initialImei: string; initialEmail?: string; enabled: boolean
  method: 'card' | 'crypto'; onMethodChange: (method: 'card' | 'crypto') => void
  cryptoEnabled: boolean; cryptoRoutes: { id: string; label: string; asset: string }[]
}) {
  const field = identifierField(product.inputType)
  const [imei, setImei] = useState(initialImei), [email, setEmail] = useState(initialEmail), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [editing, setEditing] = useState(!serviceIdentifier(initialImei, product.inputType) || !deviceEmail(initialEmail))
  const key = useRef(''), lock = useRef(false)
  const [routeId, setRouteId] = useState(cryptoRoutes[0]?.id ?? '')
  const isCrypto = method === 'crypto'
  const cardQuote = guestCardQuote(product.priceCents)
  const deliveryEmail = email
  function changeMethod() { key.current = ''; setError(''); onMethodChange(isCrypto ? 'card' : 'crypto') }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    if (isCrypto ? !cryptoEnabled || !routeId : !enabled) return
    if (!serviceIdentifier(imei, product.inputType)) { setEditing(true); setError(field.error); return }
    if (!deviceEmail(deliveryEmail)) { setEditing(true); setError('Enter a valid email address for your result.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      if (!key.current) {
        const bytes=new TextEncoder().encode(`${product.code}:${imei.trim()}:${deliveryEmail.trim().toLowerCase()}:${method}:${routeId}:${product.priceCents}`)
        const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(n=>n.toString(16).padStart(2,'0')).join('')
        const storageKey=`iunlockmobile-checkout:${digest}`
        try { const saved=JSON.parse(sessionStorage.getItem(storageKey) || 'null'); if (saved?.expires>Date.now() && typeof saved.key==='string') key.current=saved.key } catch { /* Optional browser storage. */ }
        if (!/^[a-f0-9-]{32,64}$/i.test(key.current)) key.current=crypto.randomUUID()
        try { sessionStorage.setItem(storageKey,JSON.stringify({key:key.current,expires:Date.now()+1800000})) } catch { /* Server request key still protects retries. */ }
      }
      trackFunnelEvent('begin_checkout', { service_category: product.domain, value: (isCrypto ? product.priceCents : cardQuote.totalCents) / 100, currency: 'USD', payment_method: method })
      const analyticsContext = await paymentAnalyticsContext()
      const response = await fetch(isCrypto ? '/api/checkout/crypto' : '/api/checkout/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        productCode: product.code, imei, email: deliveryEmail, expectedPriceCents: product.priceCents, requestKey: key.current, acceptedTerms: true, analyticsContext, ...(isCrypto ? { routeId } : {}),
      }) })
      const data = await response.json()
      if (!response.ok || typeof data.url !== 'string') throw new Error(data.error || 'Unable to open checkout.')
      const target = new URL(data.url, window.location.origin)
      if (target.origin !== window.location.origin && (target.protocol !== 'https:' || !['whop.com', 'sandbox.whop.com'].includes(target.hostname))) throw new Error('Invalid checkout address.')
      window.location.assign(target.href)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to open checkout. Please retry.'); setBusy(false); lock.current = false }
  }
  return <form onSubmit={submit} className="guest-form" aria-busy={busy}>
    {!editing ? <div className="guest-details-review"><dl><div><dt>{field.label}</dt><dd>{`•••• ${serviceIdentifier(imei, product.inputType)?.slice(-4)}`}</dd></div><div><dt>Result email</dt><dd>{deliveryEmail}</dd></div></dl><button className="guest-edit" type="button" onClick={() => setEditing(true)} disabled={busy}>Edit details</button><p className="guest-note">Your details are saved. No account required.</p></div> : <>
      <label htmlFor="guest-imei">{field.label}</label>
      <input id="guest-imei" name="imei" type="text" inputMode={field.inputMode} autoComplete="off" maxLength={80} required value={imei} disabled={busy}
        onChange={e => { setImei(e.target.value); key.current = '' }} placeholder={field.placeholder} aria-describedby="guest-imei-hint" />
      <small id="guest-imei-hint">{field.hint}</small>
      <label htmlFor="guest-email">Email for your result</label>
      <input id="guest-email" name="email" type="email" autoComplete="email" maxLength={254} required value={deliveryEmail} disabled={busy}
        onChange={e => { setEmail(e.target.value); key.current = '' }} placeholder="you@example.com" aria-describedby="guest-email-hint" />
      <small id="guest-email-hint">Your confirmation, private tracking link and result go here.</small>
    </>}
    {isCrypto ? <div className="guest-crypto-choice"><strong>Crypto · No fee · No minimum</strong><label htmlFor="guest-crypto-asset">Pay with</label><select id="guest-crypto-asset" value={routeId} disabled={busy || !cryptoEnabled} onChange={event => { setRouteId(event.target.value); key.current = '' }}>{cryptoRoutes.map(route => <option key={route.id} value={route.id}>{route.label}</option>)}</select><small>BNB Smart Chain (BEP-20) only. Network or exchange fees may apply.</small></div> : null}
    <label className="guest-agreement"><input type="checkbox" required disabled={busy} /><span>I own this device or am authorized to service it. I have checked the identifier and service requirements and agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label>
    {error ? <p role="alert" className="guest-error">{error}</p> : null}
    <button className="button button--primary" type="submit" disabled={busy || (isCrypto ? !cryptoEnabled || !routeId : !enabled)}>{busy ? 'Opening secure payment…' : isCrypto ? `Continue with crypto · ${formatUsd(product.priceCents)}` : `Pay ${formatUsd(cardQuote.totalCents)} by card`}</button>
    <button type="button" className="guest-payment-alternative" disabled={busy} onClick={changeMethod}><Icon name="wallet" /><span>{isCrypto ? `Pay ${formatUsd(cardQuote.totalCents)} by card` : 'Pay with crypto'}</span>{!isCrypto ? <span className="guest-no-fee">No fee · No minimum</span> : null}</button>
    <p className="guest-note">{isCrypto ? 'Your QR code and exact transfer amount appear next. The service starts after your transfer is confirmed.' : 'Your service starts after payment confirmation. Any required tax is shown by Whop before you pay.'}</p>
    {(isCrypto ? !cryptoEnabled : !enabled) ? <p role="status">{isCrypto ? 'Crypto' : 'Card'} checkout is temporarily unavailable. Please choose another payment method or <Link href="/support">contact support</Link>.</p> : null}
  </form>
}


