'use client'

import Link from 'next/link'
import { ServiceDescription } from './service-description'
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import type { FormState } from '@/lib/actions'
import { continueDeviceServiceAction } from '@/lib/device-intent-actions'
import { identifierField, serviceIdentifier } from '@/lib/service-identifier'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { formatUsd } from '@/lib/money'
import type { PublicProviderProduct } from '@/lib/public-provider-catalog'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { Icon } from './icons'
import { ServicePicker, serviceDisplayText } from './service-picker'

const EMPTY: FormState = {}

/** Price-first browsing and preview never submits a provider request or deducts credit. */
export function ServiceBrowser({ products, domain, initialImei = '', initialProductCode = '', initialEmail = '' }: {
  products: PublicProviderProduct[]
  domain: 'imei_check' | 'unlock'
  initialImei?: string
  initialProductCode?: string
  initialEmail?: string
  imeiReadOnly?: boolean
  isAuthenticated?: boolean
  availableCents?: number
}) {
  const [imei, setImei] = useState(initialImei)
  const [email, setEmail] = useState(initialEmail)
  const [selectedCode, setSelectedCode] = useState(initialProductCode)
  const [fieldError, setFieldError] = useState<'imei' | 'email' | 'service' | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [state, action, pending] = useActionState(continueDeviceServiceAction, EMPTY)
  const inputRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const startedRef = useRef(false)
  const isUnlock = domain === 'unlock'
  const selected = products.find((product) => product.productCode === selectedCode)
  const orderDomain = selected?.domain ?? domain
  const available = selected?.status === 'available'
  const field = identifierField(selected?.inputType)
  const identifier = serviceIdentifier(imei, selected?.inputType)
  const validImei = identifier !== null
  const imeiInput = !selected || selected.inputType === 'imei'
  const canFindImei = imeiInput || selected?.inputType === 'serial_or_imei'
  const inputId = `${domain}-browse-imei`
  const cardQuote = selected && selected.priceCents > 0 ? guestCardQuote(selected.priceCents) : null
  const total = cardQuote?.totalCents ?? 0
  const lastQuote = useRef('')
  useEffect(() => {
    const key = selected ? `${orderDomain}:${selected.productCode}:${selected.priceCents}` : ''
    if (selected && selected.status === 'available' && key !== lastQuote.current) { lastQuote.current = key; trackFunnelEvent('service_quote_viewed', { service_category: orderDomain, currency: 'USD', value: selected.priceCents / 100 }) }
  }, [selected, orderDomain])
  const options = products.map((product) => ({ code: product.productCode, name: product.name, summary: product.summary, group: product.group, priceCents: product.priceCents>0 ? guestCardQuote(product.priceCents).totalCents : product.priceCents, priceAvailable: product.priceAvailable, etaLabel: product.etaLabel, available: product.status === 'available', hasExample: product.hasExample }))

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    setFieldError(null)
    if (!available) { event.preventDefault(); setFieldError('service'); return }
    if (!validImei) {
      event.preventDefault(); setFieldError('imei'); inputRef.current?.focus()
      trackFunnelEvent('validation_result', { service_category: orderDomain, validation_status: 'failed', status: 'imei' }); return
    }
    if (!email.trim() || !emailRef.current?.validity.valid) {
      event.preventDefault(); setFieldError('email'); emailRef.current?.focus()
      trackFunnelEvent('validation_result', { service_category: orderDomain, validation_status: 'failed', status: 'email' }); return
    }
    trackFunnelEvent('validation_result', { service_category: orderDomain, validation_status: 'passed' })
    trackFunnelEvent('guest_details_completed', { service_category: orderDomain })
    if (orderDomain === 'unlock') trackFunnelEvent('unlock_imei_submitted', { service_category: orderDomain })
    trackFunnelEvent('order_summary_requested', { service_category: orderDomain, currency: 'USD', value: total / 100 })
  }

  return <section className="service-browser" aria-labelledby={`${domain}-browse-heading`}>
    <nav className="service-browser__tabs" aria-label={`${isUnlock ? 'Unlock' : 'Phone check'} workspace`}><span aria-current="page"><Icon name={isUnlock ? 'lock' : 'search'} />New order</span><Link href="/track"><Icon name="clock" />Track an order</Link></nav>
    <header className="service-browser__header"><span className="service-browser__heading-icon"><Icon name={isUnlock ? 'lock' : 'device'} /></span><div><h2 id={`${domain}-browse-heading`}>{isUnlock ? 'Choose your unlock service' : 'Choose your phone report'}</h2><p>Compare prices first. Enter your details once, then choose how to pay.</p></div></header>
    <form className="service-browser__form" action={action} onSubmit={handleSubmit} noValidate aria-busy={pending}>
      <input type="hidden" name="paymentMethod" defaultValue="card" /><input type="hidden" name="domain" value={orderDomain} /><input type="hidden" name="productCode" value={selectedCode} />
      <ServicePicker options={options} value={selectedCode} onChange={(code) => {
        setSelectedCode(code); setFieldError(null); setHelpOpen(false)
        const selectedDomain = products.find((product) => product.productCode === code)?.domain ?? domain
        trackFunnelEvent('service_selection', { service_category: selectedDomain })
        if (selectedDomain === 'unlock') trackFunnelEvent('unlock_service_selected', { service_category: selectedDomain })
      }} disabled={pending} label={isUnlock ? 'Unlock service and card total' : 'Report and card total'} id={`${domain}-browse-service`} />
      {selected ? <div className="service-selected" aria-live="polite"><span className="service-selected-badge" aria-hidden="true"><Icon name={isUnlock ? 'lock' : 'file'} strokeWidth={1.7} /></span><div className="service-selected-copy"><h3>{serviceDisplayText(selected.name)}</h3><ServiceDescription value={selected.summary} /></div><div className="service-selected-price"><strong>{selected.priceAvailable === false ? 'Contact for price' : formatUsd(total)}</strong><span>{available ? 'Card total' : 'Currently unavailable'}</span><em>{serviceDisplayText(selected.etaLabel)}</em></div></div> : null}
      {selected && available ? <>
        <p className="price-check-total">Or pay {formatUsd(selected.priceCents)} with crypto · No service fee</p>
        <div className="service-browser__field"><div className="service-browser__label-row"><label htmlFor={inputId}>{field.label}</label>{canFindImei ? <button type="button" className="price-check-text-button" aria-expanded={helpOpen} aria-controls={`${inputId}-guide`} onClick={() => setHelpOpen(!helpOpen)}>Find my IMEI<Icon name="question" /></button> : null}</div>
          {helpOpen && canFindImei ? <p className="price-check-imei-guide" id={`${inputId}-guide`}>Dial <kbd>*#06#</kbd> on the phone, or open Settings → General → About. Paste the 15-digit IMEI here. Spaces and dashes are accepted.</p> : null}
          <div className="service-browser__imei" data-invalid={fieldError === 'imei' || undefined}><Icon name="device" /><input ref={inputRef} id={inputId} name="imei" type="text" inputMode={field.inputMode} maxLength={80} autoComplete="off" spellCheck={false} enterKeyHint="next" value={imei} onChange={(event) => { if (event.currentTarget.value && !startedRef.current) { startedRef.current = true; trackFunnelEvent('imei_input_started', { service_category: orderDomain }) } setImei(event.currentTarget.value); setFieldError(null) }} placeholder={field.placeholder} disabled={pending} aria-invalid={fieldError === 'imei'} aria-describedby={`${inputId}-hint`} />{imei ? <button type="button" aria-label={`Clear ${field.label}`} disabled={pending} onClick={() => { setImei(''); setFieldError(null); inputRef.current?.focus() }}><Icon name="cross" /></button> : null}</div>
          <p id={`${inputId}-hint`} className={fieldError === 'imei' ? 'service-browser__error' : 'service-browser__hint'} role={fieldError === 'imei' ? 'alert' : undefined}>{fieldError === 'imei' ? field.error : validImei ? `${field.label} format is valid. The service starts after payment.` : imeiInput ? `${imei.replace(/[\s-]/g, '').length} / 15 digits · Find it by dialing *#06#` : field.hint}</p>
        </div>
        <div className="field service-browser__field"><label htmlFor={`${domain}-browse-email`}>Email for your result</label><input ref={emailRef} id={`${domain}-browse-email`} name="email" type="email" inputMode="email" autoComplete="email" spellCheck={false} enterKeyHint="go" required maxLength={254} value={email} onChange={(event) => { setEmail(event.currentTarget.value); setFieldError(null) }} placeholder="you@example.com" disabled={pending} aria-invalid={fieldError === 'email'} aria-describedby={`${domain}-email-hint`} /><p id={`${domain}-email-hint`} className={fieldError === 'email' ? 'service-browser__error' : 'service-browser__hint'} role={fieldError === 'email' ? 'alert' : undefined}>{fieldError === 'email' ? 'Enter a valid email for your result and private order link.' : 'Your private order link and result. No password needed.'}</p></div>
      </> : null}
      {fieldError === 'service' ? <p className="service-browser__error" role="alert">Choose an available service to continue.</p> : null}
      {state.error ? <p className="service-browser__error" role="alert">{state.error}</p> : null}
      <div className="service-browser__actions"><button type="submit" className="button button--primary" disabled={pending || !available}>{pending ? 'Opening secure checkout…' : 'Review order'}<Icon name="arrowRight" /></button><p className="service-browser__hint">{!selected ? 'Choose a service to see its price and continue.' : !available ? 'This service is unavailable online. Choose another service.' : isUnlock ? 'Review your order before paying. Unlock processing starts after payment.' : 'Review your details and total. The real check starts after payment.'}</p><ul className="service-assurance" aria-label="Assurances"><li><Icon name="shieldCheck" />Clear total</li><li><Icon name="lock" />Private result link</li><li><Icon name="clock" />Live status</li></ul></div>
    </form>
  </section>
}

