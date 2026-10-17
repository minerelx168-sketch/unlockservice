'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseUsd, formatUsd } from '@/lib/money'

const QUICK_AMOUNTS = [10, 25, 50, 100, 250, 500]

export function WhopPaymentForm({ csrfToken, initialCents, minCents, maxCents }: {
  csrfToken: string; initialCents?: number; minCents: number; maxCents: number
}) {
  const router = useRouter()
  const [amount, setAmount] = useState(((initialCents ?? 1000) / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const key = useRef<string | null>(null)
  const amountCents = parseUsd(amount)
  const valid = amountCents !== null && amountCents >= minCents && amountCents <= maxCents
  function chooseAmount(value: string) {
    setAmount(value)
    key.current = null
    setError('')
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
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/payments/whop/checkout', { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csrfToken, amountCents, requestKey: key.current }) })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Could not create checkout.')
      if (!/^\/user\/invoice\/[a-f0-9]{32}$/.test(data.invoiceUrl)) throw new Error('Invalid invoice response.')
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
              className={amountCents === quick * 100 ? 'quick-amount quick-amount--active' : 'quick-amount'}
              aria-pressed={amountCents === quick * 100} onClick={() => chooseAmount(quick.toFixed(2))}>
              ${quick}
            </button>
          ))}
        </div>
        <div className="field funding-amount-field">
          <label htmlFor="card-credit-amount">Custom amount (USD)</label>
          <div className="money-input">
            <span aria-hidden="true">$</span>
            <input id="card-credit-amount" name="amount" type="text" className="mono" inputMode="decimal"
              autoComplete="off" placeholder="10.00" aria-describedby="card-amount-help" value={amount}
              disabled={busy} onChange={event => chooseAmount(event.target.value)} required />
          </div>
          <p className="field-note" id="card-amount-help">
            Enter {formatUsd(minCents)}–{formatUsd(maxCents)}, with up to two decimal places.
          </p>
        </div>
      </fieldset>
      <section className="funding-summary" aria-live="polite" aria-label="Card credit summary">
        <div className="funding-summary-total"><span>Credit you will receive</span><strong>{valid ? formatUsd(amountCents) : '—'}</strong></div>
        <p className="t-small">One-time purchase. Credit is added after payment verification.
          Review any applicable tax or fee on Whop before confirming payment.</p>
      </section>
      {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
      <button className="button button--accent funding-submit" type="submit" disabled={busy || !valid}>{busy ? 'Preparing checkout…' : 'Continue with card'}</button>
    </form>
  )
}
