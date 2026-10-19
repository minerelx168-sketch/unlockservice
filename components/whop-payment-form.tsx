'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseUsd, formatUsd } from '@/lib/money'
import { CARD_FEE_PERCENT, cardFeeCents } from '@/lib/card-fee'
import { trackFunnelEventOnce } from '@/lib/funnel-analytics'

const QUICK_AMOUNTS = [1, 10, 25, 50, 100]

export function WhopPaymentForm({ csrfToken, initialCents, minCents, maxCents }: {
  csrfToken: string; initialCents?: number; minCents: number; maxCents: number
}) {
  const router = useRouter()
  const [amount, setAmount] = useState(((initialCents ?? 1000) / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [customAmount, setCustomAmount] = useState(!QUICK_AMOUNTS.some(quick => quick * 100 === (initialCents ?? 1000)))
  const amountInput = useRef<HTMLInputElement>(null)
  const key = useRef<string | null>(null)
  useEffect(() => {
    // Back from hosted checkout may restore the page with its pending state.
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) setBusy(false) }
    window.addEventListener('pageshow', onPageShow)
    return () => window.removeEventListener('pageshow', onPageShow)
  }, [])
  const amountCents = parseUsd(amount)
  const valid = amountCents !== null && amountCents >= minCents && amountCents <= maxCents
  const feeCents = valid ? cardFeeCents(amountCents) : 0
  function chooseAmount(value: string, custom = false) {
    setAmount(value)
    setCustomAmount(custom)
    key.current = null
    setError('')
  }
  function enterAmount() {
    setCustomAmount(true)
    amountInput.current?.focus()
    amountInput.current?.select()
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const amountCents = parseUsd(amount)
    if (amountCents === null || amountCents < minCents || amountCents > maxCents) {
      setError(`Enter an amount from ${formatUsd(minCents)} to ${formatUsd(maxCents)}.`)
      return
    }
    key.current ??= crypto.randomUUID()
    trackFunnelEventOnce('begin_checkout', key.current, { service_category: 'account_credit', payment_method: 'card', currency: 'USD', value: amountCents / 100 })
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/payments/whop/checkout', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrfToken, amountCents, requestKey: key.current }) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not create checkout.')
      if (!/^\/user\/invoice\/[a-f0-9]{32}$/.test(data.invoiceUrl)) throw new Error('Invalid invoice response.')
      const reference = data.invoiceUrl.slice('/user/invoice/'.length)
      if (data.checkoutUrl != null) {
        const checkout = new URL(data.checkoutUrl)
        if (checkout.protocol !== 'https:' || !['whop.com', 'sandbox.whop.com'].includes(checkout.hostname)
          || checkout.username || checkout.password || checkout.port) throw new Error('Invalid checkout response.')
        if (checkout.hostname === 'whop.com') trackFunnelEventOnce('payment_request_created', reference, { service_category: 'account_credit', payment_method: 'card', status: 'created' })
        window.location.assign(checkout.href)
        return
      }
      // A previously completed payment still opens its status page.
      router.push(data.invoiceUrl)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Could not connect. Please retry.')
      setBusy(false)
    }
  }
  return (
    <form onSubmit={submit} className="funding-form">
      <fieldset className="funding-step" disabled={busy}>
        <legend><span>1</span> Choose card credit amount</legend>
        <div className="quick-amounts quick-amounts--card" role="group" aria-label="Quick card credit amounts">
          {QUICK_AMOUNTS.filter(quick => quick * 100 >= minCents && quick * 100 <= maxCents).map(quick => (
            <button key={quick} type="button" disabled={busy}
              className={!customAmount && amountCents === quick * 100 ? 'quick-amount quick-amount--active' : 'quick-amount'}
              aria-pressed={!customAmount && amountCents === quick * 100} onClick={() => chooseAmount(quick.toFixed(2))}>
              ${quick}
            </button>
          ))}
          <button type="button" disabled={busy}
            className={customAmount ? 'quick-amount quick-amount--active' : 'quick-amount'}
            aria-pressed={customAmount} aria-controls="card-credit-amount" onClick={enterAmount}>
            Enter amount
          </button>
        </div>
        <div className="field funding-amount-field">
          <label htmlFor="card-credit-amount">Custom amount (USD)</label>
          <div className="money-input">
            <span aria-hidden="true">$</span>
            <input ref={amountInput} id="card-credit-amount" name="amount" type="text" className="mono" inputMode="decimal"
              autoComplete="off" placeholder="10.00" aria-describedby="card-amount-help" value={amount}
              disabled={busy} onChange={event => chooseAmount(event.target.value, true)} required />
          </div>
          <p className="field-note" id="card-amount-help">
            Minimum {formatUsd(minCents)} · Maximum {formatUsd(maxCents)}. Use up to two decimal places.
          </p>
        </div>
      </fieldset>
      <section className="funding-summary" aria-live="polite" aria-label="Card credit summary">
        <div><span>Credit you will receive</span><strong>{valid ? formatUsd(amountCents) : '—'}</strong></div>
        <div><span>Card payment fee ({CARD_FEE_PERCENT}%)</span><strong>{valid ? formatUsd(feeCents) : '—'}</strong></div>
        <div className="funding-summary-total"><span>Total before tax</span><strong>{valid ? formatUsd(amountCents + feeCents) : '—'}</strong></div>
        <p className="t-small">One-time purchase. Credit is added after payment verification.
          Review any applicable tax or fee on Whop before confirming payment.</p>
      </section>
      {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
      <button className="button button--accent funding-submit" type="submit" disabled={busy || !valid}>{busy ? 'Preparing checkout…' : 'Continue with card'}</button>
    </form>
  )
}
