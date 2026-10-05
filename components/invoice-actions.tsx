'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function CopyValue({
  id,
  label,
  value,
  buttonLabel,
  copiedMessage,
}: {
  id: string
  label: string
  value: string
  buttonLabel: string
  copiedMessage: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setMessage(copiedMessage)
    } catch {
      inputRef.current?.focus()
      inputRef.current?.select()
      setMessage('Value selected. Use your device’s copy command.')
    }
  }

  return (
    <div className="copy-value">
      <label htmlFor={id}>{label}</label>
      <div>
        <input ref={inputRef} id={id} className="mono" readOnly value={value} />
        <button className="button button--secondary" type="button" onClick={copy}>{buttonLabel}</button>
      </div>
      {message ? <p className="field-note" role="status">{message}</p> : null}
    </div>
  )
}

export function PaymentAddress({ address }: { address: string }) {
  return (
    <CopyValue
      id="payment-address"
      label="Wallet address"
      value={address}
      buttonLabel="Copy address"
      copiedMessage="Wallet address copied. Check the network before sending."
    />
  )
}

export function AutoRefreshPaymentStatus({ active }: { active: boolean }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (!active) return
    const timer = window.setInterval(() => {
      startTransition(() => router.refresh())
    }, 5_000)
    return () => window.clearInterval(timer)
  }, [active, router])

  if (!active) return null
  return (
    <button
      className="button button--secondary"
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? 'Updating status…' : 'Check status now'}
    </button>
  )
}

export function RefreshPaymentStatus() {
  return <AutoRefreshPaymentStatus active />
}

/**
 * The exact amount to send, with its last two digits — the request's code —
 * marked, because those are the digits people are tempted to round away.
 */
export function CodedAmount({ amount, asset }: { amount: string; asset: string }) {
  const [message, setMessage] = useState('')

  async function copy() {
    try {
      await navigator.clipboard.writeText(amount)
      setMessage('Amount copied. Paste it as is — including the last two digits.')
    } catch {
      setMessage(`Copy failed. Type ${amount} exactly.`)
    }
  }

  return (
    <div className="coded-amount">
      <span className="coded-amount-label" id="coded-amount-label">Send exactly</span>
      <div className="coded-amount-row">
        <strong aria-labelledby="coded-amount-label" className="coded-amount-value mono">
          {amount.slice(0, -2)}
          <mark>{amount.slice(-2)}</mark>
          <span>{asset}</span>
        </strong>
        <button className="button button--secondary" type="button" onClick={copy}>Copy amount</button>
      </div>
      {message ? <p className="field-note" role="status">{message}</p> : null}
    </div>
  )
}
