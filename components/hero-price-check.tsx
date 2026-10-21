'use client'

import Link from 'next/link'
import { useActionState, useMemo, useRef, useState, type FormEvent } from 'react'
import { browseDevicesAction, showUnlockServicesAction } from '@/lib/device-intent-actions'
import { deviceImei } from '@/lib/device-intent-value'
import { formatUsd } from '@/lib/money'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { Icon } from './icons'

/** Public catalog fields only; prices are checked again by the order flow. */
export type PriceCheckProduct = {
  code: string
  name: string
  category: string
  priceCents: number
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
}
type FieldError = { field: 'category' | 'service' | 'imei'; message: string }
const COUNTRIES = ['United States', 'Canada', 'United Kingdom', 'Austria', 'Japan', 'Romania', 'EMEA']

function orderedCategories(products: PriceCheckProduct[]) {
  return [...new Set(products.map((product) => product.category))].sort((a, b) => {
    const ai = COUNTRIES.indexOf(a)
    const bi = COUNTRIES.indexOf(b)
    if (ai !== -1 || bi !== -1) return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    return a.localeCompare(b, 'en')
  })
}

/** The homepage and unlock landing share one quote-first, read-only handoff. */
export function HeroPriceCheck({ unlock, check, ordering, fixedDomain, initialImei = '', initialProductCode }: Props) {
  const initialDomain = fixedDomain ?? (ordering && unlock.length ? 'unlock' : 'imei_check')
  const initialProduct = (initialDomain === 'unlock' ? unlock : check).find((product) => product.code === initialProductCode)
  const [domain, setDomain] = useState<Domain>(initialDomain)
  const [category, setCategory] = useState<Record<string, string>>({ [initialDomain]: initialProduct?.category ?? '' })
  const [service, setService] = useState<Record<string, string>>({ [initialDomain]: initialProduct?.code ?? '' })
  const [otherServices, setOtherServices] = useState(!!initialProduct && !COUNTRIES.includes(initialProduct.category))
  const [imei, setImei] = useState(initialImei)
  const [helpOpen, setHelpOpen] = useState(false)
  const [error, setError] = useState<FieldError | null>(null)
  const [showActionError, setShowActionError] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const categoryInput = useRef<HTMLSelectElement>(null)
  const serviceInput = useRef<HTMLSelectElement>(null)
  const started = useRef(false)
  const products = domain === 'unlock' ? unlock : check
  const categories = useMemo(() => orderedCategories(products), [products])
  const countries = categories.filter((name) => COUNTRIES.includes(name))
  const other = categories.filter((name) => !COUNTRIES.includes(name))
  const showOther = otherServices || countries.length === 0
  const visibleCategories = domain === 'unlock' ? (showOther ? other : countries) : categories
  const activeCategory = visibleCategories.includes(category[domain]) ? category[domain] : ''
  const inCategory = products.filter((product) => product.category === activeCategory)
  // A quote belongs to an explicit choice, never the first catalog row.
  const selected = inCategory.find((product) => product.code === service[domain])
  const unlockReady = ordering && domain === 'unlock' && unlock.length > 0
  const [state, action, pending] = useActionState(unlockReady ? showUnlockServicesAction : browseDevicesAction, {})
  const imeiRequired = unlockReady
  const digits = imei.replace(/[\s-]/g, '')
  const validImei = deviceImei(imei) !== null
  const step = !selected ? 0 : unlockReady && !validImei ? 1 : 2
  const actionError = showActionError ? state.error : undefined

  function clearError() { setError(null); setShowActionError(false) }
  function validate(event: FormEvent<HTMLFormElement>) {
    clearError()
    if (!activeCategory) {
      event.preventDefault()
      setError({ field: 'category', message: domain === 'unlock' ? 'Choose a country or service category to get started.' : 'Choose a report category to get started.' })
      categoryInput.current?.focus()
      return
    }
    if (!selected || !selected.available) {
      event.preventDefault()
      setError({ field: 'service', message: 'Choose an available service to see its price and delivery time.' })
      serviceInput.current?.focus()
      return
    }
    if ((imeiRequired || imei.trim()) && !validImei) {
      event.preventDefault()
      setError({ field: 'imei', message: unlockReady ? 'Check your IMEI: enter all 15 digits from *#06# or Settings.' : 'Enter a valid 15-digit IMEI, or clear it to browse reports.' })
      input.current?.focus()
      trackFunnelEvent('validation_result', { service_category: domain, validation_status: 'failed' })
      return
    }
    setShowActionError(true)
    if (imei.trim()) trackFunnelEvent('validation_result', { service_category: domain, validation_status: 'passed' })
    if (unlockReady) trackFunnelEvent('unlock_imei_submitted', { service_category: domain })
    trackFunnelEvent('service_selection', { service_category: domain })
  }

  return (
    <form className="price-check" action={action} onSubmit={validate} noValidate aria-label="Check price and unlock time" aria-busy={pending}>
      <div className="price-check-head">
        <h2 className="price-check-title" id="price-check-heading">Check price &amp; delivery</h2>
        <p className="price-check-sub">Choose a service. See the cost before you continue.</p>
      </div>
      {fixedDomain ? <input type="hidden" name="domain" value={domain} /> : (
        <fieldset className="device-browse-options" disabled={pending}>
          <legend className="visually-hidden">What would you like to do?</legend>
          {(['unlock', 'imei_check'] as const).map((value) => (
            <label key={value}>
              <input type="radio" name="domain" value={value} checked={domain === value} onChange={() => { setDomain(value); clearError() }} />
              <span><Icon name={value === 'unlock' ? 'lock' : 'search'} />{value === 'unlock' ? 'Unlock Phone' : 'Phone Check'}</span>
            </label>
          ))}
        </fieldset>
      )}
      <ol className="price-check-steps" aria-label="Order steps">
        {['Service', 'IMEI', 'Review'].map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} data-done={step > index || undefined}><span aria-hidden="true">{index + 1}</span>{label}</li>)}
      </ol>

      {products.length ? (
        <>
          <div className="field">
            <div className="price-check-label-row">
              <label htmlFor="pc-category">{domain === 'unlock' ? (showOther ? 'Service category' : 'Country / region') : 'Report category'}</label>
              {domain === 'unlock' && countries.length > 0 && other.length > 0 ? (
                <button type="button" className="price-check-text-button" disabled={pending} onClick={() => { setOtherServices(!showOther); setCategory({ ...category, unlock: '' }); setService({ ...service, unlock: '' }); clearError() }}>
                  {showOther ? 'By country' : 'Other services'}<Icon name="arrowRight" />
                </button>
              ) : null}
            </div>
            <select id="pc-category" ref={categoryInput} value={activeCategory} disabled={pending} aria-invalid={error?.field === 'category'} aria-describedby={error?.field === 'category' ? 'pc-error' : 'pc-category-help'} onChange={(event) => { setCategory({ ...category, [domain]: event.currentTarget.value }); setService({ ...service, [domain]: '' }); clearError() }}>
              <option value="">{domain === 'unlock' && !showOther ? 'Select original carrier country' : 'Select a category'}</option>
              {visibleCategories.map((name) => <option key={name} value={name}>{name}</option>)}
            </select>
            <p className="field-note" id="pc-category-help">{domain === 'unlock' && !showOther ? 'Where your phone’s original carrier is based.' : 'Choose the type of service you need.'}</p>
          </div>
          <div className="field">
            <label htmlFor="pc-service">{domain === 'unlock' ? 'Carrier / service' : 'Report'}</label>
            <select id="pc-service" ref={serviceInput} value={selected?.code ?? ''} disabled={pending || !activeCategory} aria-invalid={error?.field === 'service'} aria-describedby={error?.field === 'service' ? 'pc-error' : undefined} onChange={(event) => {
              setService({ ...service, [domain]: event.currentTarget.value }); clearError()
              if (event.currentTarget.value) { trackFunnelEvent('service_selection', { service_category: domain }); if (domain === 'unlock') trackFunnelEvent('unlock_service_selected', { service_category: domain }) }
            }}>
              <option value="">{activeCategory ? 'Select a service' : 'Choose a category first'}</option>
              {inCategory.map((product) => <option key={product.code} value={product.code} disabled={!product.available}>{product.name}{product.available ? '' : ' — unavailable'}</option>)}
            </select>
            {activeCategory && !inCategory.some((product) => product.available) ? <p className="field-note">No online services are available in this category right now. <Link href="/contact">Ask support</Link></p> : null}
          </div>
          <div className="price-check-result" aria-live="polite" aria-atomic="true">
            {selected ? <p className="price-check-service-name">{selected.name}</p> : null}
            <dl className="price-check-quote" data-empty={!selected || undefined}>
              <div><dt>Service price <span>USD</span></dt><dd>{selected ? formatUsd(selected.priceCents) : 'Select a service'}</dd></div>
              <div><dt>Estimated delivery</dt><dd>{selected?.etaLabel ?? 'Shown with price'}</dd></div>
            </dl>
          </div>
          {selected?.summary ? <details className="price-check-requirements" key={selected.code}><summary>Service details &amp; requirements</summary><p>{selected.summary}</p><p>Review eligibility before ordering. IMEI format validation does not confirm eligibility.</p></details> : null}
        </>
      ) : <p className="alert" role="status"><Icon name="info" /><span>No services are listed right now. <Link href="/contact">Contact support</Link> for availability.</span></p>}

      <div className="field">
        <div className="price-check-label-row">
          <label htmlFor="pc-imei">IMEI number {!unlockReady ? <span className="device-browse-optional">Optional</span> : null}</label>
          <button type="button" className="price-check-text-button" aria-expanded={helpOpen} aria-controls="pc-imei-guide" onClick={() => setHelpOpen(!helpOpen)}><Icon name="question" />Need help?</button>
        </div>
        {helpOpen ? <p className="price-check-imei-guide" id="pc-imei-guide">Dial <kbd>*#06#</kbd> on your phone, or open Settings → About. Use the 15-digit IMEI for the device you want to check or unlock.</p> : null}
        <div className="device-browse-input" data-invalid={error?.field === 'imei' || undefined}>
          <Icon name="device" />
          <input id="pc-imei" ref={input} name="imei" type="text" inputMode="numeric" enterKeyHint="go" autoComplete="off" spellCheck={false} placeholder="Enter 15-digit IMEI" value={imei} disabled={pending} aria-describedby={`pc-imei-help${error?.field === 'imei' ? ' pc-error' : ''}`} aria-invalid={error?.field === 'imei'} onChange={(event) => {
            if (event.currentTarget.value && !started.current) { started.current = true; trackFunnelEvent('imei_input_started', { service_category: domain }) }
            setImei(event.currentTarget.value); clearError()
          }} />
          {imei ? <button type="button" aria-label="Clear IMEI" disabled={pending} onClick={() => { setImei(''); clearError(); input.current?.focus() }}><Icon name="cross" /></button> : null}
        </div>
        <p className="device-browse-help" id="pc-imei-help"><span>Find it by dialing <kbd>*#06#</kbd></span><span className={validImei ? 'price-check-valid' : undefined}>{validImei ? <><Icon name="checkSmall" />Valid format</> : `${digits.length} / 15`}</span></p>
      </div>
      {selected ? <input type="hidden" name="productCode" value={selected.code} /> : null}
      {error || actionError ? <p className="alert alert--error" id="pc-error" role="alert"><Icon name="info" /><span>{error?.message || actionError}</span></p> : null}
      <button className="button button--primary button--wide price-check-submit" type="submit" disabled={pending || products.length === 0}>
        {pending ? <><Icon name="clock" />Opening…</> : <>Continue to service details<Icon name="arrowRight" /></>}
      </button>
      <p className="price-check-next">Review the requirements next. Nothing is ordered here.</p>
      <p className="price-check-assurance"><span><Icon name="shieldCheck" />Refund if not delivered</span><span><Icon name="clock" />Order tracking</span></p>
    </form>
  )
}
