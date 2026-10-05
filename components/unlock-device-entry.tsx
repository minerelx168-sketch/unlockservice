'use client'

import Link from 'next/link'
import { useActionState, useRef, useState, type FormEvent } from 'react'
import { showUnlockServicesAction } from '@/lib/device-intent-actions'
import { deviceImei } from '@/lib/device-intent-value'
import { IMEI_LENGTH } from '@/lib/imei'
import { formatUsd } from '@/lib/money'
import type { PublicProviderProduct } from '@/lib/public-provider-catalog'
import { serviceText, unlockCategory } from '@/lib/unlock-catalog-view'
import { Icon } from './icons'

/** This first step only opens the catalog; ordering still requires a separate review. */
export function UnlockDeviceEntry({ initialImei = '', previewProducts = [] }: {
  initialImei?: string
  previewProducts?: PublicProviderProduct[]
}) {
  const [imei, setImei] = useState(initialImei)
  const [touched, setTouched] = useState(false)
  const [hideActionError, setHideActionError] = useState(false)
  const [state, action, pending] = useActionState(showUnlockServicesAction, {})
  const inputRef = useRef<HTMLInputElement>(null)
  const validImei = deviceImei(imei) !== null
  const showInvalid = !validImei && (touched || imei.length >= IMEI_LENGTH)
  const actionError = hideActionError ? undefined : state.error

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setHideActionError(true)
    if (!validImei) {
      event.preventDefault()
      setTouched(true)
      inputRef.current?.focus()
      return
    }
    setHideActionError(false)
  }

  function clearImei() {
    setImei('')
    setTouched(false)
    setHideActionError(true)
    inputRef.current?.focus()
  }

  return (
    <section className="service-browser unlock-device-entry" aria-labelledby="unlock-entry-heading">
      <nav className="service-browser__tabs" aria-label="Unlock workspace">
        <span aria-current="page"><Icon name="lock" /> New order</span>
        <Link href="/user/reports"><Icon name="clock" /> Order history</Link>
      </nav>

      <header className="service-browser__header">
        <span className="service-browser__heading-icon"><Icon name="device" /></span>
        <div>
          <h2 id="unlock-entry-heading">Start with your IMEI</h2>
          <p>Enter your 15-digit IMEI to browse services. Check service requirements before ordering.</p>
        </div>
      </header>

      <div className="unlock-device-entry__body">
        <ol className="unlock-device-entry__steps" aria-label="Order steps">
          <li aria-current="step"><span aria-hidden="true">1</span> Enter IMEI</li>
          <li><span aria-hidden="true">2</span> Choose service</li>
          <li><span aria-hidden="true">3</span> Review order</li>
        </ol>

        <form id="unlock-entry-form" className="service-browser__form" action={action} onSubmit={handleSubmit} noValidate aria-busy={pending}>
          <div className="service-browser__field">
            <div className="service-browser__label-row">
              <label htmlFor="unlock-entry-imei">IMEI number</label>
              <span className={validImei ? 'service-browser__valid' : ''}>{validImei ? 'Ready' : `${imei.length} / ${IMEI_LENGTH}`}</span>
            </div>
            <div className="service-browser__imei" data-invalid={showInvalid || undefined}>
              <Icon name="device" />
              <input
                ref={inputRef}
                id="unlock-entry-imei"
                name="imei"
                type="text"
                inputMode="numeric"
                enterKeyHint="go"
                autoComplete="off"
                spellCheck={false}
                required
                value={imei}
                onChange={(event) => {
                  // Preserve unexpected characters so validation never silently changes an identifier.
                  setImei(event.currentTarget.value.replace(/[\s-]/g, ''))
                  setTouched(false)
                  setHideActionError(true)
                }}
                onBlur={() => { if (imei) setTouched(true) }}
                placeholder="Enter your 15-digit IMEI"
                disabled={pending}
                aria-invalid={showInvalid}
                aria-describedby={`unlock-entry-hint${actionError ? ' unlock-entry-error' : ''}`}
              />
              {imei ? <button type="button" aria-label="Clear IMEI" disabled={pending} onClick={clearImei}><Icon name="cross" /></button> : null}
            </div>
            <p id="unlock-entry-hint" className={showInvalid ? 'service-browser__error' : 'service-browser__hint'} role={showInvalid ? 'alert' : undefined}>
              {showInvalid
                ? imei ? 'Enter a valid 15-digit IMEI. Check the number in your phone settings.' : 'Enter your 15-digit IMEI to continue.'
                : 'Find it in your phone settings or dial *#06#.'}
            </p>
          </div>

          {actionError ? <p id="unlock-entry-error" className="service-browser__error" role="alert">{actionError}</p> : null}

          <div className="service-browser__actions">
            <button type="submit" className="button button--primary" disabled={pending} aria-describedby="unlock-entry-next">
              {pending ? <span className="unlock-device-entry__spinner" aria-hidden="true" /> : <Icon name="search" />}
              {pending ? 'Opening services…' : 'Show unlock services'}
              {!pending ? <Icon name="arrowRight" /> : null}
            </button>
            <p id="unlock-entry-next" className="service-browser__hint" role="status">
              {pending ? 'Opening the service list. Please wait.' : 'Compare prices next. Nothing is ordered or charged here.'}
            </p>
          </div>
        </form>
      </div>

      {previewProducts.length > 0 ? (
        <section className="unlock-service-preview" aria-labelledby="unlock-preview-heading" aria-busy={pending}>
          <header className="unlock-service-preview__heading">
            <div>
              <h3 id="unlock-preview-heading">Explore unlock services</h3>
              <p id="unlock-preview-hint">Enter your IMEI above to view details or browse all services.</p>
            </div>
            <span className="unlock-service-preview__currency">Prices in USD</span>
          </header>

          <div className="unlock-service-preview__grid">
            {previewProducts.map((product) => {
              const productName = serviceText(product.name)
              const available = product.status === 'available'
              return (
                <article className="unlock-service-preview__card" key={product.productCode} data-product-code={product.productCode}>
                  <div className="unlock-service-preview__card-top">
                    <span className="unlock-service-preview__icon" aria-hidden="true"><Icon name="unlockMark" /></span>
                    <span className="unlock-service-preview__category">{unlockCategory(product)}</span>
                  </div>
                  <h4>{productName}</h4>
                  <span className={`unlock-service-preview__availability${available ? ' is-available' : ''}`}>
                    {available ? 'Available online' : 'Temporarily unavailable'}
                  </span>
                  <div className="unlock-service-preview__card-bottom">
                    <strong className="unlock-service-preview__price">{formatUsd(product.priceCents)}</strong>
                    {/* Associated with the IMEI form so every entry point shares validation and its server action. */}
                    <button
                      type="submit"
                      form="unlock-entry-form"
                      name="productCode"
                      value={product.productCode}
                      className="button button--secondary"
                      disabled={pending}
                      aria-label={`View details for ${productName}`}
                      aria-describedby="unlock-preview-hint"
                    >
                      Details <Icon name="arrowRight" />
                    </button>
                  </div>
                </article>
              )
            })}
          </div>

          <div className="unlock-service-preview__more">
            <button type="submit" form="unlock-entry-form" className="button button--primary" disabled={pending} aria-describedby="unlock-preview-hint">
              {pending ? <span className="unlock-device-entry__spinner" aria-hidden="true" /> : <Icon name="grid" />}
              {pending ? 'Opening services…' : 'Show more'}
              {!pending ? <Icon name="arrowRight" /> : null}
            </button>
          </div>
        </section>
      ) : null}
    </section>
  )
}
