'use client'

import Link from 'next/link'
import { useActionState, useRef, useState, type FormEvent } from 'react'
import type { FormState } from '@/lib/actions'
import { continueDeviceServiceAction } from '@/lib/device-intent-actions'
import { IMEI_LENGTH, luhnValid } from '@/lib/imei'
import { formatUsd } from '@/lib/money'
import type { PublicProviderProduct } from '@/lib/public-provider-catalog'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { Icon } from './icons'
import { ImeiSegments } from './imei-segments'
import { ServicePicker, serviceDisplayText } from './service-picker'

const EMPTY: FormState = {}

/** Browsing prepares an order for review; it never submits a provider request or deducts credit. */
export function ServiceBrowser({
  products,
  domain,
  initialImei = '',
  initialProductCode = '',
  imeiReadOnly = false,
  isAuthenticated = false,
  availableCents,
}: {
  products: PublicProviderProduct[]
  domain: 'imei_check' | 'unlock'
  initialImei?: string
  initialProductCode?: string
  imeiReadOnly?: boolean
  isAuthenticated?: boolean
  availableCents?: number
}) {
  const [imei, setImei] = useState(initialImei)
  const [selectedCode, setSelectedCode] = useState(initialProductCode)
  const [touched, setTouched] = useState(false)
  const [state, action, pending] = useActionState(continueDeviceServiceAction, EMPTY)
  const inputRef = useRef<HTMLInputElement>(null)
  const startedRef = useRef(false)
  const isUnlock = domain === 'unlock'
  const selected = products.find((product) => product.productCode === selectedCode)
  const available = selected?.status === 'available'
  /* The lowest sort order is the catalog's own first choice; the pill says
     so only when there is more than one thing to choose between. */
  const firstChoice = products.length > 1 ? products.reduce((best, product) => (product.sortOrder < best.sortOrder ? product : best), products[0]) : undefined
  const validImei = imei.length === IMEI_LENGTH && luhnValid(imei)
  const showInvalid = !validImei && (touched || imei.length >= IMEI_LENGTH)
  const inputId = `${domain}-browse-imei`
  const options = products.map((product) => ({
    code: product.productCode,
    name: product.name,
    summary: product.summary,
    group: product.group,
    priceCents: product.priceCents,
    etaLabel: product.etaLabel,
    available: product.status === 'available',
    hasExample: product.hasExample,
  }))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!validImei || !available) {
      event.preventDefault()
      setTouched(true)
      if (!validImei) inputRef.current?.focus()
      trackFunnelEvent('validation_result', { service_category: domain, validation_status: 'failed' })
      return
    }
    if (domain === 'unlock') {
      trackFunnelEvent('unlock_imei_submitted', { service_category: domain })
      trackFunnelEvent('begin_checkout', { service_category: domain, currency: 'USD', value: selected?.priceCents ? selected.priceCents / 100 : undefined })
    }
    trackFunnelEvent('review_login_intent', { service_category: domain, status: isAuthenticated ? 'review' : 'login' })
  }

  return (
    <section className="service-browser" aria-labelledby={`${domain}-browse-heading`}>
      <nav className="service-browser__tabs" aria-label={`${isUnlock ? 'Unlock' : 'Phone check'} workspace`}>
        <span aria-current="page"><Icon name={isUnlock ? 'lock' : 'search'} /> New order</span>
        <Link href="/user/reports"><Icon name="clock" /> Order history</Link>
      </nav>
      <header className="service-browser__header">
        <span className="service-browser__heading-icon"><Icon name={isUnlock ? 'lock' : 'device'} /></span>
        <div>
          <h2 id={`${domain}-browse-heading`}>{isUnlock ? 'Unlock your device' : 'Check your device'}</h2>
          <p>Choose a service, see the price and review before you order.</p>
        </div>
        <div className="service-browser__credit">
          {isAuthenticated && availableCents !== undefined ? <><span>Available credit</span><strong>{formatUsd(availableCents)}</strong></> : <><span>Browse first</span><strong>{isAuthenticated ? 'Review before paying' : 'No account needed'}</strong></>}
        </div>
      </header>

      <form className="service-browser__form" action={action} onSubmit={handleSubmit} noValidate aria-busy={pending}>
        <input type="hidden" name="domain" value={domain} />
        <input type="hidden" name="productCode" value={selectedCode} />
        <div className="service-browser__field">
          <div className="service-browser__label-row">
            <label htmlFor={inputId}><span className="step-no" aria-hidden="true">1</span>IMEI number</label>
            <span className={validImei ? 'service-browser__valid' : ''}>{validImei ? <><Icon name="checkSmall" strokeWidth={2.6} /> Valid</> : `${imei.length} / ${IMEI_LENGTH}`}</span>
          </div>
          <div className="service-browser__imei" data-invalid={showInvalid || undefined}>
            <Icon name="device" />
            <input
              ref={inputRef}
              id={inputId}
              name="imei"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              value={imei}
              onChange={(event) => { const next = event.currentTarget.value.replace(/[\s-]/g, ''); if (next && !startedRef.current) { startedRef.current = true; trackFunnelEvent('imei_input_started', { service_category: domain }) } setImei(next); setTouched(false) }}
              onBlur={() => { if (imei) setTouched(true) }}
              placeholder="Enter your 15-digit IMEI"
              disabled={pending}
              readOnly={imeiReadOnly}
              aria-invalid={showInvalid}
              aria-describedby={`${inputId}-hint`}
            />
            {imei && !imeiReadOnly ? <button type="button" aria-label="Clear IMEI" disabled={pending} onClick={() => { setImei(''); setTouched(false); inputRef.current?.focus() }}><Icon name="cross" /></button> : null}
          </div>
          <ImeiSegments count={imei.replace(/\D/g, '').length} valid={validImei} />
          <p id={`${inputId}-hint`} className={showInvalid ? 'service-browser__error' : 'service-browser__hint'} role={showInvalid ? 'alert' : undefined}>
            {showInvalid ? 'Enter a valid 15-digit IMEI. Check the number in your phone settings.' : imeiReadOnly ? <>Check each service’s device and network requirements before choosing. <Link href="/services/unlock" className="service-browser__change-imei">Change IMEI</Link></> : 'Find it in Settings or dial *#06#. You can browse services before entering it.'}
          </p>
        </div>

        <p className="service-browser__stepline"><span className="step-no" aria-hidden="true">2</span>{isUnlock ? 'Choose the unlock service' : 'Choose the report'}</p>
        <ServicePicker options={options} value={selectedCode} onChange={(code) => { setSelectedCode(code); trackFunnelEvent('service_selection', { service_category: domain }); if (domain === 'unlock') trackFunnelEvent('unlock_service_selected', { service_category: domain }) }} disabled={pending} label={isUnlock ? 'Unlock service' : 'Lookup service'} id={`${domain}-browse-service`} />

        {selected ? (
          <div className="service-selected" aria-live="polite">
            <span className="service-selected-badge" aria-hidden="true"><Icon name={isUnlock ? 'lock' : 'file'} strokeWidth={1.7} /></span>
            <div className="service-selected-copy">
              {selected === firstChoice ? <span className="service-selected-pill">Suggested</span> : null}
              <h3>{serviceDisplayText(selected.name)}</h3>
              <p>{serviceDisplayText(selected.summary)}</p>
            </div>
            <div className="service-selected-price">
              <strong>{formatUsd(selected.priceCents)}</strong>
              <span>{available ? 'One-time service payment' : 'Listed price · currently unavailable'}</span>
              <em>{serviceDisplayText(selected.etaLabel)}</em>
            </div>
          </div>
        ) : null}

        {state.error ? <p className="service-browser__error" role="alert">{state.error}</p> : null}

        <div className="service-browser__actions">
          <button type="submit" className="button button--primary" disabled={pending || !available} aria-describedby={`${domain}-browse-next`}>
            {pending ? 'Opening review…' : selected && available ? `Continue to review — ${formatUsd(selected.priceCents)}` : 'Continue to review'} <Icon name="arrowRight" />
          </button>
          <p id={`${domain}-browse-next`} className="service-browser__hint">
            {!selected ? 'Choose a service to see its price and continue.' : !available ? 'This service is unavailable online. Choose another service to continue.' : 'Review the total, enter your email and pay. No account needed for card checkout.'}
          </p>
          {selected && !available && isUnlock ? <Link className="service-browser__waitlist" href="/unlock-waitlist">Notify me when unlock ordering opens <Icon name="arrowRight" /></Link> : null}
          <ul className="service-assurance" aria-label="Assurances">
            <li><Icon name="shieldCheck" strokeWidth={2.2} />Clear order total</li>
            <li><Icon name="lock" strokeWidth={2.2} />Private result link</li>
            <li><Icon name="clock" strokeWidth={2.2} />Live status</li>
          </ul>
        </div>
      </form>
    </section>
  )
}
