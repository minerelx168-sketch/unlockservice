'use client'

import { useActionState, useRef, useState, type FormEvent } from 'react'
import { browseDevicesAction } from '@/lib/device-intent-actions'
import { deviceImei, type DeviceDomain } from '@/lib/device-intent-value'
import { Icon } from './icons'

export function DeviceBrowseForm() {
  const [domain, setDomain] = useState<DeviceDomain>('imei_check')
  const [imei, setImei] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [state, action, pending] = useActionState(browseDevicesAction, {})
  const input = useRef<HTMLInputElement>(null)
  const digits = imei.replace(/[\s-]/g, '')

  function validate(event: FormEvent<HTMLFormElement>) {
    if (imei.trim() && !deviceImei(imei)) {
      event.preventDefault()
      setError('Enter a valid 15-digit IMEI, or clear it to browse without one.')
      input.current?.focus()
    }
  }

  return (
    <form className="device-browse" action={action} onSubmit={validate} aria-label="Find services for your device" aria-busy={pending}>
      <fieldset className="device-browse-options" disabled={pending}>
        <legend>What would you like to do?</legend>
        {(['imei_check', 'unlock'] as const).map((value) => (
          <label key={value}>
            <input type="radio" name="domain" value={value} checked={domain === value} onChange={() => setDomain(value)} />
            <span><Icon name={value === 'unlock' ? 'lock' : 'search'} />{value === 'unlock' ? 'Unlock' : 'Phone Check'}</span>
          </label>
        ))}
      </fieldset>
      <div className="field">
        <label htmlFor="browse-imei">IMEI number <span className="device-browse-optional">Optional</span></label>
        <div className="device-browse-input">
          <Icon name="device" />
          <input id="browse-imei" ref={input} name="imei" type="text" inputMode="numeric" autoComplete="off" spellCheck={false}
            placeholder="Enter 15-digit IMEI" value={imei} disabled={pending}
            aria-describedby="browse-imei-help" aria-invalid={!!error}
            onChange={(event) => { setImei(event.currentTarget.value); setError(null) }} />
          {imei ? <button type="button" aria-label="Clear IMEI" disabled={pending} onClick={() => { setImei(''); setError(null); input.current?.focus() }}><Icon name="cross" /></button> : null}
        </div>
        <p className="device-browse-help" id="browse-imei-help"><span>Find it in Settings or dial *#06#.</span><span>{digits.length} / 15</span></p>
      </div>
      {error || state.error ? <p className="alert alert--error" role="alert"><Icon name="info" /><span>{error || state.error}</span></p> : null}
      <button className="button button--primary button--wide" type="submit" disabled={pending}>
        {pending ? 'Opening services…' : 'Browse services'}<Icon name="arrowRight" />
      </button>
      <p className="device-browse-note"><Icon name="shield" />Compare prices first. Nothing is ordered or charged.</p>
      <p className="device-browse-note">Your IMEI is carried privately for 15 minutes. You can also browse without entering it.</p>
    </form>
  )
}
