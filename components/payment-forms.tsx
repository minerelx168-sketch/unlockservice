'use client'

import { useActionState, useState } from 'react'
import { approveInvoiceAction, createInvoiceAction, type FormState } from '@/lib/actions'
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

const QUICK_AMOUNTS = ['10', '25', '50', '100']

export function AddFundsForm({
  gateways,
  defaultAmount,
}: {
  gateways: Array<{ id: string; label: string; asset: string; network: string; networkLabel: string }>
  defaultAmount?: string
}) {
  const [state, action, pending] = useActionState(createInvoiceAction, EMPTY)
  const [amount, setAmount] = useState(defaultAmount ?? '')
  const only = gateways.length === 1 ? gateways[0] : null

  return (
    <form action={action} className="form-grid">
      <Problem message={state.error} />

      {only ? (
        <>
          <input type="hidden" name="gateway" value={only.id} />
          <div className="pay-method">
            <span className="pay-method-asset">{only.asset}</span>
            <span>
              Pay with <strong>{only.asset}</strong> on {only.networkLabel}. Credited automatically once it arrives.
            </span>
          </div>
        </>
      ) : (
        <div className="field">
          <label htmlFor="gateway">Payment method</label>
          <select id="gateway" name="gateway" defaultValue={gateways[0]?.id}>
            {gateways.map((gateway) => (
              <option key={gateway.id} value={gateway.id}>
                {gateway.label} — {gateway.asset} on {gateway.networkLabel}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label htmlFor="amount">Credit to add (USD)</label>
        <div className="amount-chips" role="group" aria-label="Quick amounts">
          {QUICK_AMOUNTS.map((quick) => (
            <button
              key={quick}
              type="button"
              className={`amount-chip${amount === quick ? ' is-active' : ''}`}
              aria-pressed={amount === quick}
              onClick={() => setAmount(quick)}
            >
              ${quick}
            </button>
          ))}
        </div>
        <input
          id="amount"
          name="amount"
          className="mono"
          inputMode="decimal"
          placeholder="25.00"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          required
        />
      </div>

      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? 'Preparing payment…' : 'Continue to payment'}
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
