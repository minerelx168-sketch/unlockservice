'use client'

import Link from 'next/link'
import { useActionState, useRef, useState, type FormEvent } from 'react'
import type { FormState } from '@/lib/actions'
import { continueDeviceServiceAction } from '@/lib/device-intent-actions'
import { IMEI_LENGTH, luhnValid } from '@/lib/imei'
import { formatUsd } from '@/lib/money'
import type { PublicProviderProduct } from '@/lib/public-provider-catalog'
import { Icon } from './icons'
import { ServicePicker, serviceDisplayText } from './service-picker'

const EMPTY: FormState = {}

/** Browsing prepares an order for review; it never submits a provider request or deducts credit. */
export function ServiceBrowser({
  products,
  domain,
  initialImei = '',
  initialProductCode = '',
  isAuthenticated = false,
  availableCents,
}: {
  products: PublicProviderProduct[]
  domain: 'imei_check' | 'unlock'
  initialImei?: string
  initialProductCode?: string
  isAuthenticated?: boolean
  availableCents?: number
}) {
  const [imei, setImei] = useState(initialImei)
  const [selectedCode, setSelectedCode] = useState(initialProductCode)
  const [touched, setTouched] = useState(false)
  const [state, action, pending] = useActionState(continueDeviceServiceAction, EMPTY)
  const inputRef = useRef<HTMLInputElement>(null)
  const isUnlock = domain === 'unlock'
  const selected = products.find((product) => product.productCode === selectedCode)
  const available = selected?.status === 'available'
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
  }))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!validImei || !available) {
      event.preventDefault()
      setTouched(true)
      if (!validImei) inputRef.current?.focus()
    }
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
            <label htmlFor={inputId}>IMEI number</label>
            <span className={validImei ? 'service-browser__valid' : ''}>{validImei ? 'Ready' : `${imei.length} / ${IMEI_LENGTH}`}</span>
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
              onChange={(event) => { setImei(event.currentTarget.value.replace(/[\s-]/g, '')); setTouched(false) }}
              onBlur={() => { if (imei) setTouched(true) }}
              placeholder="Enter your 15-digit IMEI"
              disabled={pending}
              aria-invalid={showInvalid}
              aria-describedby={`${inputId}-hint`}
            />
            {imei ? <button type="button" aria-label="Clear IMEI" disabled={pending} onClick={() => { setImei(''); setTouched(false); inputRef.current?.focus() }}><Icon name="cross" /></button> : null}
          </div>
          <p id={`${inputId}-hint`} className={showInvalid ? 'service-browser__error' : 'service-browser__hint'} role={showInvalid ? 'alert' : undefined}>
            {showInvalid ? 'Enter a valid 15-digit IMEI. Check the number in your phone settings.' : 'Find it in Settings or dial *#06#. You can browse services before entering it.'}
          </p>
        </div>

        <ServicePicker options={options} value={selectedCode} onChange={setSelectedCode} disabled={pending} label={isUnlock ? 'Unlock service' : 'Lookup service'} id={`${domain}-browse-service`} />

        {selected ? (
          <div className="service-browser__summary" aria-live="polite">
            <div><span>{available ? 'Service price' : 'Listed price · currently unavailable'}</span><strong>{formatUsd(selected.priceCents)} <small>USD</small></strong></div>
            <div><span>Estimated delivery</span><strong>{serviceDisplayText(selected.etaLabel)}</strong></div>
            <p>{serviceDisplayText(selected.summary)}</p>
          </div>
        ) : null}

        {state.error ? <p className="service-browser__error" role="alert">{state.error}</p> : null}

        <div className="service-browser__actions">
          <button type="submit" className="button button--primary" disabled={pending || !available} aria-describedby={`${domain}-browse-next`}>
            {pending ? 'Opening review…' : 'Continue to review'} <Icon name="arrowRight" />
          </button>
          <p id={`${domain}-browse-next`} className="service-browser__hint">
            {!selected ? 'Choose a service to see its price and continue.' : !available ? 'This service is unavailable online. Choose another service to continue.' : isAuthenticated ? 'No credit is charged until you confirm on the next page.' : 'Sign in next to review your order. Nothing is charged here.'}
          </p>
          {selected && !available && isUnlock ? <Link className="service-browser__waitlist" href="/unlock-waitlist">Notify me when unlock ordering opens <Icon name="arrowRight" /></Link> : null}
        </div>
      </form>
    </section>
  )
}
