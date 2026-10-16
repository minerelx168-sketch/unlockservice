'use client'

import { useActionState, useMemo, useRef, useState, type FormEvent } from 'react'
import { browseDevicesAction, showUnlockServicesAction } from '@/lib/device-intent-actions'
import { deviceImei } from '@/lib/device-intent-value'
import { formatUsd } from '@/lib/money'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { Icon } from './icons'

/** Serialized on the server — no provider identifiers, public fields only. */
export type PriceCheckProduct = {
  code: string
  name: string
  category: string
  priceCents: number
  etaLabel: string
}

type Props = {
  unlock: PriceCheckProduct[]
  check: PriceCheckProduct[]
  ordering: boolean
}

const PREFERRED_CATEGORY_ORDER = ['United States', 'Canada', 'United Kingdom', 'Austria', 'Japan', 'Romania', 'EMEA']

function orderedCategories(products: PriceCheckProduct[]): string[] {
  const seen = [...new Set(products.map((product) => product.category))]
  return seen.sort((a, b) => {
    const ia = PREFERRED_CATEGORY_ORDER.indexOf(a)
    const ib = PREFERRED_CATEGORY_ORDER.indexOf(b)
    if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
    return a.localeCompare(b, 'en')
  })
}

/**
 * The UnlockRiver pattern, honestly implemented: price and turnaround are
 * quoted from the live catalog the moment a service is chosen — before the
 * IMEI, before an account, before any charge. Submitting only carries the
 * selection to the catalog / report flow; nothing is ordered from here.
 */
export function HeroPriceCheck({ unlock, check, ordering }: Props) {
  const [domain, setDomain] = useState<'unlock' | 'imei_check'>(ordering && unlock.length ? 'unlock' : 'imei_check')
  const products = domain === 'unlock' ? unlock : check
  const categories = useMemo(() => orderedCategories(products), [products])

  const [category, setCategory] = useState<Record<string, string>>({})
  const [service, setService] = useState<Record<string, string>>({})
  const [imei, setImei] = useState('')
  const [error, setError] = useState<string | null>(null)
  const input = useRef<HTMLInputElement>(null)
  const started = useRef(false)

  const activeCategory = category[domain] ?? categories[0] ?? ''
  const inCategory = products.filter((product) => product.category === activeCategory)
  const selected = inCategory.find((product) => product.code === service[domain]) ?? inCategory[0]

  const unlockReady = ordering && domain === 'unlock' && unlock.length > 0
  const [state, action, pending] = useActionState(unlockReady ? showUnlockServicesAction : browseDevicesAction, {})

  const digits = imei.replace(/[\s-]/g, '')
  /* An IMEI is only demanded when it is about to be used: opening the
     unlock catalog for a device. Browsing never needs one. */
  const imeiRequired = unlockReady

  function validate(event: FormEvent<HTMLFormElement>) {
    if ((imeiRequired || imei.trim()) && !deviceImei(imei)) {
      event.preventDefault()
      setError(imeiRequired ? 'Enter a valid 15-digit IMEI to see unlock services for your phone.' : 'Enter a valid 15-digit IMEI, or clear it to browse without one.')
      input.current?.focus()
      trackFunnelEvent('validation_result', { service_category: domain, validation_status: 'failed' })
      return
    }
    if (imei.trim()) trackFunnelEvent('validation_result', { service_category: domain, validation_status: 'passed' })
    if (unlockReady) trackFunnelEvent('unlock_imei_submitted', { service_category: domain })
    if (selected) trackFunnelEvent('service_selection', { service_category: domain })
  }

  return (
    <form className="price-check" action={action} onSubmit={validate} aria-label="Check price and unlock time" aria-busy={pending}>
      <div className="price-check-head">
        <h2 className="price-check-title">Your price and turnaround, up front</h2>
        <p className="price-check-sub">
          Pick the service. The price and the typical wait show before you enter an IMEI or pay anything.
        </p>
      </div>

      <fieldset className="device-browse-options" disabled={pending}>
        <legend className="visually-hidden">What would you like to do?</legend>
        {(['unlock', 'imei_check'] as const).map((value) => (
          <label key={value}>
            <input
              type="radio"
              name="domain"
              value={value}
              checked={domain === value}
              onChange={() => { setDomain(value); setError(null) }}
            />
            <span><Icon name={value === 'unlock' ? 'lock' : 'search'} />{value === 'unlock' ? 'Unlock Phone' : 'Phone Check'}</span>
          </label>
        ))}
      </fieldset>

      {products.length ? (
        <>
          <div className="field">
            <label htmlFor="pc-category">
              {domain === 'unlock' ? 'Network country or brand' : 'Report category'}
              <span className="price-check-start" aria-hidden="true">Start here</span>
            </label>
            <select
              id="pc-category"
              value={activeCategory}
              disabled={pending}
              onChange={(event) => {
                setCategory({ ...category, [domain]: event.currentTarget.value })
                setService({ ...service, [domain]: '' })
                setError(null)
              }}
            >
              {categories.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {domain === 'unlock' ? <p className="field-note">The country of the carrier your phone is locked to.</p> : null}
          </div>

          <div className="field">
            <label htmlFor="pc-service">{domain === 'unlock' ? 'Carrier / service' : 'Report'}</label>
            <select
              id="pc-service"
              value={selected?.code ?? ''}
              disabled={pending}
              onChange={(event) => { setService({ ...service, [domain]: event.currentTarget.value }); setError(null); trackFunnelEvent('service_selection', { service_category: domain }); if (domain === 'unlock') trackFunnelEvent('unlock_service_selected', { service_category: domain }) }}
            >
              {inCategory.map((product) => (
                <option key={product.code} value={product.code}>{product.name}</option>
              ))}
            </select>
          </div>

          <dl className="price-check-quote" aria-live="polite">
            <div>
              <dt>Service price</dt>
              <dd>{selected ? formatUsd(selected.priceCents) : '—'}</dd>
            </div>
            <div>
              <dt>Estimated delivery</dt>
              <dd>{selected ? selected.etaLabel : '—'}</dd>
            </div>
          </dl>
        </>
      ) : (
        <p className="alert" role="status">
          <Icon name="info" strokeWidth={1.9} />
          <span><b>Nothing listed for this right now.</b> Browse the catalog to see what is available today.</span>
        </p>
      )}

      <div className="field">
        <label htmlFor="pc-imei">
          IMEI number {imeiRequired ? null : <span className="device-browse-optional">Optional</span>}
        </label>
        <div className="device-browse-input">
          <Icon name="device" />
          <input
            id="pc-imei"
            ref={input}
            name="imei"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            placeholder="Enter 15-digit IMEI"
            value={imei}
            disabled={pending}
            aria-describedby="pc-imei-help"
            aria-invalid={!!error}
            onChange={(event) => { if (event.currentTarget.value && !started.current) { started.current = true; trackFunnelEvent('imei_input_started', { service_category: domain }) } setImei(event.currentTarget.value); setError(null) }}
          />
          {imei ? (
            <button type="button" aria-label="Clear IMEI" disabled={pending} onClick={() => { setImei(''); setError(null); input.current?.focus() }}>
              <Icon name="cross" />
            </button>
          ) : null}
        </div>
        <p className="device-browse-help" id="pc-imei-help">
          <span>Find it by dialing *#06#</span>
          <span>{digits.length} / 15</span>
        </p>
      </div>

      {selected ? <input type="hidden" name="productCode" value={selected.code} /> : null}

      {error || state.error ? (
        <p className="alert alert--error" role="alert"><Icon name="info" /><span>{error || state.error}</span></p>
      ) : null}

      <button className="button button--primary button--wide" type="submit" disabled={pending}>
        <Icon name={domain === 'unlock' ? 'lock' : 'search'} strokeWidth={1.9} />
        {pending
          ? 'Opening…'
          : domain === 'unlock'
            ? (unlockReady ? 'Continue with this unlock' : 'Browse unlock services')
            : 'Continue to phone reports'}
      </button>

      <p className="price-check-assurance">
        <span><Icon name="shieldCheck" />Reserved credit returned if refused</span>
        <span><Icon name="clock" />Live order tracking</span>
      </p>
    </form>
  )
}
