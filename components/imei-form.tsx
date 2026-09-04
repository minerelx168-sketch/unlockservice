'use client'

import { useActionState, useMemo, useRef, useState, type FormEvent } from 'react'
import { startUnlockQuoteAction, type FormState } from '@/lib/actions'
import { groupImei, IMEI_LENGTH, luhnValid, normalizeImei } from '@/lib/imei'
import { Icon, type IconName } from './icons'

type NoteState = 'idle' | 'valid' | 'invalid'
type Note = { state: NoteState; icon: IconName; text: string }

export type QuoteCarrier = { id: number; name: string; country: string }

const RESTING: Note = {
  state: 'idle',
  icon: 'info',
  text: 'Find your IMEI in Settings or dial *#06# on the phone.',
}

const EMPTY: FormState = {}

/**
 * The first step of the funnel: check the identifier in the browser, then
 * hand the whole quote to the server.
 *
 * The networks come from lib/catalog.ts — the same list the order form is
 * built from — because a hardcoded list here quoted networks the order form
 * did not offer, and offered none of the ones it did.
 *
 * It posts rather than navigating, so the IMEI never reaches the URL. The
 * server puts it in a short-lived cookie and the order form picks it up
 * after sign-in; the customer types it once.
 */
export function ImeiForm({
  carriers,
  ordering = true,
}: {
  carriers: QuoteCarrier[]
  /** False while unlock ordering is closed — the button then leads to the
      reports catalogue, so it must not promise an unlock. */
  ordering?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [note, setNote] = useState<Note>(RESTING)
  const [state, action, pending] = useActionState(startUnlockQuoteAction, EMPTY)

  const countries = useMemo(() => {
    const seen: string[] = []
    for (const carrier of carriers) if (!seen.includes(carrier.country)) seen.push(carrier.country)
    return seen
  }, [carriers])

  const [country, setCountry] = useState(countries[0] ?? '')
  const offered = useMemo(
    () => carriers.filter((carrier) => carrier.country === country),
    [carriers, country],
  )
  const [carrierId, setCarrierId] = useState<number>(offered[0]?.id ?? 0)
  const selected = offered.some((carrier) => carrier.id === carrierId) ? carrierId : (offered[0]?.id ?? 0)

  const digits = normalizeImei(value)

  function handleChange(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const caretAtEnd = input.selectionStart === input.value.length
    const next = normalizeImei(input.value)
    const grouped = groupImei(next)

    setValue(grouped)
    if (caretAtEnd) {
      requestAnimationFrame(() => input.setSelectionRange(grouped.length, grouped.length))
    }

    if (next.length === 0) {
      setNote(RESTING)
    } else if (next.length < IMEI_LENGTH) {
      setNote({ state: 'idle', icon: 'info', text: `${next.length} of ${IMEI_LENGTH} digits entered.` })
    } else if (luhnValid(next)) {
      setNote({
        state: 'valid',
        icon: 'checkSmall',
        text: 'IMEI looks valid. Continue to see price and turnaround.',
      })
    } else {
      setNote({ state: 'invalid', icon: 'cross', text: 'That IMEI does not look right. Check the final digit.' })
    }
  }

  function handleCountryChange(event: FormEvent<HTMLSelectElement>) {
    const next = event.currentTarget.value
    setCountry(next)
    setCarrierId(carriers.find((carrier) => carrier.country === next)?.id ?? 0)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!luhnValid(digits) || digits.length !== IMEI_LENGTH) {
      event.preventDefault()
      setNote({ state: 'invalid', icon: 'cross', text: `Enter a valid ${IMEI_LENGTH}-digit IMEI to continue.` })
      inputRef.current?.focus()
    }
  }

  const shown = state.error ? { state: 'invalid' as const, icon: 'cross' as IconName, text: state.error } : note

  return (
    <form className="unlock-quote" action={action} onSubmit={handleSubmit} noValidate>
      {/* The digits, ungrouped — the visible field carries the spacing. */}
      <input type="hidden" name="imei" value={digits} />
      <input type="hidden" name="carrierId" value={selected} />

      <div className="unlock-quote-grid">
        <div className="field">
          <label htmlFor="country">Country</label>
          <select id="country" value={country} onChange={handleCountryChange}>
            {countries.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="carrier">Original carrier</label>
          <select
            id="carrier"
            value={selected}
            onChange={(event) => setCarrierId(Number(event.currentTarget.value))}
          >
            {offered.map((carrier) => (
              <option key={carrier.id} value={carrier.id}>
                {carrier.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="imei">IMEI number</label>
        <input
          id="imei"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder="35 490912 345678 9"
          value={value}
          onChange={handleChange}
        />
        <p className="field-note" data-state={shown.state} aria-live="polite">
          <Icon name={shown.icon} strokeWidth={shown.state === 'idle' ? 1.9 : 2.2} />
          <span>{shown.text}</span>
        </p>
      </div>

      <button className="button button--primary button--wide unlock-submit" type="submit" disabled={pending}>
        {pending ? 'Checking…' : ordering ? 'Unlock Phone' : 'Check this phone'}
        <Icon name="arrowRight" strokeWidth={2.2} />
      </button>

      <p className="unlock-quote-note">
        {ordering
          ? 'Price and estimated delivery time are shown before you place the order.'
          : 'Unlock orders are not open yet. This takes you to the reports you can order today, with the IMEI already filled in.'}
      </p>
    </form>
  )
}
