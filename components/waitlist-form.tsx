'use client'

import { useActionState, useState, type FormEvent } from 'react'
import { joinUnlockWaitlistAction, type FormState } from '@/lib/actions'
import { groupImei, IMEI_LENGTH, luhnValid, normalizeImei } from '@/lib/imei'
import { Icon } from './icons'
import type { QuoteCarrier } from './imei-form'

const EMPTY: FormState = {}

/**
 * What the unlock page offers while ordering is closed.
 *
 * The IMEI is optional on purpose. An address alone is enough to be told
 * when the service opens, and asking for fifteen digits before we will
 * even take a note of someone is the sort of gate that loses them. When
 * they do give it, only a fingerprint and a masked copy are stored.
 */
export function WaitlistForm({
  carriers,
  defaultEmail = '',
  defaultImei = '',
  defaultCarrierId,
}: {
  carriers: QuoteCarrier[]
  defaultEmail?: string
  defaultImei?: string
  defaultCarrierId?: number
}) {
  const [state, action, pending] = useActionState(joinUnlockWaitlistAction, EMPTY)
  const [imei, setImei] = useState(groupImei(normalizeImei(defaultImei)))
  const [imeiError, setImeiError] = useState<string | null>(null)

  const digits = normalizeImei(imei)
  const done = Boolean(state.message)

  function handleImei(event: FormEvent<HTMLInputElement>) {
    const next = groupImei(normalizeImei(event.currentTarget.value))
    setImei(next)
    setImeiError(null)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (digits.length > 0 && (digits.length !== IMEI_LENGTH || !luhnValid(digits))) {
      event.preventDefault()
      setImeiError('That IMEI does not look right. Check the final digit, or leave it blank.')
    }
  }

  if (done) {
    return (
      <div className="panel">
        <div className="panel-body stack" style={{ gap: 12 }}>
          <p className="alert alert--success" role="status">
            <Icon name="checkSmall" strokeWidth={2.2} />
            <span>{state.message}</span>
          </p>
          <p className="t-small">
            In the meantime a phone check tells you the carrier, the lock status and whether the
            device is clean — those run today.
          </p>
          <a className="button button--secondary" href="/services/imei-check">
            See phone checks
            <Icon name="arrowRight" strokeWidth={2.2} />
          </a>
        </div>
      </div>
    )
  }

  return (
    <form className="panel" action={action} onSubmit={handleSubmit} noValidate>
      <header>
        <h2>Get told when unlocking opens</h2>
        <span>One email, on the day</span>
      </header>

      <div className="panel-body stack" style={{ gap: 18 }}>
        {state.error ? (
          <p className="alert alert--error" role="alert">
            <Icon name="info" strokeWidth={1.9} />
            <span>{state.error}</span>
          </p>
        ) : null}

        <input type="hidden" name="imei" value={digits} />

        <div className="field">
          <label htmlFor="waitlist-email">Email</label>
          <input
            id="waitlist-email"
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={defaultEmail}
            placeholder="you@example.com"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="waitlist-carrier">Network the phone is locked to (optional)</label>
          <select id="waitlist-carrier" name="carrierId" defaultValue={defaultCarrierId ?? ''}>
            <option value="">I am not sure yet</option>
            {carriers.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name} · {carrier.country}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="waitlist-imei">IMEI (optional)</label>
          <input
            id="waitlist-imei"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="35 490912 345678 9"
            value={imei}
            onChange={handleImei}
          />
          <p className="field-note" data-state={imeiError ? 'invalid' : 'idle'} aria-live="polite">
            <Icon name={imeiError ? 'cross' : 'info'} strokeWidth={imeiError ? 2.2 : 1.9} />
            <span>
              {imeiError ??
                'Give it and we can tell you whether your exact network is in the first batch. We store a masked copy only.'}
            </span>
          </p>
        </div>

        <button className="button button--primary button--wide" type="submit" disabled={pending}>
          {pending ? 'Adding you…' : 'Notify me when this opens'}
          <Icon name="arrowRight" strokeWidth={2.2} />
        </button>
      </div>
    </form>
  )
}
