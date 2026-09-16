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
