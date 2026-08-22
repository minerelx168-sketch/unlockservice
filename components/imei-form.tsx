'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, type FormEvent } from 'react'
import { groupImei, IMEI_LENGTH, luhnValid, normalizeImei } from '@/lib/imei'
import { Icon, type IconName } from './icons'

type NoteState = 'idle' | 'valid' | 'invalid'
type Note = { state: NoteState; icon: IconName; text: string }

type Market = {
  country: string
  carriers: string[]
}

const MARKETS: Market[] = [
  {
    country: 'United States',
    carriers: ['AT&T', 'T-Mobile', 'Verizon', 'Cricket Wireless', 'Metro by T-Mobile'],
  },
  {
    country: 'United Kingdom',
    carriers: ['EE', 'O2', 'Three', 'Vodafone UK'],
  },
  {
    country: 'Canada',
    carriers: ['Bell', 'Rogers', 'Telus', 'Freedom Mobile'],
  },
  {
    country: 'Australia',
    carriers: ['Optus', 'Telstra', 'Vodafone Australia'],
  },
]

const RESTING: Note = {
  state: 'idle',
  icon: 'info',
  text: 'Find your IMEI in Settings or dial *#06# on the phone.',
}

/**
 * The identifier is checked in the browser before the customer is taken into
 * the authenticated order flow. Country and carrier are intentionally part of
 * the first step so the landing-page promise matches the order experience.
 */
export function ImeiForm() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [marketIndex, setMarketIndex] = useState(0)
  const [carrier, setCarrier] = useState(MARKETS[0].carriers[0])
  const [note, setNote] = useState<Note>(RESTING)

  const market = MARKETS[marketIndex]

  function handleChange(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const caretAtEnd = input.selectionStart === input.value.length
    const digits = normalizeImei(input.value)
    const grouped = groupImei(digits)

    setValue(grouped)
    if (caretAtEnd) {
      requestAnimationFrame(() => {
        input.setSelectionRange(grouped.length, grouped.length)
      })
    }

    if (digits.length === 0) {
      setNote(RESTING)
    } else if (digits.length < IMEI_LENGTH) {
      setNote({ state: 'idle', icon: 'info', text: `${digits.length} of ${IMEI_LENGTH} digits entered.` })
    } else if (luhnValid(digits)) {
      setNote({
        state: 'valid',
        icon: 'checkSmall',
        text: 'IMEI looks valid. Continue to see price and turnaround.',
      })
    } else {
      setNote({
        state: 'invalid',
        icon: 'cross',
        text: 'That IMEI does not look right. Check the final digit.',
      })
    }
  }

  function handleMarketChange(event: FormEvent<HTMLSelectElement>) {
    const nextIndex = Number(event.currentTarget.value)
    setMarketIndex(nextIndex)
    setCarrier(MARKETS[nextIndex].carriers[0])
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const digits = normalizeImei(value)

    if (digits.length !== IMEI_LENGTH || !luhnValid(digits)) {
      setNote({
        state: 'invalid',
        icon: 'cross',
        text: `Enter a valid ${IMEI_LENGTH}-digit IMEI to continue.`,
      })
      inputRef.current?.focus()
      return
    }

    const query = new URLSearchParams({
      imei: digits,
      country: market.country,
      carrier,
    })
    router.push(`/register?${query.toString()}`)
  }

  return (
    <form className="unlock-quote" onSubmit={handleSubmit} noValidate>
      <div className="unlock-quote-grid">
        <div className="field">
          <label htmlFor="country">Country</label>
          <select id="country" value={marketIndex} onChange={handleMarketChange}>
            {MARKETS.map((entry, index) => (
              <option key={entry.country} value={index}>
                {entry.country}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="carrier">Original carrier</label>
          <select id="carrier" value={carrier} onChange={(event) => setCarrier(event.currentTarget.value)}>
            {market.carriers.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="field">
        <label htmlFor="imei">IMEI number</label>
        <input
          id="imei"
          name="imei"
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          spellCheck={false}
          placeholder="35 490912 345678 9"
          value={value}
          onChange={handleChange}
        />
        <p className="field-note" data-state={note.state} aria-live="polite">
          <Icon name={note.icon} strokeWidth={note.state === 'idle' ? 1.9 : 2.2} />
          <span>{note.text}</span>
        </p>
      </div>

      <button className="button button--primary button--wide unlock-submit" type="submit">
        Unlock Phone
        <Icon name="arrowRight" strokeWidth={2.2} />
      </button>

      <p className="unlock-quote-note">
        Price and estimated delivery time are shown before you place the order.
      </p>
    </form>
  )
}
