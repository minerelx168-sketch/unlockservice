'use client'

import { useActionState, useState } from 'react'
import { formatUsd, parseUsd } from '@/lib/money'
import {
  approveInvoiceAction,
  createInvoiceAction,
  submitReferenceAction,
  type FormState,
} from '@/lib/actions'
import { Icon } from './icons'

const EMPTY: FormState = {}

function Problem({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="alert alert--error" role="alert">
      <Icon name="info" strokeWidth={1.9} />
      <span>{message}</span>
    </p>
  )
}

export function AddFundsForm({
  gateways,
  minCents,
  maxCents,
  initialCents,
  returnTo,
}: {
  gateways: Array<{ id: string; label: string; asset: string; network: string; feeBasisPoints: number }>
  minCents: number
  maxCents: number
  initialCents: number
  returnTo?: string | null
}) {
  const [state, action, pending] = useActionState(createInvoiceAction, EMPTY)
  const [amount, setAmount] = useState((initialCents / 100).toFixed(2))
  const [gatewayId, setGatewayId] = useState(gateways[0]?.id ?? '')
  const cents = parseUsd(amount)
  const valid = cents !== null && cents >= minCents && cents <= maxCents
  const gateway = gateways.find((entry) => entry.id === gatewayId)
  const fee = valid && gateway ? Math.round(cents * gateway.feeBasisPoints / 10_000) : 0

  return (
    <form action={action} className="form-grid">
      <Problem message={state.error} />
      <input type="hidden" name="next" value={returnTo ?? ''} />

      <div className="field">
        <label htmlFor="gateway">Payment method</label>
        <select
          id="gateway"
          name="gateway"
          value={gatewayId}
          onChange={(event) => setGatewayId(event.currentTarget.value)}
        >
          {gateways.map((gateway) => (
            <option key={gateway.id} value={gateway.id}>
              {gateway.label} — {gateway.asset} on {gateway.network}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label htmlFor="amount">Credit to add (USD)</label>
        <input id="amount" name="amount" className="mono" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.currentTarget.value)} aria-describedby="amount-help" required />
        <p className="field-note" id="amount-help">Add between {formatUsd(minCents)} and {formatUsd(maxCents)}. Unused credit stays on your account.</p>
      </div>

      {valid ? (
        <div className="quote" aria-live="polite">
          <div><span className="label">Credit added</span><span className="value">{formatUsd(cents)}</span></div>
          <div><span className="label">Network fee</span><span className="value">{formatUsd(fee)}</span></div>
          <div><span className="label">Total due</span><span className="value">{formatUsd(cents + fee)}</span></div>
        </div>
      ) : <p className="t-small" role="status">Enter an amount within the range above to preview your total.</p>}
      <p className="t-small">Creating an invoice does not send a payment. Check the network and locked total on the next page. Your transfer is reviewed before credit is added.</p>

      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? 'Creating invoice…' : 'Create invoice'}
      </button>
    </form>
  )
}

export function PaymentReferenceForm({ reference, returnTo }: { reference: string; returnTo?: string | null }) {
  const [state, action, pending] = useActionState(submitReferenceAction, EMPTY)

  return (
    <form action={action} className="form-grid" style={{ maxWidth: 'none' }}>
      <Problem message={state.error} />
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="next" value={returnTo ?? ''} />
      <div className="field">
        <label htmlFor="paymentReference">Transaction reference</label>
        <input id="paymentReference" name="paymentReference" className="mono" required />
      </div>
      <div className="field">
        <label htmlFor="note">Note (optional)</label>
        <input id="note" name="note" />
      </div>
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? 'Submitting…' : 'I have paid — submit for review'}
      </button>
    </form>
  )
}

/** Stands in for the admin confirming the transfer. */
export function ApproveInvoiceForm({ reference, returnTo }: { reference: string; returnTo?: string | null }) {
  const [state, action, pending] = useActionState(approveInvoiceAction, EMPTY)

  return (
    <form action={action} style={{ display: 'grid', gap: 10 }}>
      <Problem message={state.error} />
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="next" value={returnTo ?? ''} />
      <button className="button button--quiet" type="submit" disabled={pending}>
        {pending ? 'Confirming…' : 'Simulate administrator confirmation'}
      </button>
    </form>
  )
}
