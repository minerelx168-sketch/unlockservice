'use client'
import { useRef, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { formatUsd } from '@/lib/money'
import { isValidImei, normalizeImei } from '@/lib/imei'
import { paymentAnalyticsContext } from '@/lib/payment-analytics-client'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { deviceEmail } from '@/lib/device-intent-value'
import { prepareSmallCardAccountAction } from '@/lib/device-intent-actions'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { Icon } from './icons'

export function GuestCheckoutForm({ product, initialImei, initialEmail = '', enabled, method, onMethodChange, cryptoEnabled, cryptoRoutes, accountReady, accountEmail }: {
  product: { code: string; name: string; priceCents: number; domain: 'unlock' | 'imei_check' }
  initialImei: string; initialEmail?: string; enabled: boolean
  method: 'card' | 'crypto'; onMethodChange: (method: 'card' | 'crypto') => void
  cryptoEnabled: boolean; cryptoRoutes: { id: string; label: string; asset: string }[]
  accountReady: boolean; accountEmail: string
}) {
  const [imei, setImei] = useState(initialImei), [email, setEmail] = useState(initialEmail), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [editing, setEditing] = useState(!isValidImei(normalizeImei(initialImei)) || !deviceEmail(initialEmail))
  const key = useRef(''), lock = useRef(false)
  const [routeId, setRouteId] = useState(cryptoRoutes[0]?.id ?? '')
  const isCrypto = method === 'crypto'
  const cardQuote = guestCardQuote(product.priceCents)
  const accountCard = !isCrypto && cardQuote.requiresAccount
  const needsAccount = accountCard && !accountReady
  const deliveryEmail = accountCard && accountReady ? accountEmail : email
  function changeMethod() { key.current = ''; setError(''); onMethodChange(isCrypto ? 'card' : 'crypto') }
  async function openAccountSetup() {
    const state = await prepareSmallCardAccountAction({ productCode: product.code, domain: product.domain, imei, email: deliveryEmail })
    if (state.error || !state.url) throw new Error(state.error || 'Unable to open account setup.')
    const target = new URL(state.url, window.location.origin)
    if (target.origin !== window.location.origin) throw new Error('Invalid account setup address.')
    window.location.assign(target.href)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (lock.current) return
    if (isCrypto ? !cryptoEnabled || !routeId : !enabled) return
    if (!isValidImei(normalizeImei(imei))) { setEditing(true); setError('Check your 15-digit IMEI. Dial *#06# to find it.'); return }
    if (!deviceEmail(deliveryEmail)) { setEditing(true); setError('Enter a valid email address for your result.'); return }
    lock.current = true; setBusy(true); setError('')
    try {
      if (needsAccount) {
        // Save the current form before registration; no payment request is created here.
        await openAccountSetup()
        return
      }
      if (!key.current) key.current = crypto.randomUUID()
      trackFunnelEvent('begin_checkout', { service_category: product.domain, value: product.priceCents / 100, currency: 'USD', payment_method: method })
      const analyticsContext = await paymentAnalyticsContext()
      const response = await fetch(isCrypto ? '/api/checkout/crypto' : '/api/checkout/guest', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        productCode: product.code, imei, email: deliveryEmail, expectedPriceCents: product.priceCents, requestKey: key.current, acceptedTerms: true, analyticsContext, ...(isCrypto ? { routeId } : {}),
      }) })
      const data = await response.json()
      if (response.status === 401 && accountCard) { await openAccountSetup(); return }
      if (!response.ok || typeof data.url !== 'string') throw new Error(data.error || 'Unable to open checkout.')
      const target = new URL(data.url, window.location.origin)
      if (target.origin !== window.location.origin && (target.protocol !== 'https:' || !['whop.com', 'sandbox.whop.com'].includes(target.hostname))) throw new Error('Invalid checkout address.')
      window.location.assign(target.href)
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to open checkout. Please retry.'); setBusy(false); lock.current = false }
  }
  return <form onSubmit={submit} className="guest-form" aria-busy={busy}>
    {!editing ? <div className="guest-details-review"><dl><div><dt>Device IMEI</dt><dd>{normalizeImei(imei)}</dd></div><div><dt>Result email</dt><dd>{deliveryEmail}</dd></div></dl><button className="guest-edit" type="button" onClick={() => setEditing(true)} disabled={busy}>Edit details</button><p className="guest-note">{accountCard && accountReady ? 'Your result and unused credit go to your signed-in account.' : 'Your details are saved for this order.'}</p></div> : <>
      <label htmlFor="guest-imei">Device IMEI</label>
      <input id="guest-imei" name="imei" type="text" inputMode="numeric" autoComplete="off" maxLength={30} required value={imei} disabled={busy}
        onChange={e => { setImei(e.target.value); key.current = '' }} placeholder="15-digit IMEI" aria-describedby="guest-imei-hint" />
      <small id="guest-imei-hint">Dial *#06# or find it in Settings. Check every digit before paying.</small>
      <label htmlFor="guest-email">Email for your result</label>
      <input id="guest-email" name="email" type="email" autoComplete="email" maxLength={254} required value={deliveryEmail} disabled={busy} readOnly={accountCard && accountReady}
        onChange={e => { setEmail(e.target.value); key.current = '' }} placeholder="you@example.com" aria-describedby="guest-email-hint" />
      <small id="guest-email-hint">{accountCard && accountReady ? 'Your result and unused credit go to your signed-in account.' : 'Your confirmation, private tracking link and result go here.'}</small>
    </>}
    {isCrypto ? <div className="guest-crypto-choice"><strong>Crypto · No fee · No minimum</strong><label htmlFor="guest-crypto-asset">Pay with</label><select id="guest-crypto-asset" value={routeId} disabled={busy || !cryptoEnabled} onChange={event => { setRouteId(event.target.value); key.current = '' }}>{cryptoRoutes.map(route => <option key={route.id} value={route.id}>{route.label}</option>)}</select><small>BNB Smart Chain (BEP-20) only. Network or exchange fees may apply.</small></div> : null}
    {accountCard ? <p className="guest-credit-note"><strong>{needsAccount ? `Create an account to continue. ${formatUsd(cardQuote.walletCreditCents)} is saved as credit after payment.` : `Your ${formatUsd(cardQuote.walletCreditCents)} difference is saved as account credit after payment.`}</strong></p> : null}
    {!needsAccount ? <label className="guest-agreement"><input type="checkbox" required disabled={busy} /><span>I own this device or am authorized to service it. I have checked the IMEI and service requirements and agree to the <Link href="/terms" target="_blank">Terms</Link> and <Link href="/privacy" target="_blank">Privacy Policy</Link>.</span></label> : null}
    {error ? <p role="alert" className="guest-error">{error}</p> : null}
    <button className="button button--primary" type="submit" disabled={busy || (isCrypto ? !cryptoEnabled || !routeId : !enabled)}>{busy ? needsAccount ? 'Opening account setup…' : 'Opening secure payment…' : isCrypto ? `Continue with crypto · ${formatUsd(product.priceCents)}` : needsAccount ? 'Create account & continue' : `Pay ${formatUsd(cardQuote.totalCents)} by card`}</button>
    <button type="button" className="guest-payment-alternative" disabled={busy} onClick={changeMethod}><Icon name="wallet" /><span>{isCrypto ? 'Pay by card instead (+5%)' : 'Pay with crypto'}</span>{!isCrypto ? <span className="guest-no-fee">No fee · No minimum</span> : null}</button>
    <p className="guest-note">{isCrypto ? 'Your QR code and exact transfer amount appear next. The service starts after your transfer is confirmed.' : needsAccount ? 'Already registered? You can sign in on the next screen. We will bring you back here with your order saved.' : accountCard ? 'Your order starts and the difference is credited only after payment is confirmed.' : 'One order. No wallet top-up. Any tax required by the payment provider is shown before you confirm payment.'}</p>
    {(isCrypto ? !cryptoEnabled : !enabled) ? <p role="status">{isCrypto ? 'Crypto' : 'Card'} checkout is temporarily unavailable. Please choose another payment method or <Link href="/support">contact support</Link>.</p> : null}
  </form>
}
