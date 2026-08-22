'use client'

import { useRef, useState, type FormEvent } from 'react'
import { groupImei, IMEI_LENGTH, luhnValid, normalizeImei } from '@/lib/imei'
import { Icon, type IconName } from './icons'

type NoteState = 'idle' | 'valid' | 'invalid'

type Note = { state: NoteState; icon: IconName; text: string }

const RESTING: Note = {
  state: 'idle',
  icon: 'info',
  text: 'Dial *#06# on the device to display its IMEI.',
}

/**
 * The identifier is checked in the browser: the Luhn digit rules out a
 * typo before anything is sent, so a mistyped number never becomes a
 * failed lookup.
 */
export function ImeiForm() {
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [note, setNote] = useState<Note>(RESTING)

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
      setNote({ state: 'idle', icon: 'info', text: `${digits.length} of ${IMEI_LENGTH} digits.` })
    } else if (luhnValid(digits)) {
      setNote({
        state: 'valid',
        icon: 'checkSmall',
        text: 'Checksum looks right — ready to look up.',
      })
    } else {
      setNote({
        state: 'invalid',
        icon: 'cross',
        text: 'Checksum does not match. Re-read the last digit.',
      })
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const digits = normalizeImei(value)

    if (digits.length !== IMEI_LENGTH || !luhnValid(digits)) {
      setNote({
        state: 'invalid',
        icon: 'cross',
        text: `Enter a full ${IMEI_LENGTH}-digit IMEI before continuing.`,
      })
      inputRef.current?.focus()
      return
    }

    setNote({
      state: 'valid',
      icon: 'checkSmall',
      text: 'Checksum accepted. Sign in to run this against a service.',
    })
  }

  return (
    <form className="field" onSubmit={handleSubmit} noValidate>
      <label htmlFor="imei">IMEI or serial number</label>
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
      <button className="button button--primary button--wide" type="submit">
        Check this device
      </button>
    </form>
  )
}
