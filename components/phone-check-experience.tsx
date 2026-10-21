'use client'

import { useActionState, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react'
import { continueDeviceServiceAction } from '@/lib/device-intent-actions'
import { deviceImei } from '@/lib/device-intent-value'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { formatUsd } from '@/lib/money'
import type { PriceCheckProduct } from './hero-price-check'
import { Icon } from './icons'
import { OrderPreviewDialog } from './order-preview-dialog'
import '@/styles/phone-check-experience.css'

type Props = {
  products: PriceCheckProduct[]
  initialImei?: string
  initialEmail?: string
  initialProductCode?: string
}
type FieldError = { field: 'service' | 'imei' | 'email'; message: string }

const QUICK_PICKS = [
  { label: 'Blacklist', code: 'BLACKLIST_FULL', fallback: 'BLACKLIST_SIMPLE', icon: 'shieldCheck' },
  { label: 'iPhone', code: 'APPLE_BASIC', fallback: 'APPLE_CARRIER_LITE', icon: 'device' },
  { label: 'Samsung', code: 'SAMSUNG_INFO', fallback: 'SAMSUNG_KNOX', icon: 'device' },
] as const

/** Field labels only. No provider request or invented device result is made here. */
function reportFields(code?: string): string[] {
  switch (code) {
    case 'BLACKLIST_FULL': return ['Blacklist status', 'Reported by', 'Country', 'Report date', 'Reason']
    case 'BLACKLIST_SIMPLE': return ['Blacklist status']
    case 'APPLE_BASIC': return ['Device model', 'Warranty', 'Find My status', 'Blacklist status', 'SIM lock']
    case 'APPLE_CARRIER_LITE': return ['Device model', 'Carrier', 'Activation policy', 'SIM lock', 'Purchase date']
    case 'SAMSUNG_INFO': return ['Device model', 'Carrier', 'Country', 'Production date', 'Warranty']
    case 'SAMSUNG_KNOX': return ['Device model', 'Knox Guard status', 'Carrier', 'Production date', 'Warranty']
    default: return ['Report result', 'Provider details']
  }
}

/** The form saves a draft and navigates only; the paid check starts after payment. */
export function PhoneCheckExperience({ products, initialImei = '', initialEmail = '', initialProductCode }: Props) {
  const id = useId()
  const quickPicks = useMemo(() => QUICK_PICKS.map((pick) => ({
    ...pick,
    product: products.find((product) => product.code === pick.code && product.available)
      ?? products.find((product) => product.code === pick.fallback && product.available),
  })), [products])
  const [productCode, setProductCode] = useState(() => initialProductCode
    || quickPicks[0].product?.code
    || products.find((product) => product.available)?.code
    || '')
  const [moreOpen, setMoreOpen] = useState(() => !!initialProductCode && !quickPicks.some((pick) => pick.product?.code === initialProductCode))
  const [search, setSearch] = useState('')
  const [imei, setImei] = useState(initialImei)
  const [email, setEmail] = useState(initialEmail)
  const [helpOpen, setHelpOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [error, setError] = useState<FieldError | null>(null)
  const [showActionError, setShowActionError] = useState(false)
  const [state, action, pending] = useActionState(continueDeviceServiceAction, {})
  const form = useRef<HTMLFormElement>(null)
  const imeiInput = useRef<HTMLInputElement>(null)
  const emailInput = useRef<HTMLInputElement>(null)
  const productInput = useRef<HTMLSelectElement>(null)
  const moreButton = useRef<HTMLButtonElement>(null)
  const paymentMethod = useRef<HTMLInputElement>(null)
  const approved = useRef(false)
  const started = useRef(false)
  const lastQuote = useRef('')
  const selected = products.find((product) => product.code === productCode)
  const available = !!selected?.available && selected.priceCents > 0
  const cardQuote = available ? guestCardQuote(selected.priceCents) : null
  const actionError = showActionError ? state.error : undefined
  const digits = imei.replace(/[\s-]/g, '')
  const validImei = deviceImei(imei) !== null
  const searchQuery = search.trim().toLocaleLowerCase()
  const filteredProducts = products.filter((product) => `${product.name} ${product.category}`.toLocaleLowerCase().includes(searchQuery))
  // Keep the selected option present even while searching so the price never changes silently.
  const visibleProducts = selected && !filteredProducts.some((product) => product.code === selected.code)
    ? [selected, ...filteredProducts] : filteredProducts
  const errorId = `${id}-error`

  useEffect(() => {
    const key = available ? `${selected.code}:${selected.priceCents}` : ''
    if (key && key !== lastQuote.current) {
      lastQuote.current = key
      trackFunnelEvent('service_quote_viewed', { service_category: 'imei_check', currency: 'USD', value: selected!.priceCents / 100 })
    }
  }, [available, selected])

  function clearError() {
    setError(null)
    setShowActionError(false)
    approved.current = false
  }
  function chooseProduct(code: string) {
    setProductCode(code)
    clearError()
    trackFunnelEvent('service_selection', { service_category: 'imei_check' })
  }
  function validate(event: FormEvent<HTMLFormElement>) {
    setError(null)
    if (!available) {
      event.preventDefault()
      setError({ field: 'service', message: 'Choose an available report to continue.' })
      if (moreOpen) productInput.current?.focus()
      else moreButton.current?.focus()
      return
    }
    if (!validImei) {
      event.preventDefault()
      setError({ field: 'imei', message: 'Enter a valid 15-digit IMEI. Dial *#06# on your phone to find it.' })
      imeiInput.current?.focus()
      trackFunnelEvent('validation_result', { service_category: 'imei_check', validation_status: 'failed', status: 'imei' })
      return
    }
    if (!email.trim() || !emailInput.current?.validity.valid) {
      event.preventDefault()
      setError({ field: 'email', message: 'Enter a valid email for your result and private order link.' })
      emailInput.current?.focus()
      trackFunnelEvent('validation_result', { service_category: 'imei_check', validation_status: 'failed', status: 'email' })
      return
    }
    if (approved.current) {
      approved.current = false
      setShowActionError(true)
      return
    }
    trackFunnelEvent('validation_result', { service_category: 'imei_check', validation_status: 'passed' })
    trackFunnelEvent('guest_details_completed', { service_category: 'imei_check' })
    const submitter = (event.nativeEvent as SubmitEvent).submitter
    if (submitter instanceof HTMLButtonElement && submitter.dataset.paymentMethod === 'crypto') {
      if (paymentMethod.current) paymentMethod.current.value = 'crypto'
      setShowActionError(true)
      trackFunnelEvent('order_preview_continue', { service_category: 'imei_check', currency: 'USD', value: selected.priceCents / 100, payment_method: 'crypto' })
      return
    }
    event.preventDefault()
    trackFunnelEvent('order_preview_viewed', { service_category: 'imei_check', currency: 'USD', value: selected.priceCents / 100 })
    setPreviewOpen(true)
  }
  function continueToPayment(method: 'card' | 'crypto') {
    if (!available || !cardQuote) return
    if (paymentMethod.current) paymentMethod.current.value = method
    approved.current = true
    trackFunnelEvent('order_preview_continue', {
      service_category: 'imei_check', currency: 'USD',
      value: (method === 'crypto' ? selected.priceCents : cardQuote.totalCents) / 100,
      payment_method: method,
    })
    form.current?.requestSubmit()
  }

  return <div className="phone-check-experience">
    <form ref={form} className="phone-check-form" action={action} onSubmit={validate} noValidate aria-labelledby={`${id}-heading`} aria-busy={pending}>
      <input type="hidden" name="domain" value="imei_check" />
      <input type="hidden" name="productCode" value={productCode} />
      <input ref={paymentMethod} type="hidden" name="paymentMethod" defaultValue="card" />
      <div className="phone-check-form-heading"><h2 id={`${id}-heading`}>Choose your check</h2><span>1. Details <span aria-hidden="true">→</span> 2. Payment</span></div>

      <div className="phone-check-picks" role="group" aria-label="Quick report choices">
        {quickPicks.map((pick) => <button key={pick.label} type="button" disabled={pending || !pick.product} aria-pressed={!!pick.product && productCode === pick.product.code} onClick={() => { if (pick.product) chooseProduct(pick.product.code) }}><Icon name={pick.icon} /><span>{pick.label}</span>{pick.product ? <small>{formatUsd(pick.product.priceCents)}</small> : <small>Unavailable</small>}</button>)}
      </div>

      <button ref={moreButton} type="button" className="phone-check-more" aria-expanded={moreOpen} aria-controls={`${id}-reports`} disabled={pending} onClick={() => setMoreOpen(!moreOpen)}><span>More reports <small>({products.length})</small></span><Icon name={moreOpen ? 'cross' : 'plus'} /></button>
      {moreOpen ? <div className="phone-check-report-picker" id={`${id}-reports`}>
        <label htmlFor={`${id}-search`}>Find a report</label>
        <div className="phone-check-search"><Icon name="search" /><input id={`${id}-search`} type="search" value={search} onChange={(event) => setSearch(event.currentTarget.value)} placeholder="Search brand, carrier or report" disabled={pending} autoComplete="off" /></div>
        <label htmlFor={`${id}-product`}>All reports · service price in USD</label>
        <select id={`${id}-product`} ref={productInput} value={selected?.code ?? ''} disabled={pending} aria-invalid={error?.field === 'service'} aria-describedby={error?.field === 'service' ? errorId : undefined} onChange={(event) => chooseProduct(event.currentTarget.value)}>
          <option value="" disabled>Choose a report</option>
          {visibleProducts.map((product) => <option key={product.code} value={product.code} disabled={!product.available}>{product.name} · {formatUsd(product.priceCents)}{product.available ? '' : ' — unavailable'}</option>)}
        </select>
        <p className="phone-check-field-help" role="status">{searchQuery ? `${filteredProducts.length} matching reports` : 'Every report is available to browse here.'}</p>
      </div> : null}

      {selected ? <div className="phone-check-selection" aria-live="polite" aria-atomic="true">
        <div><span className="phone-check-selection-eyebrow">Selected report</span><h3>{selected.name}</h3><p><Icon name="clock" />{selected.etaLabel}<span>estimated</span></p></div>
        <div className="phone-check-price"><strong>{formatUsd(selected.priceCents)}</strong><span>USD / report</span></div>
      </div> : null}
      {!available ? <p className="phone-check-unavailable" role="status"><Icon name="info" /><span>{productCode ? 'This report is unavailable. Choose another report to continue.' : 'No reports are available right now. Please check again shortly.'}</span></p> : null}
      {selected?.summary ? <details className="phone-check-included" key={selected.code}><summary>What’s included?</summary><p>{selected.summary}</p></details> : null}

      {available ? <div className="phone-check-fields">
        <div className="phone-check-field">
          <div className="phone-check-label-row"><label htmlFor={`${id}-imei`}>IMEI number</label><button type="button" aria-expanded={helpOpen} aria-controls={`${id}-imei-guide`} onClick={() => setHelpOpen(!helpOpen)}>Where is my IMEI?<Icon name="question" /></button></div>
          {helpOpen ? <p className="phone-check-imei-guide" id={`${id}-imei-guide`}>Dial <kbd>*#06#</kbd> on your phone, or look in Settings → About. Paste the 15-digit IMEI below.</p> : null}
          <div className="phone-check-imei-input" data-invalid={error?.field === 'imei' || undefined}><Icon name="device" /><input ref={imeiInput} id={`${id}-imei`} name="imei" type="text" inputMode="numeric" enterKeyHint="next" autoComplete="off" spellCheck={false} placeholder="Enter 15-digit IMEI" value={imei} disabled={pending} aria-invalid={error?.field === 'imei'} aria-describedby={`${id}-imei-help${error?.field === 'imei' ? ` ${errorId}` : ''}`} onChange={(event) => {
            if (event.currentTarget.value && !started.current) { started.current = true; trackFunnelEvent('imei_input_started', { service_category: 'imei_check' }) }
            setImei(event.currentTarget.value); clearError()
          }} />{imei ? <button type="button" aria-label="Clear IMEI" disabled={pending} onClick={() => { setImei(''); clearError(); imeiInput.current?.focus() }}><Icon name="cross" /></button> : null}</div>
          <p className="phone-check-imei-help" id={`${id}-imei-help`}>Spaces and dashes are OK.<span data-valid={validImei || undefined}>{validImei ? <><Icon name="checkSmall" />Format valid</> : `${digits.length} / 15`}</span></p>
        </div>
        <div className="phone-check-field"><label htmlFor={`${id}-email`}>Email for your result</label><input id={`${id}-email`} ref={emailInput} name="email" type="email" inputMode="email" enterKeyHint="go" autoComplete="email" spellCheck={false} placeholder="you@example.com" maxLength={254} value={email} required disabled={pending} aria-invalid={error?.field === 'email'} aria-describedby={`${id}-email-help${error?.field === 'email' ? ` ${errorId}` : ''}`} onChange={(event) => { setEmail(event.currentTarget.value); clearError() }} /><p id={`${id}-email-help`} className="phone-check-field-help">We’ll email your result and private order link.</p></div>
      </div> : null}

      {error || actionError ? <p className="phone-check-error" id={errorId} role="alert"><Icon name="info" /><span>{error?.message || actionError}</span></p> : null}
      <button className="phone-check-submit" type="submit" disabled={pending || !available}>{pending ? 'Opening checkout…' : 'Review & pay'}<Icon name={pending ? 'clock' : 'arrowRight'} /></button>
      {cardQuote ? <p className="phone-check-card-note">{cardQuote.requiresAccount ? <strong>Card: {formatUsd(cardQuote.totalCents)} today. {formatUsd(cardQuote.walletCreditCents)} stays as credit. Create an account, then return to checkout.</strong> : <>Card total: <strong>{formatUsd(cardQuote.totalCents)}</strong> before any applicable tax.</>}</p> : null}
      <button className="phone-check-crypto" type="submit" data-payment-method="crypto" disabled={pending || !available} onClick={() => { if (paymentMethod.current) paymentMethod.current.value = 'crypto' }}><Icon name="wallet" /><span>Pay with crypto{available ? ` · ${formatUsd(selected.priceCents)}` : ''}</span><small>No fee · No minimum</small></button>
      <p className="phone-check-payment-help">Your check starts after payment. Network fees may apply to crypto.</p>
      {available ? <OrderPreviewDialog open={previewOpen} product={selected} domain="imei_check" imei={digits} email={email.trim()} liveLabel="Live Data" pending={pending} error={actionError} onClose={() => { setPreviewOpen(false); approved.current = false }} onContinue={continueToPayment} /> : null}
    </form>

    <aside className="phone-check-report" aria-labelledby={`${id}-report-heading`}>
      <div className="phone-check-report-top"><span className="phone-check-report-brand"><Icon name="file" />Your phone report</span><span className="phone-check-live"><span aria-hidden="true" />Live Data</span></div>
      <div className="phone-check-report-intro"><span className="phone-check-report-symbol"><Icon name="device" /></span><div><p>Know your phone better</p><h2 id={`${id}-report-heading`}>{selected?.name ?? 'Choose your phone report'}</h2></div></div>
      <div className="phone-check-report-content">
        <div className="phone-check-report-label"><span>Report details</span><span><Icon name="lock" />Locked</span></div>
        <dl className="phone-check-report-fields" aria-label="Report fields, locked until payment and processing">{reportFields(selected?.code).map((field, index) => <div key={field}><dt>{field}</dt><dd><span className="phone-check-locked-bar" style={{ width: `${[74, 58, 82, 64, 70][index % 5]}%` }} aria-hidden="true" /><span className="visually-hidden">Available after payment and processing</span><Icon name="lock" /></dd></div>)}</dl>
        <div className="phone-check-report-unlock"><span><Icon name="lock" /></span><strong>Your full report, in one place.</strong><p>Your device data appears after payment and processing.</p></div>
      </div>
      <div className="phone-check-report-footer"><span><Icon name="mail" />Result by email</span><span><Icon name="shieldCheck" />Private order link</span></div>
      {selected ? <dl className="phone-check-report-quote"><div><dt>Report price</dt><dd>{formatUsd(selected.priceCents)} USD</dd></div><div><dt>Estimated delivery</dt><dd>{selected.etaLabel}</dd></div></dl> : null}
    </aside>
  </div>
}
