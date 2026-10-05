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
const QUICK_AMOUNTS = [10, 25, 50, 100]

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
  maxCents,
  initialCents,
  returnTo,
}: {
  gateways: Array<{
    id: string
    label: string
    asset: string
    network: string
    feeBasisPoints: number
    automaticVerification: boolean
    riskClassification: 'issuer_native' | 'third_party_pegged'
  }>
  maxCents: number
  initialCents?: number
  returnTo?: string | null
}) {
  const [state, action, pending] = useActionState(createInvoiceAction, EMPTY)
  const [amount, setAmount] = useState(initialCents ? (initialCents / 100).toFixed(2) : '10.00')
  const [gatewayId, setGatewayId] = useState(gateways[0]?.id ?? '')
  const cents = parseUsd(amount)
  const valid = cents !== null && cents > 0 && cents <= maxCents
  const gateway = gateways.find((entry) => entry.id === gatewayId)
  const fee = valid && gateway ? Math.round(cents * gateway.feeBasisPoints / 10_000) : 0

  return (
    <form action={action} className="funding-form">
      <Problem message={state.error} />
      <input type="hidden" name="next" value={returnTo ?? ''} />
      <input type="hidden" name="gateway" value={gatewayId} />

      <fieldset className="funding-step">
        <legend><span>1</span> Choose credit amount</legend>
        <div className="quick-amounts" aria-label="Quick credit amounts">
          {QUICK_AMOUNTS.map((quick) => (
            <button
              className={amount === quick.toFixed(2) ? 'quick-amount quick-amount--active' : 'quick-amount'}
              key={quick}
              type="button"
              onClick={() => setAmount(quick.toFixed(2))}
              aria-pressed={amount === quick.toFixed(2)}
            >
              ${quick}
            </button>
          ))}
        </div>
        <div className="field funding-amount-field">
          <label htmlFor="amount">Custom amount (USD)</label>
          <div className="money-input">
            <span aria-hidden="true">$</span>
            <input
              id="amount"
              name="amount"
              className="mono"
              inputMode="decimal"
              autoComplete="off"
              placeholder="10.00"
              value={amount}
              onChange={(event) => setAmount(event.currentTarget.value)}
              aria-describedby="amount-help"
              required
            />
          </div>
          <p className="field-note" id="amount-help">
            Enter any amount above $0.00, up to {formatUsd(maxCents)}, using no more than two decimal places.
          </p>
        </div>
      </fieldset>

      <fieldset className="funding-step">
        <legend><span>2</span> Confirm payment method</legend>
        <div className="payment-method-grid">
          {gateways.map((entry) => (
            <button
              className={entry.id === gatewayId ? 'payment-method-card payment-method-card--active' : 'payment-method-card'}
              key={entry.id}
              type="button"
              onClick={() => setGatewayId(entry.id)}
              aria-pressed={entry.id === gatewayId}
            >
              <span className="payment-method-icon">{entry.asset === 'USDC' ? '$' : '₮'}</span>
              <span>
                <strong>{entry.label}</strong>
                <small>{entry.asset} · {entry.network}</small>
                {entry.riskClassification === 'third_party_pegged' ? (
                  <small>Binance-issued pegged representation</small>
                ) : null}
              </span>
              <span className="badge badge--success">Auto verification</span>
            </button>
          ))}
        </div>
      </fieldset>

      <section className="funding-summary" aria-live="polite" aria-label="Payment request summary">
        <div>
          <span>Requested credit</span>
          <strong>{valid ? formatUsd(cents) : '—'}</strong>
        </div>
        <div>
          <span>Service fee</span>
          <strong>{valid ? formatUsd(fee) : '—'}</strong>
        </div>
        <div className="funding-summary-total">
          <span>Suggested amount to send</span>
          <strong>{valid ? formatUsd(cents + fee) : '—'}</strong>
        </div>
      </section>

      <button className="button button--primary funding-submit" type="submit" disabled={pending || !valid || !gatewayId}>
        {pending ? 'Creating payment request…' : 'Create payment request'}
      </button>
    </form>
  )
}

export function PaymentReferenceForm({
  reference,
  returnTo,
  chainKind,
  network,
  asset,
}: {
  reference: string
  returnTo?: string | null
  chainKind: 'evm' | 'tron'
  network: string
  asset: string
}) {
  const [state, action, pending] = useActionState(submitReferenceAction, EMPTY)
  const isTron = chainKind === 'tron'

  return (
    <form action={action} className="form-grid payment-hash-form">
      <Problem message={state.error} />
      <input type="hidden" name="reference" value={reference} />
      <input type="hidden" name="next" value={returnTo ?? ''} />
      <div className="field">
        <label htmlFor="paymentReference">{isTron ? 'TRON transaction ID' : 'Transaction hash'}</label>
        <input
          id="paymentReference"
          name="paymentReference"
          className="mono"
          autoComplete="off"
          spellCheck={false}
          placeholder={isTron ? '64 hexadecimal characters' : '0x…'}
          pattern={isTron ? '[a-fA-F0-9]{64}' : '0x[a-fA-F0-9]{64}'}
          minLength={isTron ? 64 : 66}
          maxLength={isTron ? 64 : 66}
          aria-describedby="transaction-help"
          required
        />
        <p className="field-note" id="transaction-help">
          Paste the transaction identifier after sending {asset} on {network}. The verified on-chain amount determines the credit; a wallet address is not a transaction ID.
        </p>
      </div>
      <div className="field">
        <label htmlFor="note">Note to support <span className="t-small">(optional)</span></label>
        <input id="note" name="note" maxLength={500} placeholder="Only add context if support may need it" />
      </div>
      <button className="button button--primary" type="submit" disabled={pending}>
        {pending ? 'Submitting for verification…' : 'Verify my payment'}
      </button>
    </form>
  )
}

/** Development-only simulation; production always keeps self approval disabled. */
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
