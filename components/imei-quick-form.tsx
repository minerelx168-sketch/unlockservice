'use client'

import { useActionState, useRef, useState, type FormEvent } from 'react'
import { browseDevicesAction } from '@/lib/device-intent-actions'
import { deviceImei } from '@/lib/device-intent-value'
import { IMEI_LENGTH } from '@/lib/imei'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { Icon, type IconName } from './icons'

export type QuickPickOption = { code: string; short: string; kicker: string; icon: IconName }

type Props = {
  picks: QuickPickOption[]
  initialCode?: string
  /** Where "see all" points. */
  allHref: string
  allLabel: string
}

/**
 * The hero of the Phone Check landing: pick a report, type the IMEI, go.
 * Nothing is ordered here — the action stores the choice and lands the
 * visitor on the order form with both already filled in. The chips are
 * buttons, not links, so the IMEI typed next to them is kept.
 */
export function ImeiQuickForm({ picks, initialCode, allHref, allLabel }: Props) {
  const [code, setCode] = useState(picks.find((pick) => pick.code === initialCode)?.code ?? picks[0]?.code ?? '')
  const [imei, setImei] = useState('')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const started = useRef(false)
  const [state, action, pending] = useActionState(browseDevicesAction, {})
  const selected = picks.find((pick) => pick.code === code) ?? picks[0]
  const digits = imei.replace(/[\s-]/g, '')
  const valid = deviceImei(imei) !== null

  function validate(event: FormEvent<HTMLFormElement>) {
    trackFunnelEvent('validation_result', { service_category: 'imei_check', validation_status: valid ? 'passed' : 'failed' })
    if (valid) { trackFunnelEvent('service_selection', { service_category: 'imei_check' }); return }
    event.preventDefault()
    setError(`Enter the ${IMEI_LENGTH}-digit IMEI — dial *#06# on the phone to see it.`)
    input.current?.focus()
  }

  return (
    <form className="quick-form" action={action} onSubmit={validate} aria-label="Check a phone by IMEI" aria-busy={pending}>
      <input type="hidden" name="domain" value="imei_check" />
      {selected ? <input type="hidden" name="productCode" value={selected.code} /> : null}

      {picks.length ? (
        <div className="quick-picks">
          <div className="quick-picks-label">
            <span>Quick picks</span>
            <a href={allHref}>{allLabel}</a>
          </div>
          <div className="quick-pick-row" role="group" aria-label="Report to run">
            {picks.map((pick) => (
              <button
                key={pick.code}
                type="button"
                className="quick-pick"
                aria-pressed={pick.code === code}
                disabled={pending}
                onClick={() => { setCode(pick.code); setError(null); trackFunnelEvent('service_selection', { service_category: 'imei_check' }) }}
              >
                <span className="icon-tile icon-tile--sm" aria-hidden="true">
                  <Icon name={pick.icon} />
                </span>
                <span>
                  {pick.short}
                  <small>{pick.kicker}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="quick-form-row">
        <label className="visually-hidden" htmlFor="quick-imei">IMEI number</label>
        <div className="quick-form-input" data-valid={valid || undefined} data-invalid={error ? 'true' : undefined}>
          <Icon name="device" strokeWidth={1.9} />
          <input
            id="quick-imei"
            ref={input}
            name="imei"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            enterKeyHint="go"
            placeholder={`Enter the ${IMEI_LENGTH}-digit IMEI`}
            value={imei}
            disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby="quick-imei-help"
            onChange={(event) => { if (event.currentTarget.value && !started.current) { started.current = true; trackFunnelEvent('imei_input_started', { service_category: 'imei_check' }) } setImei(event.currentTarget.value); setError(null) }}
          />
          <span className="quick-form-count" aria-hidden="true">
            {valid ? <Icon name="checkSmall" strokeWidth={2.6} /> : `${Math.min(digits.length, IMEI_LENGTH)}/${IMEI_LENGTH}`}
          </span>
        </div>
        <button className="button button--primary" type="submit" disabled={pending || !selected}>
          {pending ? 'Opening…' : `Check ${selected ? selected.short.toLowerCase() : 'the phone'}`}
          <Icon name="arrowRight" strokeWidth={2} />
        </button>
      </div>

      {error || state.error ? (
        <p className="alert alert--error" role="alert"><Icon name="info" /><span>{error || state.error}</span></p>
      ) : null}

      <p className="quick-form-help" id="quick-imei-help">
        Device coverage depends on the selected report. Dial <kbd>*#06#</kbd> on the phone to see its IMEI.
        <a href="/support#faq"><Icon name="question" strokeWidth={2} />How to find my IMEI</a>
      </p>
    </form>
  )
}
