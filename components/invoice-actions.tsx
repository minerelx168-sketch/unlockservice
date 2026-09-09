'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function PaymentAddress({ address }: { address: string }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState('')
  async function copy() {
    try {
      await navigator.clipboard.writeText(address)
      setMessage('Wallet address copied. Check the network before sending.')
    } catch {
      inputRef.current?.focus()
      inputRef.current?.select()
      setMessage('Address selected. Use your device’s copy command.')
    }
  }
  return (
    <div className="field">
      <label htmlFor="address">Wallet address</label>
      <input ref={inputRef} id="address" className="mono" readOnly value={address} />
      <button className="button button--secondary" type="button" onClick={copy}>Copy wallet address</button>
      {message ? <p className="field-note" role="status">{message}</p> : null}
    </div>
  )
}

export function RefreshPaymentStatus() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  return <button className="button button--secondary" type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())}>{pending ? 'Checking payment…' : 'Refresh payment status'}</button>
}
