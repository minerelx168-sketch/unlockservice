'use client'

import Link from 'next/link'
import { useMemo, useRef, useState, type FormEvent } from 'react'
import { groupImei, IMEI_LENGTH, luhnValid, normalizeImei } from '@/lib/imei'
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
}: {
  products: Product[]
  csrfToken: string
  availableCents: number
  initialProductCode?: string
}) {
  const initialCode = products.some((product) => product.code === initialProductCode)
    ? initialProductCode ?? ''
    : products[0]?.code ?? ''
  const [productCode, setProductCode] = useState(initialCode)
  const [imei, setImei] = useState('')
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
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
  const balanceCents = payload?.credit.balanceCents ?? availableCents
  const affordable = !product || product.priceCents <= balanceCents

  function resetRequestIdentity() {
    idempotencyRef.current = null
    setPayload(null)
  }

  async function post(path: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...body, csrfToken }),
    })
    let data: PaidReportPayload | { success: false; error?: string } | null = null
    try {
      data = (await response.json()) as PaidReportPayload | { success: false; error?: string }
    } catch {
      throw new Error('The server returned an unreadable response.')
    }
    if (!response.ok || !data || data.success !== true) {
      const message = data && 'error' in data ? data.error : undefined
      throw new Error(message ?? 'The paid report could not be submitted.')
    }
    return data
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const digits = normalizeImei(imei)
    if (!product) return setError('Choose a paid report first.')
    if (!product.providerReady) return setError('This report is not available yet.')
    if (digits.length !== IMEI_LENGTH || !luhnValid(digits)) return setError(`Enter a valid ${IMEI_LENGTH}-digit IMEI.`)
    if (!affordable) return setError('Not enough credit for this report.')

    const idempotencyKey = idempotencyRef.current ?? crypto.randomUUID()
    idempotencyRef.current = idempotencyKey
    setBusy(true)
    setError(null)
    try {
      const result = await post('/api/imei/reports', { productCode: product.code, imei: digits, idempotencyKey })
      setPayload(result)
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'The paid report could not be submitted.')
    } finally {
      setBusy(false)
    }
  }

  async function refreshStatus() {
    if (!payload || payload.order.status !== 'processing') return
    setBusy(true)
    setError(null)
    try {
      setPayload(await post(`/api/imei/reports/${payload.order.id}`, {}))
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
        <span>Paid Provider reports are not active yet. The Free IMEI Check remains available.</span>
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <form className="panel" onSubmit={submit} noValidate>
        <header>
          <h2>New paid report</h2>
          <span>{formatUsd(balanceCents)} available</span>
        </header>

        <div className="panel-body" style={{ display: 'grid', gap: 20 }}>
          {error ? <p className="alert alert--error" role="alert"><Icon name="cross" /> <span>{error}</span></p> : null}

          <div className="field">
            <label htmlFor="paid-report-search">Search paid IMEI reports</label>
            <input
              id="paid-report-search"
              type="search"
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Apple, Samsung, blacklist, carrier…"
              autoComplete="off"
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
                  <span className="t-small" style={{ fontSize: 12.5 }}>{entry.summary}</span>
                </span>
                <span className="price">{formatUsd(entry.priceCents)}</span>
              </button>
            ))}
            {visibleProducts.length === 0 ? (
              <p className="alert" role="status"><Icon name="info" /> <span>No paid IMEI reports match that search.</span></p>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="paid-report-imei">IMEI number</label>
            <input
              id="paid-report-imei"
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
            <p className="field-note">
              <Icon name="shield" strokeWidth={1.9} />
              <span>The raw IMEI is sent only for this Provider request. The database keeps a fingerprint and masked display value.</span>
            </p>
          </div>

          {product ? (
            <div className="quote">
              <div><span className="label">Price</span><span className="value">{formatUsd(product.priceCents)}</span></div>
              <div><span className="label">Catalog ETA</span><span className="value">Up to {product.etaMinutes} min</span></div>
              <div><span className="label">Billing</span><span className="value">Charge on delivery</span></div>
            </div>
          ) : null}

          <button className="button button--primary" type="submit" disabled={busy || !product?.providerReady || !affordable}>
            <Icon name="file" strokeWidth={1.9} />
            {busy ? 'Submitting…' : product ? `Order report for ${formatUsd(product.priceCents)}` : 'Choose a report'}
          </button>

          {!affordable ? <Link className="link-arrow" href="/user/add-funds">Add funds <Icon name="arrowRight" /></Link> : null}
          <p className="t-small" style={{ fontSize: 12.5 }}>
            Credit is held before submission and charged only after a usable report is delivered. A clear terminal failure releases the hold. A timeout or uncertain Provider response goes to manual review and is never retried automatically.
          </p>
        </div>
      </form>

      {payload ? (
        <section className="card" role="status">
          <div className="card-topline">
            <span className="kicker"><Icon name="file" /> {payload.order.productName}</span>
            <span className={payload.order.status === 'completed' ? 'badge badge--success' : 'badge'}>{statusLabel(payload.order.status)}</span>
          </div>
          <h3 className="t-card">IMEI {payload.order.maskedImei}</h3>
          <p className="t-small">
            {payload.order.message ?? (payload.order.status === 'completed'
              ? 'The report is ready and the held credit has been charged.'
              : payload.order.status === 'refunded'
                ? 'The Provider could not deliver the report and the full hold was released.'
                : payload.order.status === 'manual_review'
                  ? 'The Provider response was uncertain. Credit remains held while the request is reviewed.'
                  : 'The request is still processing.')}
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
            <Link className="button button--quiet" href={`/user/reports/${payload.order.id}`}>View report</Link>
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
