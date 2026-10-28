'use client'

import Link from 'next/link'
import { useActionState, useEffect, useRef, useState, type FormEvent } from 'react'
import { continueDeviceServiceAction } from '@/lib/device-intent-actions'
import { deviceImei } from '@/lib/device-intent-value'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { formatUsd } from '@/lib/money'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { Icon } from './icons'
import { ServicePicker } from './service-picker'
import { OrderPreviewDialog } from './order-preview-dialog'

/** Public catalog fields only; prices are checked again by the order flow. */
export type PriceCheckProduct = {
  code: string
  domain: 'unlock' | 'imei_check'
  name: string
  category: string
  priceCents: number
  priceAvailable?: boolean
  etaLabel: string
  summary?: string
  available: boolean
}

type Domain = 'unlock' | 'imei_check'
type Props = {
  unlock: PriceCheckProduct[]
  check: PriceCheckProduct[]
  ordering: boolean
  fixedDomain?: Domain
  initialImei?: string
  initialProductCode?: string
  initialEmail?: string
}
type FieldError = { field: 'service' | 'imei' | 'email'; message: string }
/** Select a service, add details once, then review before secure payment. */
export function HeroPriceCheck({ unlock, check, ordering, fixedDomain, initialImei = '', initialProductCode, initialEmail = '' }: Props) {
  const initialDomain = fixedDomain ?? (ordering && unlock.length ? 'unlock' : 'imei_check')
  const initialProduct = (initialDomain === 'unlock' ? unlock : check).find((product) => product.code === initialProductCode)
  const [domain, setDomain] = useState<Domain>(initialDomain)
  const [service, setService] = useState<Record<string, string>>({ [initialDomain]: initialProduct?.code ?? '' })
  const [imei, setImei] = useState(initialImei)
  const [email, setEmail] = useState(initialEmail)
  const [helpOpen, setHelpOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState<FieldError | null>(null)
  const [showActionError, setShowActionError] = useState(false)
  const form = useRef<HTMLFormElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const serviceInput = useRef<HTMLButtonElement>(null)
  const started = useRef<Record<string, boolean>>({})
  const approved = useRef(false)
  const paymentMethod = useRef<HTMLInputElement>(null)
  const products = domain === 'unlock' ? unlock : check
  const selected = products.find((product) => product.code === service[domain])
  const orderDomain = selected?.domain ?? domain
  const [state, action, pending] = useActionState(continueDeviceServiceAction, {})
  const digits = imei.replace(/[\s-]/g, '')
  const validImei = deviceImei(imei) !== null
  const cardQuote = selected && selected.priceCents > 0 ? guestCardQuote(selected.priceCents) : null
  const total = cardQuote?.totalCents ?? 0
  const actionError = showActionError ? state.error : undefined
  const step = previewOpen ? 2 : selected ? 1 : 0
  const lastQuote = useRef('')
  useEffect(() => {
    const key = selected ? `${orderDomain}:${selected.code}:${selected.priceCents}` : ''
    if (selected && selected.available && key !== lastQuote.current) { lastQuote.current = key; trackFunnelEvent('service_quote_viewed', { service_category: orderDomain, currency: 'USD', value: selected.priceCents / 100 }) }
  }, [selected, orderDomain])

  function clearError() { setError(null); setShowActionError(false); approved.current = false }
  function validate(event: FormEvent<HTMLFormElement>) {
    setError(null)
    if (!selected || !selected.available) {
      event.preventDefault(); setError({ field: 'service', message: 'Choose an available service to continue.' }); serviceInput.current?.focus(); return
    }
    if (!validImei) {
      event.preventDefault(); setError({ field: 'imei', message: 'Check your IMEI: enter all 15 digits from *#06# or Settings.' }); input.current?.focus()
      trackFunnelEvent('validation_result', { service_category: orderDomain, validation_status: 'failed', status: 'imei' }); return
    }
    if (!email.trim() || !emailInput.current?.validity.valid) {
      event.preventDefault(); setError({ field: 'email', message: 'Enter a valid email so we can send your result and private order link.' }); emailInput.current?.focus()
      trackFunnelEvent('validation_result', { service_category: orderDomain, validation_status: 'failed', status: 'email' }); return
    }
    if (approved.current) { approved.current = false; setShowActionError(true); return }
    event.preventDefault()
    trackFunnelEvent('validation_result', { service_category: orderDomain, validation_status: 'passed' })
    trackFunnelEvent('guest_details_completed', { service_category: orderDomain })
    if (orderDomain === 'unlock') trackFunnelEvent('unlock_imei_submitted', { service_category: orderDomain })
    trackFunnelEvent('order_preview_viewed', { service_category: orderDomain, currency: 'USD', value: total / 100 })
    setPreviewOpen(true)
  }
  function continueToPayment(method: 'card' | 'crypto') {
    if (paymentMethod.current) paymentMethod.current.value = method
    approved.current = true
    trackFunnelEvent('order_preview_continue', { service_category: orderDomain, currency: 'USD', value: (method === 'crypto' ? selected!.priceCents : total) / 100, payment_method: method })
    form.current?.requestSubmit()
  }

  return <form ref={form} className="price-check" action={action} onSubmit={validate} noValidate aria-label={domain === 'unlock' ? 'Choose an unlock service' : 'Choose a phone report'} aria-busy={pending}>
    <input ref={paymentMethod} type="hidden" name="paymentMethod" defaultValue="card" />
    <div className="price-check-head"><h2 className="price-check-title" id="price-check-heading">{domain === 'unlock' ? 'Choose your unlock service' : 'Choose your phone report'}</h2><p className="price-check-sub">Choose a service to see its price and delivery time.</p></div>
    <input type="hidden" name="domain" value={orderDomain} />
    {fixedDomain ? null : <fieldset className="device-browse-options" disabled={pending}><legend className="visually-hidden">What would you like to do?</legend>{(['unlock', 'imei_check'] as const).map((value) => <label key={value}><input type="radio" name="browseDomain" value={value} checked={domain === value} onChange={() => { setDomain(value); clearError() }} /><span><Icon name={value === 'unlock' ? 'lock' : 'search'} />{value === 'unlock' ? 'Unlock Phone' : 'Phone Check'}</span></label>)}</fieldset>}
    <ol className="price-check-steps" aria-label="Order steps">{['Service & price', 'Your details', 'Review & pay'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} data-done={step > index || undefined}><span aria-hidden="true">{index + 1}</span>{label}</li>)}</ol>
    {products.length ? <>
      <ServicePicker
        key={domain}
        id="pc-service"
        triggerRef={serviceInput}
        label={domain === 'unlock' ? 'Unlock service' : 'Phone Check service'}
        options={products.map((product) => ({
          code: product.code, name: product.name, group: product.category,
          summary: product.summary ?? '', priceCents: product.priceCents, priceAvailable: product.priceAvailable,
          etaLabel: product.etaLabel, available: product.available,
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
      {selected ? <div className="price-check-result" aria-live="polite" aria-atomic="true"><p className="price-check-service-name">{selected.name}</p><dl className="price-check-quote"><div><dt>Service price <span>USD</span></dt><dd>{selected.priceAvailable === false ? 'Contact for price' : formatUsd(selected.priceCents)}</dd></div><div><dt>Estimated delivery</dt><dd>{selected.etaLabel}</dd></div></dl>{selected.priceAvailable !== false ? <p className="price-check-total">Card total <strong>{formatUsd(total)}</strong></p> : null}{cardQuote?.requiresAccount ? <p className="price-check-minimum"><strong>Card orders under $1 need an account. {formatUsd(cardQuote.walletCreditCents)} is saved as credit after payment.</strong></p> : null}</div> : null}
      {selected?.summary ? <details className="price-check-requirements" key={selected.code}><summary>Service details &amp; requirements</summary><p>{selected.summary}</p><p>Review eligibility before ordering. IMEI format validation does not confirm eligibility.</p></details> : null}
    </> : <p className="alert" role="status"><Icon name="info" /><span>No services are listed right now. <Link href="/contact">Contact support</Link> for availability.</span></p>}
    {selected?.available ? <div className="price-check-details">
      <div className="field"><div className="price-check-label-row"><label htmlFor="pc-imei">IMEI number</label><button type="button" className="price-check-text-button" aria-expanded={helpOpen} aria-controls="pc-imei-guide" onClick={() => setHelpOpen(!helpOpen)}><Icon name="question" />Find my IMEI</button></div>
        {helpOpen ? <p className="price-check-imei-guide" id="pc-imei-guide">Dial <kbd>*#06#</kbd> on the phone, or open Settings → General → About. Copy and paste the 15-digit IMEI here. Spaces and dashes are accepted.</p> : null}
        <div className="device-browse-input" data-invalid={error?.field === 'imei' || undefined}><Icon name="device" /><input id="pc-imei" ref={input} name="imei" type="text" inputMode="numeric" enterKeyHint="next" autoComplete="off" spellCheck={false} placeholder="Paste or enter 15-digit IMEI" value={imei} disabled={pending} aria-describedby={`pc-imei-help${error?.field === 'imei' ? ' pc-error' : ''}`} aria-invalid={error?.field === 'imei'} onChange={(event) => { if (event.currentTarget.value && !started.current[domain]) { started.current[domain] = true; trackFunnelEvent('imei_input_started', { service_category: orderDomain }) } setImei(event.currentTarget.value); clearError() }} />{imei ? <button type="button" aria-label="Clear IMEI" disabled={pending} onClick={() => { setImei(''); clearError(); input.current?.focus() }}><Icon name="cross" /></button> : null}</div>
        <p className="device-browse-help" id="pc-imei-help"><span>Dial <kbd>*#06#</kbd> to find it</span><span className={validImei ? 'price-check-valid' : undefined}>{validImei ? <><Icon name="checkSmall" />Format valid</> : `${digits.length} / 15`}</span></p>
      </div>
      <div className="field"><label htmlFor="pc-email">Email for your result</label><input id="pc-email" ref={emailInput} name="email" type="email" autoComplete="email" inputMode="email" enterKeyHint="go" spellCheck={false} placeholder="you@example.com" required maxLength={254} value={email} disabled={pending} aria-invalid={error?.field === 'email'} aria-describedby={`pc-email-help${error?.field === 'email' ? ' pc-error' : ''}`} onChange={(event) => { setEmail(event.currentTarget.value); clearError() }} /><p id="pc-email-help" className="field-note">Your private order link and result. No password needed.</p></div>
    </div> : null}
    {selected ? <input type="hidden" name="productCode" value={selected.code} /> : null}
    {error || actionError ? <p className="alert alert--error" id="pc-error" role="alert"><Icon name="info" /><span>{error?.message || actionError}</span></p> : null}
    <button className="button button--primary button--wide price-check-submit" type="submit" disabled={pending || products.length === 0 || Boolean(selected && !selected.available)}>{pending ? <><Icon name="clock" />Opening…</> : <>{domain === 'unlock' ? 'Preview unlock order' : 'Preview my report'}<Icon name="arrowRight" /></>}</button>
    <p className="price-check-next">{domain === 'unlock' ? 'Review your order before paying. Unlock processing starts after payment.' : 'View the report preview before paying. The real check starts after payment.'}</p>
    <p className="price-check-assurance"><span><Icon name="shieldCheck" />Clear total</span><span><Icon name="clock" />Private tracking link</span></p>
    {selected && selected.priceCents > 0 ? <OrderPreviewDialog open={previewOpen} product={selected} domain={orderDomain} imei={digits} email={email.trim()} pending={pending} error={actionError} onClose={() => { setPreviewOpen(false); approved.current = false }} onContinue={continueToPayment} /> : null}
  </form>
}
