'use client'

import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { groupImei, IMEI_LENGTH, luhnValid, normalizeImei } from '@/lib/imei'
import { Icon } from './icons'

type CheckPayload = {
  id: number
  maskedImei: string
  status: 'queued' | 'completed' | 'unavailable'
  provider: string
  result: Record<string, unknown> | null
  message?: string
  createdAt: string
}

const STATUS: Record<CheckPayload['status'], { kicker: string; badge: string; label: string }> = {
  completed: { kicker: 'Check complete', badge: 'badge--success', label: 'Complete' },
  queued: { kicker: 'Check queued', badge: 'badge--pending', label: 'Queued' },
  unavailable: { kicker: 'Check unavailable', badge: 'badge--error', label: 'Unavailable' },
}

export function ImeiCheckForm({ csrfToken }: { csrfToken: string }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [check, setCheck] = useState<CheckPayload | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function change(event: FormEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const digits = normalizeImei(input.value)
    const grouped = groupImei(digits)
    setValue(grouped)
    if (digits.length === IMEI_LENGTH && !luhnValid(digits)) setError('That IMEI checksum does not match.')
    else setError(null)
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const digits = normalizeImei(value)
    if (digits.length !== IMEI_LENGTH || !luhnValid(digits)) {
      setError(`Enter a valid ${IMEI_LENGTH}-digit IMEI.`)
      inputRef.current?.focus()
      return
    }

    setBusy(true)
    setError(null)
    setCheck(null)
    try {
      const response = await fetch('/api/imei/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: JSON.stringify({ imei: digits, csrfToken }),
      })
      const data = (await response.json()) as { success?: boolean; check?: CheckPayload; error?: string }
      if (!response.ok || data.success === false || !data.check) throw new Error(data.error ?? 'The IMEI check could not be completed.')
      setCheck(data.check)
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'The IMEI check could not be completed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <form className="unlock-quote" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="check-imei">IMEI number</label>
          <input
            id="check-imei"
            ref={inputRef}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="35 490912 345678 9"
            value={value}
            onChange={change}
          />
          <p className="field-note" data-state={error ? 'invalid' : 'idle'} aria-live="polite">
            <Icon name={error ? 'cross' : 'info'} strokeWidth={error ? 2.2 : 1.9} />
            <span>{error ?? 'Find the IMEI in Settings or dial *#06# on the phone.'}</span>
          </p>
        </div>
        <button className="button button--primary button--wide unlock-submit" type="submit" disabled={busy}>
          <Icon name="search" strokeWidth={1.9} />
          {busy ? 'Checking…' : 'Check IMEI'}
        </button>
        <p className="unlock-quote-note">Free format and checksum check. Provider data will be added when an authorized source is connected.</p>
      </form>

      {check ? (
        <div className="card" style={{ marginTop: 18 }} role="status">
          <div className="card-topline">
            <span className="kicker">
              <Icon name={check.status === 'completed' ? 'check' : 'info'} />
              {STATUS[check.status].kicker}
            </span>
            {/* Follows the status. It was hardcoded to the success variant,
                so a check the provider could not complete came back in
                green saying "unavailable". */}
            <span className={`badge ${STATUS[check.status].badge}`}>{STATUS[check.status].label}</span>
          </div>
          <h3 className="t-card">IMEI {check.maskedImei}</h3>
          <p className="t-small">{String(check.result?.summary ?? check.message ?? 'The report is ready.')}</p>
          <Link className="link-arrow" href={`/user/checks/${check.id}`}>
            {check.status === 'completed' ? 'View full report' : 'Open this check'}{' '}
            <Icon name="arrowRight" strokeWidth={2.2} />
          </Link>
        </div>
      ) : null}
    </>
  )
}
