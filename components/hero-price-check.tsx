'use client'
import {usePathname} from 'next/navigation'
import {localeOf} from '@/lib/i18n/route-map'
import {useIdentifierCopy,useCopy} from '@/lib/i18n/client'

import Link from 'next/link'
import { ServiceDescription } from '@/components/service-description'
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { continueDeviceServiceAction } from '@/lib/device-intent-actions'
import { serviceIdentifier, identifierField, type ServiceInputType } from '@/lib/service-identifier'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { formatUsd } from '@/lib/money'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { Icon } from './icons'
import { ServicePicker } from './service-picker'

/** Public catalog fields only; prices are checked again by the order flow. */
export type PriceCheckProduct = {
  code: string
  inputType: ServiceInputType
  domain: 'unlock' | 'imei_check'
  name: string
  category: string
  priceCents: number
  priceAvailable?: boolean
  etaLabel: string
  summary?: string
  available: boolean
  hasExample?: boolean
}

type Domain = 'unlock' | 'imei_check'
type Props = {
  unlock: PriceCheckProduct[]
  check: PriceCheckProduct[]
  ordering: boolean
  homeUnlockMenu?: boolean
  fixedDomain?: Domain
  initialImei?: string
  initialProductCode?: string
  initialEmail?: string
}
type FieldError = { field: 'service' | 'imei' | 'email'; message: string }
/** Select a service, add details once, then review before secure payment. */
export function HeroPriceCheck({ unlock, check, ordering, homeUnlockMenu = false, fixedDomain, initialImei = '', initialProductCode, initialEmail = '' }: Props) {
  const t=useCopy(),pageLocale=localeOf(usePathname())
  const initialDomain = fixedDomain ?? (ordering && unlock.length ? 'unlock' : 'imei_check')
  const initialProduct = (initialDomain === 'unlock' ? unlock : check).find((product) => product.code === initialProductCode)
  const [domain, setDomain] = useState<Domain>(initialDomain)
  const [service, setService] = useState<Record<string, string>>({ [initialDomain]: initialProduct?.code ?? '' })
  const [imei, setImei] = useState(initialImei)
  const [email, setEmail] = useState(initialEmail)
  const [helpOpen, setHelpOpen] = useState(false)
  const [error, setError] = useState<FieldError | null>(null)
  const [showActionError, setShowActionError] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const serviceInput = useRef<HTMLButtonElement>(null)
  const started = useRef<Record<string, boolean>>({})
  const products = domain === 'unlock' ? unlock : check
  const selected = products.find((product) => product.code === service[domain])
  const orderDomain = selected?.domain ?? domain
  const [state, action, pending] = useActionState(continueDeviceServiceAction, {})
  const inputType = selected?.inputType ?? 'imei'
  const field = useIdentifierCopy(inputType)
  const digits = serviceIdentifier(imei, inputType) ?? imei.trim()
  const validImei = serviceIdentifier(imei, inputType) !== null
  const cardQuote = selected && selected.priceCents > 0 ? guestCardQuote(selected.priceCents) : null
  const total = cardQuote?.totalCents ?? 0
  const actionError = showActionError ? state.error : undefined
  const step = selected ? 1 : 0
  const lastQuote = useRef('')
  useEffect(() => {
    const key = selected ? `${orderDomain}:${selected.code}:${selected.priceCents}` : ''
    if (selected && selected.available && key !== lastQuote.current) { lastQuote.current = key; trackFunnelEvent('service_quote_viewed', { service_category: orderDomain, currency: 'USD', value: selected.priceCents / 100 }) }
  }, [selected, orderDomain])

  function clearError() { setError(null); setShowActionError(false) }
  function chooseService() {
    serviceInput.current?.focus()
    if (serviceInput.current?.getAttribute('aria-expanded') !== 'true') serviceInput.current?.click()
  }
  function validate(event: FormEvent<HTMLFormElement>) {
    setError(null)
    if (!selected) {
      event.preventDefault(); chooseService(); return
    }
    if (!selected.available) {
      event.preventDefault(); setError({ field: 'service', message: t("Choose a service") }); serviceInput.current?.focus(); return
    }
    if (!validImei) {
      event.preventDefault(); setError({ field: 'imei', message: field.error }); input.current?.focus()
      trackFunnelEvent('validation_result', { service_category: orderDomain, validation_status: 'failed', status: 'imei' }); return
    }
    if (!email.trim() || !emailInput.current?.validity.valid) {
      event.preventDefault(); setError({ field: 'email', message: t("Enter a valid email address for your result.") }); emailInput.current?.focus()
      trackFunnelEvent('validation_result', { service_category: orderDomain, validation_status: 'failed', status: 'email' }); return
    }
    setShowActionError(true)
    trackFunnelEvent('validation_result', { service_category: orderDomain, validation_status: 'passed' })
    trackFunnelEvent('guest_details_completed', { service_category: orderDomain })
    if (orderDomain === 'unlock') trackFunnelEvent('unlock_imei_submitted', { service_category: orderDomain })
    trackFunnelEvent('order_summary_requested', { service_category: orderDomain, currency: 'USD', value: total / 100 })
  }

  return <form className="price-check" action={action} onSubmit={validate} noValidate aria-label={domain === 'unlock' ? t("Choose your unlock service") : t("Choose your phone report")} aria-busy={pending}>
    <input type="hidden" name="locale" value={pageLocale}/><input type="hidden" name="paymentMethod" defaultValue="card" />
    <div className="price-check-head"><h2 className="price-check-title" id="price-check-heading">{domain === 'unlock' ? t("Choose your unlock service") : t("Choose your phone report")}</h2><p className="price-check-sub">{t("Choose a service to see its price and delivery time.")}</p></div>
    <input type="hidden" name="domain" value={orderDomain} />
    {fixedDomain ? null : <fieldset className="device-browse-options" disabled={pending}><legend className="visually-hidden">{t("What would you like to do?")}</legend>{(['unlock', 'imei_check'] as const).map((value) => <label key={value}><input type="radio" name="browseDomain" value={value} checked={domain === value} onChange={() => { setDomain(value); clearError() }} /><span><Icon name={value === 'unlock' ? 'lock' : 'search'} />{value === 'unlock' ? t("Unlock") : t("Phone Check")}</span></label>)}</fieldset>}
    <ol className="price-check-steps" aria-label={t("Review & pay")}>{[t("Service & price"), t("Your details"), t("Review & pay")].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} data-done={step > index || undefined}><span aria-hidden="true">{index + 1}</span><span className="price-check-step-label">{label}</span></li>)}</ol>
    {products.length ? <>
      <ServicePicker moreHref={homeUnlockMenu && domain === 'unlock' ? '/services/unlock/more' : undefined}
        key={domain}
        id="pc-service"
        triggerRef={serviceInput}
        label={domain === 'unlock' ? t("Card total") : t("Card total")}
        options={products.map((product) => ({
          code: product.code, name: product.name, group: product.category,
          summary: product.summary ?? '', priceCents: product.priceCents>0 ? guestCardQuote(product.priceCents).totalCents : product.priceCents, priceAvailable: product.priceAvailable,
          etaLabel: product.etaLabel, available: product.available, hasExample: product.hasExample,
        }))}
        value={selected?.code ?? ''}
        disabled={pending}
        onChange={(code) => {
          const product = products.find((entry) => entry.code === code)
          setService({ ...service, [domain]: code }); clearError()
          if (product) {
            trackFunnelEvent('service_selection', { service_category: product.domain })
            if (product.domain === 'unlock') trackFunnelEvent('unlock_service_selected', { service_category: product.domain })
          }
        }}
      />
      {selected ? <div className="price-check-result" data-unpriced={selected.priceAvailable === false || undefined} aria-live="polite" aria-atomic="true"><p className="price-check-service-name">{selected.name}</p><dl className="price-check-quote"><div><dt>{t("Card total")} <span>USD</span></dt><dd>{selected.priceAvailable === false ? t("Contact for price") : formatUsd(total)}</dd></div><div><dt>{t("Estimated delivery")}</dt><dd>{selected.etaLabel}</dd></div></dl>{selected.priceAvailable !== false ? <p className="price-check-total">{t("Or crypto")} <strong>{formatUsd(selected.priceCents)}</strong> · {t("No service fee")}</p> : null}</div> : null}
      {selected?.summary ? <details className="price-check-requirements" key={selected.code}><summary>{t("Service details & requirements")}</summary><ServiceDescription value={selected.summary} /><p>{t("Review eligibility before ordering. Input format validation does not confirm eligibility.")}</p></details> : null}
    </> : <p className="alert" role="status"><Icon name="info" /><span>No services are listed right now. <Link href="/contact">{t("Support")}</Link> for availability.</span></p>}
    {selected?.available ? <div className="price-check-details">
      <div className="field"><div className="price-check-label-row"><label htmlFor="pc-imei">{field.label}</label><button type="button" className="price-check-text-button" aria-expanded={helpOpen} aria-controls="pc-imei-guide" onClick={() => setHelpOpen(!helpOpen)}><Icon name="question" />{t("Input help")}</button></div>
        {helpOpen ? <p className="price-check-imei-guide" id="pc-imei-guide">{field.hint}</p> : null}
        <div className="device-browse-input" data-invalid={error?.field === 'imei' || undefined}><Icon name="device" /><input id="pc-imei" ref={input} name="imei" type="text" inputMode={field.inputMode} enterKeyHint="next" autoComplete="off" spellCheck={false} placeholder={field.placeholder} maxLength={80} value={imei} disabled={pending} aria-describedby={`pc-imei-help${error?.field === 'imei' ? ' pc-error' : ''}`} aria-invalid={error?.field === 'imei'} onChange={(event) => { if (event.currentTarget.value && !started.current[domain]) { started.current[domain] = true; trackFunnelEvent('imei_input_started', { service_category: orderDomain }) } setImei(event.currentTarget.value); clearError() }} />{imei ? <button type="button" aria-label={t("Edit details")} disabled={pending} onClick={() => { setImei(''); clearError(); input.current?.focus() }}><Icon name="cross" /></button> : null}</div>
        <p className="device-browse-help" id="pc-imei-help"><span>{field.hint}</span><span className={validImei ? 'price-check-valid' : undefined}>{validImei ? <><Icon name="checkSmall" />{t("Format valid")}</> : inputType === 'imei' ? `${digits.length} / 15` : field.label}</span></p>
      </div>
      <div className="field"><label htmlFor="pc-email">{t("Email for your result")}</label><input id="pc-email" ref={emailInput} name="email" type="email" autoComplete="email" inputMode="email" enterKeyHint="go" spellCheck={false} placeholder="you@example.com" required maxLength={254} value={email} disabled={pending} aria-invalid={error?.field === 'email'} aria-describedby={`pc-email-help${error?.field === 'email' ? ' pc-error' : ''}`} onChange={(event) => { setEmail(event.currentTarget.value); clearError() }} /><p id="pc-email-help" className="field-note">{t("Your private order link and result. No password needed.")}</p></div>
    </div> : null}
    {selected ? <input type="hidden" name="productCode" value={selected.code} /> : null}
    {error || actionError ? <p className="alert alert--error" id="pc-error" role="alert"><Icon name="info" /><span>{error?.message || (actionError && t("Try again"))}</span></p> : null}
    <button className="button button--primary button--wide price-check-submit" type={selected ? "submit" : "button"} onClick={selected ? undefined : chooseService} disabled={pending || products.length === 0 || Boolean(selected && !selected.available)}>{pending ? <><Icon name="clock" />{t("Opening…")}</> : <>{!selected ? t("Choose a service") : t("Review order")}<Icon name="arrowRight" /></>}</button>
    <p className="price-check-next">{domain === 'unlock' ? t("Review your order before paying. Unlock processing starts after payment.") : t("Review your details and total. The real check starts after payment.")}</p>
    <p className="price-check-assurance"><span><Icon name="shieldCheck" />{t("Clear total")}</span><span><Icon name="clock" />{t("Private tracking link")}</span></p>
  </form>
}
