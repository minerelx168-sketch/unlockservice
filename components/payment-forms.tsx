'use client'

import { useActionState } from 'react'
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
}: {
  gateways: Array<{ id: string; label: string; asset: string; network: string }>
}) {
  const [state, action, pending] = useActionState(createInvoiceAction, EMPTY)

  return (
    <form action={action} className="form-grid">
      <Problem message={state.error} />

      <div className="field">
        <label htmlFor="gateway">Payment method</label>
        <select
          id="gateway"
          name="gateway"
          defaultValue={gateways[0]?.id}
          style={{
            minHeight: 50,
            padding: '13px 14px',
            border: '1px solid var(--line)',
            borderRadius: 'var(--radius-control)',
            background: 'var(--surface)',
            color: 'var(--ink-strong)',
            fontSize: 15,
          }}
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
        <input id="amount" name="amount" className="mono" inputMode="decimal" placeholder="25.00" required />
      </div>

      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? 'Creating invoice…' : 'Create invoice'}
      </button>
    </form>
  )
}

export function PaymentReferenceForm({ reference }: { reference: string }) {
  const [state, action, pending] = useActionState(submitReferenceAction, EMPTY)

  return (
    <form action={action} className="form-grid" style={{ maxWidth: 'none' }}>
      <Problem message={state.error} />
      <input type="hidden" name="reference" value={reference} />
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
export function ApproveInvoiceForm({ reference }: { reference: string }) {
  const [state, action, pending] = useActionState(approveInvoiceAction, EMPTY)

  return (
    <form action={action} style={{ display: 'grid', gap: 10 }}>
      <Problem message={state.error} />
      <input type="hidden" name="reference" value={reference} />
      <button className="button button--quiet" type="submit" disabled={pending}>
        {pending ? 'Confirming…' : 'Simulate administrator confirmation'}
      </button>
    </form>
  )
}
