'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { IMEI_LENGTH, maskIdentifier } from '@/lib/imei'
import { deviceImei } from '@/lib/device-intent-value'
import { formatUsd } from '@/lib/money'
import { Icon } from './icons'
import { ServicePicker } from './service-picker'
import { saveDeviceIntentAction, clearAcceptedDeviceIntentAction } from '@/lib/device-intent-actions'

type Product = {
  code: string
  name: string
  summary: string
  group: string
  domain: 'imei_check' | 'unlock'
  priceCents: number
  etaMinutes: number
  providerReady: boolean
}

type PaidReportView = {
  id: number
  productName: string
  maskedImei: string
  status: 'processing' | 'completed' | 'refunded' | 'manual_review'
  priceCents: number
  message?: string
}

type PaidReportPayload = {
  success: true
  order: PaidReportView
  credit: {
    heldCents: number
    chargedCents: number
    refundedCents: number
    balanceCents: number
  }
}

class ReportRequestError extends Error {}

function statusLabel(status: PaidReportView['status']) {
  if (status === 'completed') return 'Result ready'
  if (status === 'refunded') return 'Credit returned'
  if (status === 'manual_review') return 'Manual review'
  return 'Processing'
}

export function PaidReportConsole({
  products,
  csrfToken,
  availableCents,
  initialProductCode,
  initialImei,
  initialDomain,
  paymentMethods,
}: {
  products: Product[]
  csrfToken: string
  availableCents: number
  initialProductCode?: string
  initialImei?: string
  initialDomain?: 'imei_check' | 'unlock'
  paymentMethods: string[]
}) {
  const router = useRouter()
  const initialCode = products.some((product) => product.code === initialProductCode)
    ? initialProductCode ?? ''
    : ''
  const [productCode, setProductCode] = useState(initialCode)
  const [imei, setImei] = useState(initialImei ?? '')
  const [domain, setDomain] = useState<'imei_check' | 'unlock'>(
    products.find((entry) => entry.code === initialCode)?.domain ?? initialDomain ?? 'imei_check',
  )
  const [savingDraft, setSavingDraft] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [balanceCents, setBalanceCents] = useState(availableCents)
  const [imeiTouched, setImeiTouched] = useState(false)
  const imeiRef = useRef<HTMLInputElement>(null)
  const reviewRef = useRef<HTMLHeadingElement>(null)
  const resultRef = useRef<HTMLElement>(null)
  const inFlight = useRef(false)
  const [reviewing, setReviewing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [payload, setPayload] = useState<PaidReportPayload | null>(null)
  const idempotencyRef = useRef<string | null>(null)

  const product = products.find((entry) => entry.code === productCode) ?? null
  const visibleProducts = useMemo(() => products.filter((entry) => entry.domain === domain), [products, domain])
  const affordable = !product || product.priceCents <= balanceCents
  // Validate the original input: never truncate a longer identifier or discard letters.
  const digits = deviceImei(imei)
  const digitCount = imei.replace(/\D/g, '').length
  const imeiValid = digits !== null
  const imeiInvalid = imeiTouched && !imeiValid
  const locked = busy || savingDraft || uncertain || payload !== null

  useEffect(() => {
    if (reviewing) reviewRef.current?.focus()
  }, [reviewing])
  useEffect(() => {
    if (payload) resultRef.current?.focus()
  }, [payload])

  function resetRequestIdentity() {
    idempotencyRef.current = null
    setPayload(null)
    setReviewing(false)
  }

  function deliveryLabel(minutes: number) {
    if (minutes <= 1) return 'Usually instant'
    if (minutes < 60) return `Up to ${minutes} minutes`
    const hours = Math.ceil(minutes / 60)
    return `Up to ${hours} ${hours === 1 ? 'hour' : 'hours'}`
  }

  async function post(path: string, body: Record<string, unknown>) {
    const controller = new AbortController()
    const deadline = setTimeout(() => controller.abort(), 35_000)
    try {
      const response = await fetch(path, {
        signal: controller.signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: JSON.stringify({ ...body, csrfToken }),
      })
      let data: PaidReportPayload | { success: false; error?: string } | null = null
      try {
        data = (await response.json()) as PaidReportPayload | { success: false; error?: string }
      } catch {
        throw new Error('We could not confirm the response. Check report history, or retry this same request.')
      }
      if (!response.ok || !data || data.success !== true) {
        const message = data && 'error' in data ? data.error : undefined
        // A gateway/server failure can happen after the order was accepted.
        if (response.status >= 500) throw new Error('The order response is uncertain.')
        throw new ReportRequestError(message ?? 'The paid report could not be submitted.')
      }
      return data
    } finally {
      clearTimeout(deadline)
    }
  }

  function reviewOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (locked) return
    setImeiTouched(true)
    const digits = deviceImei(imei)
    if (!product) return setError('Choose a service first.')
    if (!product.providerReady) return setError('This service is not available yet.')
    if (!digits) {
      setError(`Enter a valid ${IMEI_LENGTH}-digit IMEI.`)
      imeiRef.current?.focus()
      return
    }
    if (!affordable) return setError('Not enough credit for this report.')
    setError(null)
    setReviewing(true)
  }

  async function confirmOrder() {
    if (inFlight.current || payload) return
    const digits = deviceImei(imei)
    if (!product || !product.providerReady) return setError('This service is not available yet.')
    if (!digits) return setError(`Enter a valid ${IMEI_LENGTH}-digit IMEI.`)
    if (!affordable) return setError('Not enough credit for this report.')

    const idempotencyKey = idempotencyRef.current ?? crypto.randomUUID()
    idempotencyRef.current = idempotencyKey
    inFlight.current = true
    setBusy(true)
    setError(null)
    try {
      const result = await post('/api/imei/reports', { productCode: product.code, imei: digits, idempotencyKey })
      setPayload(result)
      setBalanceCents(result.credit.balanceCents)
      // Cleanup has its own short request so another tab's newer draft survives.
      // Offline cleanup falls back to the draft's TTL, never an uncertain order.
      void clearAcceptedDeviceIntentAction({ imei: digits, productCode: product.code }).catch(() => undefined)
      setUncertain(false)
      setReviewing(false)
      router.refresh()
    } catch (thrown) {
      const unknown = !(thrown instanceof ReportRequestError)
      setUncertain((previous) => previous || unknown)
      setError(unknown ? 'We could not confirm whether your order was received. Check report history before starting another order, or retry this same request safely.' : thrown.message)
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  async function refreshStatus() {
    if (!payload || payload.order.status !== 'processing') return
    setBusy(true)
    setError(null)
    try {
      const result = await post(`/api/imei/reports/${payload.order.id}`, {})
      setPayload(result)
      setBalanceCents(result.credit.balanceCents)
      router.refresh()
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'The report status could not be refreshed.')
    } finally {
      setBusy(false)
    }
  }

  async function continueToFunding() {
    if (locked || !product?.providerReady || affordable) return
    if (imei.trim() && !deviceImei(imei)) {
      setImeiTouched(true)
      setError('Enter a valid 15-digit IMEI, or clear it before adding credit.')
      imeiRef.current?.focus()
      return
    }
    setSavingDraft(true)
    setError(null)
    try {
      // Keep the device draft in the same secure handoff used by the homepage.
      // The top-up URL contains only the service code, never the customer's IMEI.
      const result = await saveDeviceIntentAction({ imei, productCode: product.code, domain: product.domain })
      if (result.error) {
        setError(result.error)
        return
      }
      router.push(`/user/add-funds?product=${encodeURIComponent(product.code)}`)
    } catch {
      setError('We could not save your selection. Please try again; no credit has been charged.')
    } finally {
      setSavingDraft(false)
    }
  }

  return (
    <div className="service-workbench">
      <form className="service-workbench-panel" onSubmit={reviewOrder} noValidate aria-busy={busy || savingDraft}>
        <nav className="service-workbench-tabs" aria-label="Service orders">
          <span className="service-workbench-tab is-current" aria-current="page"><Icon name="search" /> Order</span>
          <Link className="service-workbench-tab" href="/user/reports"><Icon name="clock" /> Order history</Link>
        </nav>
        <header className="service-workbench-heading">
          <span className="service-workbench-icon"><Icon name={domain === 'unlock' ? 'lock' : 'device'} /></span>
          <div>
            <h2>{domain === 'unlock' ? 'Unlock a device' : 'Check a device'}</h2>
            <p>Enter an IMEI, choose a service, then review your order.</p>
          </div>
          <div className="service-workbench-credit">
            <span>Available credit</span>
            <strong>{formatUsd(balanceCents)}</strong>
          </div>
        </header>

        <div className="service-workbench-body">
          {uncertain ? <Link className="link-arrow" href="/user/reports">Check report history</Link> : null}
          {error ? <p className="alert alert--error" role="alert"><Icon name="cross" /> <span>{error}</span></p> : null}

          <div className="field service-workbench-imei">
            <div className="service-workbench-label">
              <label htmlFor="paid-report-imei">IMEI number</label>
              <span className="service-workbench-validation" data-state={imeiInvalid ? 'invalid' : imeiValid ? 'valid' : undefined} aria-live="polite">
                {imeiInvalid ? 'Check number' : imeiValid ? 'Valid format' : '15 digits'}
              </span>
            </div>
            <div className="service-workbench-input" data-invalid={imeiInvalid || undefined}>
              <Icon name="device" />
              <input
                id="paid-report-imei"
                ref={imeiRef}
                disabled={locked}
                aria-invalid={imeiInvalid}
                aria-describedby="paid-report-imei-help"
                onBlur={() => setImeiTouched(true)}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                spellCheck={false}
                placeholder="Enter your 15-digit IMEI"
                value={imei}
                onChange={(event) => {
                  // Keep invalid characters visible so the customer can correct them.
                  setImei(event.currentTarget.value)
                  setError(null)
                  resetRequestIdentity()
                }}
              />
              {imei ? <button type="button" className="service-workbench-clear" aria-label="Clear IMEI" disabled={locked} onClick={() => {
                setImei('')
                setImeiTouched(false)
                setError(null)
                resetRequestIdentity()
                imeiRef.current?.focus()
              }}><Icon name="cross" /></button> : null}
            </div>
            <div className="service-workbench-help">
              <p className="field-note" id="paid-report-imei-help" data-state={imeiInvalid ? 'invalid' : undefined}>
                <Icon name="info" strokeWidth={1.9} />
                <span>{imeiInvalid ? 'Enter exactly 15 digits with a valid checksum. Only spaces or hyphens may separate digits.' : 'Find it in Settings or dial *#06#. IMEI only; serial numbers are not accepted.'}</span>
              </p>
              <span>{digitCount} / {IMEI_LENGTH}</span>
            </div>
          </div>

          <div className="service-workbench-service">
            <div className="service-workbench-domain" role="group" aria-label="Service type">
              <button type="button" aria-pressed={domain === 'imei_check'} disabled={locked} onClick={() => {
                if (domain === 'imei_check') return
                setDomain('imei_check')
                setProductCode('')
                setError(null)
                resetRequestIdentity()
              }}><Icon name="search" /> Phone Check</button>
              <button type="button" aria-pressed={domain === 'unlock'} disabled={locked} onClick={() => {
                if (domain === 'unlock') return
                setDomain('unlock')
                setProductCode('')
                setError(null)
                resetRequestIdentity()
              }}><Icon name="lock" /> Unlock</button>
            </div>
            <ServicePicker
              id="paid-report-service"
              label={domain === 'unlock' ? 'Unlock service' : 'Lookup service'}
              options={visibleProducts.map((entry) => ({
                code: entry.code,
                name: entry.name,
                summary: entry.summary,
                group: entry.group,
                priceCents: entry.priceCents,
                etaLabel: deliveryLabel(entry.etaMinutes),
                available: entry.providerReady,
              }))}
              value={productCode}
              disabled={locked}
              onChange={(code) => {
                if (locked) return
                setProductCode(code)
                setError(null)
                resetRequestIdentity()
              }}
            />
          </div>

          {product ? (
            <section className="service-workbench-selection" aria-label="Selected service">
              <div className="service-workbench-selection-copy">
                <h3>{product.name}</h3>
                <p>{product.summary}</p>
              </div>
              <dl className="service-workbench-quote">
                <div><dt>Price</dt><dd>{formatUsd(product.priceCents)}</dd></div>
                <div><dt>Estimated delivery</dt><dd>{deliveryLabel(product.etaMinutes)}</dd></div>
              </dl>
            </section>
          ) : null}

          {payload ? null : reviewing && product ? (
            <section className="order-review" aria-labelledby="paid-report-review-title">
              <div className="card-topline">
                <div>
                  <span className="kicker">Confirm order</span>
                  <h3 className="t-card" id="paid-report-review-title" tabIndex={-1} ref={reviewRef}>{product.name}</h3>
                </div>
                <span className="badge">Review</span>
              </div>
              <p className="t-small">IMEI {maskIdentifier(digits ?? '')}</p>
              <div className="quote">
                <div><span className="label">Price</span><span className="value">{formatUsd(product.priceCents)}</span></div>
                <div><span className="label">Estimated delivery</span><span className="value">{deliveryLabel(product.etaMinutes)}</span></div>
                <div><span className="label">Billing</span><span className="value">Charge on delivery</span></div>
              </div>
              <p className="t-small">Your credit is held, not spent. You are charged only when the report is delivered; if it cannot be, the hold is released.</p>
              <div className="order-review-actions">
                <button className="button button--primary" type="button" disabled={busy} onClick={confirmOrder}>
                  <Icon name="file" strokeWidth={1.9} />
                  {busy ? 'Submitting…' : uncertain ? 'Retry the same request' : `Confirm and order ${formatUsd(product.priceCents)}`}
                </button>
                <button className="button button--quiet" type="button" disabled={busy || uncertain} onClick={() => setReviewing(false)}>
                  Back to edit
                </button>
              </div>
            </section>
          ) : (
            <>
              <div className="service-workbench-actions">
                {product && product.providerReady && !affordable ? (
                  <button className="button button--primary" type="button" disabled={locked} onClick={continueToFunding}>
                    <Icon name="plus" strokeWidth={1.9} />
                    {savingDraft ? 'Saving selection…' : `Add ${formatUsd(product.priceCents - balanceCents)} to continue`}
                  </button>
                ) : (
                  <button
                    className="button button--primary"
                    type="submit"
                    disabled={locked || !product?.providerReady}
                  >
                    <Icon name="file" strokeWidth={1.9} />
                    {product ? `Review order · ${formatUsd(product.priceCents)}` : 'Choose a service to continue'}
                  </button>
                )}
                {!product ? <p className="t-small">{visibleProducts.length > 0 ? 'Choose a service above to see its price and delivery estimate.' : 'No services in this category are available right now. Choose another category or contact support.'}</p> : null}
                {product && !product.providerReady ? (
                  <p className="t-small" role="status">This service is not open for ordering yet. Choose an available service or contact support for help.</p>
                ) : null}
                {product && product.providerReady && !affordable ? (
                  <p className="t-small" role="status">
                    You need {formatUsd(product.priceCents - balanceCents)} more credit. No minimum top-up.
                    {paymentMethods.length > 0 ? ` Payment: ${paymentMethods.join(', ')}; transfers are verified before credit is available.` : ' Top-ups are currently unavailable; contact support for help.'}
                    {' '}Your IMEI and selected service are kept privately for 15 minutes. You will review and confirm the order after returning.
                  </p>
                ) : null}
              </div>
            </>
          )}
          <p className="service-workbench-privacy">
            <Icon name="shield" /> <span>Credit is reserved when you confirm. A delivered result uses that credit; an undeliverable service returns it to your account balance. If the result is uncertain, the credit stays reserved while we check. You can follow the status in service history.</span>
          </p>
        </div>
      </form>

      {payload ? (
        <section className="card service-workbench-result" role="status" ref={resultRef} tabIndex={-1}>
          <div className="card-topline">
            <span className="kicker"><Icon name="file" /> {payload.order.productName}</span>
            <span className={payload.order.status === 'completed' ? 'badge badge--success' : 'badge'}>{statusLabel(payload.order.status)}</span>
          </div>
          <h3 className="t-card">IMEI {payload.order.maskedImei}</h3>
          <p className="t-small">
            {payload.order.message ?? (payload.order.status === 'completed'
              ? 'The result is ready and the held credit has been charged.'
              : payload.order.status === 'refunded'
                ? 'The service could not be delivered. The reserved credit was returned to your account balance.'
                : payload.order.status === 'manual_review'
                  ? 'The result needs review. Your credit remains reserved while we check.'
                  : 'The request is still processing.')}
          </p>
          <div className="service-workbench-result-actions">
            <Link className="button button--primary" href={`/user/reports/${payload.order.id}`}>View result</Link>
            <button className="button button--quiet" type="button" disabled={busy} onClick={() => {
              resetRequestIdentity()
              setImei('')
              setImeiTouched(false)
              setError(null)
            }}>Start another service</button>
            {payload.order.status === 'processing' ? (
              <button className="button button--quiet" type="button" disabled={busy} onClick={refreshStatus}>
                {busy ? 'Refreshing…' : 'Refresh status'}
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  )
}
