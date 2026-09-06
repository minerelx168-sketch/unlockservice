'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { groupImei, IMEI_LENGTH, luhnValid, maskIdentifier, normalizeImei } from '@/lib/imei'
import { formatUsd } from '@/lib/money'
import { Icon } from './icons'

type Product = {
  code: string
  name: string
  summary: string
  group: string
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
  if (status === 'completed') return 'Report ready'
  if (status === 'refunded') return 'Credit returned'
  if (status === 'manual_review') return 'Manual review'
  return 'Processing'
}

export function PaidReportConsole({
  products,
  csrfToken,
  availableCents,
  initialProductCode,
  minTopupCents,
  paymentMethods,
}: {
  products: Product[]
  csrfToken: string
  availableCents: number
  initialProductCode?: string
  minTopupCents: number
  paymentMethods: string[]
}) {
  const router = useRouter()
  const initialCode = products.some((product) => product.code === initialProductCode)
    ? initialProductCode ?? ''
    : products[0]?.code ?? ''
  const [productCode, setProductCode] = useState(initialCode)
  const [imei, setImei] = useState('')
  const [search, setSearch] = useState('')
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
  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return products
    return products.filter((entry) =>
      `${entry.name} ${entry.summary} ${entry.group}`.toLowerCase().includes(query),
    )
  }, [products, search])
  const affordable = !product || product.priceCents <= balanceCents
  const digits = normalizeImei(imei)
  const imeiInvalid = imeiTouched && (digits.length !== IMEI_LENGTH || !luhnValid(digits))
  const locked = busy || uncertain || payload !== null

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
    const digits = normalizeImei(imei)
    if (!product) return setError('Choose a paid report first.')
    if (!product.providerReady) return setError('This report is not available yet.')
    if (digits.length !== IMEI_LENGTH || !luhnValid(digits)) {
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
    const digits = normalizeImei(imei)
    if (!product || !product.providerReady) return setError('This report is not available yet.')
    if (digits.length !== IMEI_LENGTH || !luhnValid(digits)) return setError(`Enter a valid ${IMEI_LENGTH}-digit IMEI.`)
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

  if (products.length === 0) {
    return (
      <p className="alert" role="status">
        <Icon name="info" strokeWidth={1.9} />
        <span>No paid reports are available right now. Use the Free IMEI Check to validate your number, or contact support for help.</span>
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <form className="panel" onSubmit={reviewOrder} noValidate aria-busy={busy}>
        <header>
          <h2>New paid report</h2>
          <span>{formatUsd(balanceCents)} available</span>
        </header>

        <div className="panel-body" style={{ display: 'grid', gap: 20 }}>
          {uncertain ? <Link className="link-arrow" href="/user/reports">Check report history</Link> : null}
          {error ? <p className="alert alert--error" role="alert"><Icon name="cross" /> <span>{error}</span></p> : null}

          {product ? (
            <section className="checkout-selection" aria-label="Selected report">
              <span className="kicker">Selected report</span>
              <h3 className="t-card">{product.name}</h3>
              <p className="t-small">{product.summary}</p>
              <div className="quote">
                <div><span className="label">Price</span><span className="value">{formatUsd(product.priceCents)}</span></div>
                <div><span className="label">Estimated delivery</span><span className="value">{deliveryLabel(product.etaMinutes)}</span></div>
              </div>
            </section>
          ) : null}

          <details className="checkout-picker" open={initialProductCode ? undefined : true}>
            <summary>Change report · {products.length} options</summary>
          <div className="field">
            <label htmlFor="paid-report-search">Search paid IMEI reports</label>
            <input
              id="paid-report-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Apple, Samsung, blacklist, carrier…"
              autoComplete="off"
              disabled={locked}
            />
            <p className="field-note">
              <Icon name="search" strokeWidth={1.9} />
              <span>{visibleProducts.length} of {products.length} reports shown</span>
            </p>
          </div>

          <div className="picker-list">
            {visibleProducts.map((entry) => (
              <button
                key={entry.code}
                type="button"
                disabled={locked}
                className="picker-option"
                aria-pressed={entry.code === productCode}
                onClick={() => {
                  setProductCode(entry.code)
                  setError(null)
                  resetRequestIdentity()
                }}
              >
                <span>
                  <span className="t-micro">{entry.group}</span>
                  <br />
                  <strong>{entry.name}</strong>
                  <br />
                  <span className="t-small">{entry.summary}</span>
                </span>
                <span className="price">{formatUsd(entry.priceCents)}</span>
              </button>
            ))}
            {visibleProducts.length === 0 ? (
              <p className="alert" role="status"><Icon name="info" /> <span>No paid IMEI reports match that search.</span></p>
            ) : null}
          </div>

          </details>

          {affordable ? <div className="field">
            <label htmlFor="paid-report-imei">IMEI number</label>
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
              placeholder="35 490912 345678 9"
              value={imei}
              onChange={(event) => {
                const digits = normalizeImei(event.currentTarget.value)
                setImei(groupImei(digits))
                setError(digits.length === IMEI_LENGTH && !luhnValid(digits) ? 'That IMEI checksum does not match.' : null)
                resetRequestIdentity()
              }}
            />
            <p className="field-note" id="paid-report-imei-help" aria-live="polite">
              <Icon name="shield" strokeWidth={1.9} />
              <span>{imeiInvalid ? 'Enter 15 digits with a valid checksum. Find the IMEI in Settings or dial *#06#.' : 'Find your IMEI in Settings or dial *#06#. Reports and history show a masked number.'}</span>
            </p>
          </div> : null}

          {payload ? null : reviewing && product ? (
            <section className="order-review" aria-labelledby="paid-report-review-title">
              <div className="card-topline">
                <div>
                  <span className="kicker">Confirm order</span>
                  <h3 className="t-card" id="paid-report-review-title" tabIndex={-1} ref={reviewRef}>{product.name}</h3>
                </div>
                <span className="badge">Review</span>
              </div>
              <p className="t-small">IMEI {maskIdentifier(normalizeImei(imei))}</p>
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
              {/* When credit is the only thing in the way, the button says so
                  and does the thing that clears it. A greyed-out control with
                  a small "add funds" link beside it asks the customer to work
                  out for themselves why they cannot buy. */}
              {product && product.providerReady && !affordable ? (
                <Link className="button button--primary" href={`/user/add-funds?product=${encodeURIComponent(product.code)}`}>
                  <Icon name="arrowRight" strokeWidth={1.9} />
                  Add credit to continue
                </Link>
              ) : (
                <button
                  className="button button--primary"
                  type="submit"
                  disabled={busy || !product?.providerReady}
                >
                  <Icon name="file" strokeWidth={1.9} />
                  {product ? `Review order · ${formatUsd(product.priceCents)}` : 'Choose a report'}
                </button>
              )}

              {/* Every reason a control above is unavailable, stated next to
                  it rather than left to be inferred from the grey. */}
              {product && !product.providerReady ? (
                <p className="t-small" role="status">
                  This report is not open for ordering yet — the supplier behind it has not been
                  verified. Nothing here can be charged in the meantime.
                </p>
              ) : null}
              {product && product.providerReady && !affordable ? (
                <p className="t-small" role="status">
                  Your balance is {formatUsd(balanceCents)} and this report costs{' '}
                  {formatUsd(product.priceCents)}. Minimum top-up: {formatUsd(minTopupCents)}.
                  {paymentMethods.length > 0 ? ` Payment: ${paymentMethods.join(', ')}; transfers are verified before credit is available.` : ' Top-ups are currently unavailable; contact support for help.'}
                  {' '}Add credit first, then enter your IMEI when you return to this report.
                </p>
              ) : null}
            </>
          )}
          <p className="t-small">
            Credit is reserved when you confirm. A delivered report uses that credit; an undeliverable report returns it to your account balance. If the result is uncertain, the credit stays reserved while we check. You can follow the status in report history.
          </p>
        </div>
      </form>

      {payload ? (
        <section className="card" role="status" ref={resultRef} tabIndex={-1}>
          <div className="card-topline">
            <span className="kicker"><Icon name="file" /> {payload.order.productName}</span>
            <span className={payload.order.status === 'completed' ? 'badge badge--success' : 'badge'}>{statusLabel(payload.order.status)}</span>
          </div>
          <h3 className="t-card">IMEI {payload.order.maskedImei}</h3>
          <p className="t-small">
            {payload.order.message ?? (payload.order.status === 'completed'
              ? 'The report is ready and the held credit has been charged.'
              : payload.order.status === 'refunded'
                ? 'The report could not be delivered. The reserved credit was returned to your account balance.'
                : payload.order.status === 'manual_review'
                  ? 'The result needs review. Your credit remains reserved while we check.'
                  : 'The request is still processing.')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link className="button button--primary" href={`/user/reports/${payload.order.id}`}>View report</Link>
            <button className="button button--quiet" type="button" disabled={busy} onClick={() => {
              resetRequestIdentity()
              setImei('')
              setImeiTouched(false)
              setError(null)
            }}>Start another report</button>
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
