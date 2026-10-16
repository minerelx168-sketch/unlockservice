'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/lib/actions'
import { findOrderAction } from '@/lib/track-actions'
import { Icon } from './icons'

const EMPTY: FormState = {}

/**
 * Email and order number. Both fields are controlled: React resets a form
 * when its action returns, and a validation error that also emptied the
 * boxes would ask the customer to type everything twice.
 */
export function TrackOrderForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(findOrderAction, EMPTY)
  const [email, setEmail] = useState(defaultEmail)
  const [reference, setReference] = useState('')

  return (
    <form className="panel track-card" action={action} noValidate aria-busy={pending}>
      <header>
        <h2>Find your order</h2>
        <span>From any device</span>
      </header>
      <div className="panel-body stack" style={{ gap: 16 }}>
        {state.error ? (
          <p className="alert alert--error" role="alert">
            <Icon name="info" strokeWidth={1.9} />
            <span>{state.error}</span>
          </p>
        ) : null}

        <div className="field">
          <label htmlFor="track-email">Account email</label>
          <input
            id="track-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.currentTarget.value)}
          />
          <p className="field-note" data-state="idle">
            <Icon name="info" strokeWidth={1.9} />
            <span>The address you ordered with. It only prefills the sign-in box.</span>
          </p>
        </div>

        <div className="field">
          <label htmlFor="track-reference">Order number</label>
          <input
            id="track-reference"
            name="reference"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="e.g. 1234"
            value={reference}
            onChange={(event) => setReference(event.currentTarget.value)}
            required
          />
        </div>

        <button className="button button--primary button--wide" type="submit" disabled={pending}>
          <Icon name="search" strokeWidth={2} />
          {pending ? 'Looking…' : 'Find order'}
        </button>

        <p className="t-small">
          Orders are only shown to the account that placed them, so you will be asked to sign in if
          you are not already. The order number is also a link in your confirmation email.
        </p>
      </div>
    </form>
  )
}
