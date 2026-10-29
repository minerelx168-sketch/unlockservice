'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/lib/actions'
import { findOrderAction } from '@/lib/track-actions'
import { Icon } from './icons'

const EMPTY: FormState = {}

/**
 * The order reference is controlled so validation errors do not empty it.
 * Identity is established at sign-in, never carried in a continuation URL.
 */
export function TrackOrderForm({ defaultEmail = '' }: { defaultEmail?: string }) {
  const [state, action, pending] = useActionState(findOrderAction, EMPTY)
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

        {defaultEmail ? <p className="t-small">Signed in as {defaultEmail}</p> : null}

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
          Only the account that placed an order can see it, so you may be asked to sign in.
        </p>
      </div>
    </form>
  )
}
