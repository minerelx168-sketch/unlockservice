'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseUsd, formatUsd } from '@/lib/money'

export function WhopPaymentForm({ csrfToken, initialCents, minCents, maxCents }: {
  csrfToken: string; initialCents?: number; minCents: number; maxCents: number
}) {
  const router = useRouter()
  const [amount, setAmount] = useState(((initialCents ?? 1000) / 100).toFixed(2))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const key = useRef<string | null>(null)
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
    <form onSubmit={submit} className="form-stack">
      <label htmlFor="card-credit-amount">Credit amount (USD)</label>
      <input id="card-credit-amount" name="amount" type="text" inputMode="decimal" autoComplete="off"
        value={amount} disabled={busy} onChange={event => { setAmount(event.target.value); key.current = null; setError('') }} required />
      <p className="t-small">One-time purchase. {formatUsd(minCents)}–{formatUsd(maxCents)} in service credits.
        Any tax or processing fee charged by Whop is shown before you confirm payment.</p>
      {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
      <button className="button button--accent" type="submit" disabled={busy}>{busy ? 'Preparing checkout…' : 'Continue with card'}</button>
    </form>
  )
}
