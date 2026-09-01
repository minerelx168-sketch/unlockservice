'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatUsd } from '@/lib/money'
import { Icon } from './icons'
import { formatEta, OrderStatusBadge } from './order-status'

type Brand = { id: number; name: string; delivery: 'remote' | 'code' }
type Carrier = { id: number; name: string; country: string; priceCents: number; etaHours: number }
type DeviceService = {
  id: number
  name: string
  summary: string
  priceCents: number
  etaHours: number
  brandIds: number[]
}

type OrderPayload = {
  success: boolean
  orderId: number
  status: 'processing' | 'delivered' | 'unavailable'
  title: string
  imei: string
  priceCents: number
  etaHours: number
  delivery: 'remote' | 'code'
  unlockCode: string | null
  result: Record<string, unknown> | null
  message?: string
  credit: { chargedCents: number; refundedCents: number; balanceCents: number }
}

/**
 * Two endpoints, as the reference splits them: one places the order, the
 * other checks in on it. A real unlock takes hours, so the poll here is a
 * courtesy — it catches the fast ones while the customer is still on the
 * page, and everything else waits in Orders.
 */
/**
 * Identifies one attempt at placing an order, so the server can recognise a
 * resend. randomUUID needs a secure context, which every page that reaches
 * this console already has; the fallback keeps a plain-HTTP dev host working.
 */
function newAttemptKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  return `attempt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
}

const POLL_INTERVAL_MS = 2_000
const POLL_COURTESY_MS = 30_000

export function OrderConsole({
  brands,
  carriers,
  services,
  csrfToken,
  availableCents,
  defaultEmail,
  maintenance,
  initialImei,
  initialCarrierId,
}: {
  brands: Brand[]
  carriers: Carrier[]
  services: DeviceService[]
  csrfToken: string
  availableCents: number
  defaultEmail: string
  maintenance: { active: boolean; message: string }
  /** Carried over from the homepage quote, so the phone is entered once. */
  initialImei?: string
  initialCarrierId?: number
}) {
  const [kind, setKind] = useState<'carrier_unlock' | 'device_service'>('carrier_unlock')
  const [imei, setImei] = useState(initialImei ?? '')
  const [brandId, setBrandId] = useState<number>(brands[0]?.id ?? 0)
  const [carrierId, setCarrierId] = useState<number>(
    initialCarrierId && carriers.some((entry) => entry.id === initialCarrierId)
      ? initialCarrierId
      : (carriers[0]?.id ?? 0),
  )
  const [serviceId, setServiceId] = useState<number | null>(null)
  const [email, setEmail] = useState(defaultEmail)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [order, setOrder] = useState<OrderPayload | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  /* Held across retries of the same attempt so a double click or a resend
     after a dropped connection resolves to the order already placed rather
     than a second one with a second hold. Cleared once an order comes back,
     and whenever the customer changes what they are ordering. */
  const attemptKeyRef = useRef<string | null>(null)
  const router = useRouter()

  /* Changing what is being ordered starts a new attempt: the old key would
     otherwise resolve a retry to the order the customer just edited away
     from. */
  useEffect(() => {
    attemptKeyRef.current = null
  }, [kind, imei, brandId, carrierId, serviceId, email])

  const brand = brands.find((entry) => entry.id === brandId) ?? null
  const carrier = carriers.find((entry) => entry.id === carrierId) ?? null

  const offeredServices = useMemo(
    () => services.filter((service) => service.brandIds.length === 0 || service.brandIds.includes(brandId)),
    [services, brandId],
  )
  const service = offeredServices.find((entry) => entry.id === serviceId) ?? null

  const priceCents = kind === 'carrier_unlock' ? (carrier?.priceCents ?? 0) : (service?.priceCents ?? 0)
  const etaHours = kind === 'carrier_unlock' ? (carrier?.etaHours ?? 0) : (service?.etaHours ?? 0)
  const chosen = kind === 'carrier_unlock' ? Boolean(carrier) : Boolean(service)
  const affordable = !chosen || priceCents <= availableCents

  const byCountry = useMemo(() => {
    const groups = new Map<string, Carrier[]>()
    for (const entry of carriers) {
      const list = groups.get(entry.country) ?? []
      list.push(entry)
      groups.set(entry.country, list)
    }
    return [...groups.entries()]
  }, [carriers])

  async function post(path: string, body: Record<string, unknown>, signal: AbortSignal) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...body, csrfToken }),
      signal,
    })
    let data: (OrderPayload & { error?: string }) | null = null
    try {
      data = (await response.json()) as OrderPayload & { error?: string }
    } catch {
      throw new Error('The server returned an unreadable response.')
    }
    /* Never trust the HTTP status alone — success is the field. */
    if (!response.ok || data.success === false) {
      throw new Error(data.error ?? data.message ?? 'The order could not be placed.')
    }
    return data
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (!chosen) {
      setError(kind === 'carrier_unlock' ? 'Pick the network first.' : 'Pick a service first.')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError(null)
    setOrder(null)

    attemptKeyRef.current ??= newAttemptKey()

    try {
      let payload = await post(
        '/api/orders',
        {
          kind,
          brandId,
          carrierId: kind === 'carrier_unlock' ? carrierId : undefined,
          serviceId: kind === 'device_service' ? serviceId : undefined,
          imei,
          email,
          idempotencyKey: attemptKeyRef.current,
        },
        controller.signal,
      )
      attemptKeyRef.current = null
      setOrder(payload)
      router.refresh()

      const deadline = Date.now() + POLL_COURTESY_MS
      while (payload.status === 'processing' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        if (controller.signal.aborted) return
        payload = await post('/api/orders/status', { orderId: payload.orderId }, controller.signal)
        setOrder(payload)
      }
      router.refresh()
    } catch (thrown) {
      if (!controller.signal.aborted) {
        setError(thrown instanceof Error ? thrown.message : 'Something went wrong.')
        router.refresh()
      }
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  if (maintenance.active) {
    return (
      <p className="alert" role="status">
        <Icon name="info" strokeWidth={1.9} />
        <span>{maintenance.message}</span>
      </p>
    )
  }

  return (
    <div style={{ display: 'grid', gap: 20 }}>
      <form className="panel" onSubmit={submit}>
        <header>
          <h2>New order</h2>
          <span>{carriers.length} networks · {brands.length} brands</span>
        </header>

        <div className="panel-body" style={{ display: 'grid', gap: 20 }}>
          {error ? (
            <p className="alert alert--error" role="alert">
              <Icon name="info" strokeWidth={1.9} />
              <span>{error}</span>
            </p>
          ) : null}

          <div className="segmented" role="group" aria-label="What do you need">
            <button
              type="button"
              aria-pressed={kind === 'carrier_unlock'}
              onClick={() => setKind('carrier_unlock')}
            >
              Network unlock
            </button>
            <button
              type="button"
              aria-pressed={kind === 'device_service'}
              onClick={() => setKind('device_service')}
            >
              Other services
            </button>
          </div>

          <div className="field">
            <label htmlFor="imei">Device IMEI</label>
            <input
              id="imei"
              className="mono"
              value={imei}
              onChange={(event) => setImei(event.currentTarget.value)}
              placeholder="354909000000095"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <p className="field-note" data-state="idle">
              <Icon name="info" strokeWidth={1.9} />
              <span>
                Dial <span className="t-mono">*#06#</span> on the device to display it. Try{' '}
                <button type="button" className="linkish" onClick={() => setImei('354909000000095')}>
                  354909000000095
                </button>{' '}
                for a delivered order, or{' '}
                <button type="button" className="linkish" onClick={() => setImei('354909000000020')}>
                  354909000000020
                </button>{' '}
                for one the carrier refuses.
              </span>
            </p>
          </div>

          <div className="field-row">
            <div className="field">
              <label htmlFor="brand">Brand</label>
              <select
                id="brand"
                value={brandId}
                onChange={(event) => {
                  setBrandId(Number(event.currentTarget.value))
                  setServiceId(null)
                }}
              >
                {brands.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </div>

            {kind === 'carrier_unlock' ? (
              <div className="field">
                <label htmlFor="carrier">Locked to</label>
                <select
                  id="carrier"
                  value={carrierId}
                  onChange={(event) => setCarrierId(Number(event.currentTarget.value))}
                >
                  {byCountry.map(([country, list]) => (
                    <optgroup key={country} label={country}>
                      {list.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.name} — {formatUsd(entry.priceCents)}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          {kind === 'device_service' ? (
            <div className="picker-list">
              {offeredServices.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className="picker-option"
                  aria-pressed={entry.id === serviceId}
                  onClick={() => setServiceId(entry.id)}
                >
                  <span>
                    <strong>{entry.name}</strong>
                    <br />
                    <span className="t-small" style={{ fontSize: 12.5 }}>
                      {entry.summary}
                    </span>
                  </span>
                  <span className="price">{formatUsd(entry.priceCents)}</span>
                </button>
              ))}
            </div>
          ) : null}

          <div className="field">
            <label htmlFor="email">Send the result to</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />
          </div>

          {chosen ? (
            <div className="quote">
              <div>
                <span className="label">Price</span>
                <span className="value">{formatUsd(priceCents)}</span>
              </div>
              <div>
                <span className="label">Turnaround</span>
                <span className="value">{formatEta(etaHours)}</span>
              </div>
              <div>
                <span className="label">Delivered as</span>
                <span className="value">
                  {brand?.delivery === 'remote' ? 'Remote release' : 'Unlock code'}
                </span>
              </div>
            </div>
          ) : null}

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <button className="button button--primary" type="submit" disabled={busy || !affordable}>
              <Icon name="bolt" strokeWidth={1.9} />
              {busy ? 'Placing the order…' : chosen ? `Order for ${formatUsd(priceCents)}` : 'Place order'}
            </button>
            {busy ? (
              <button className="button button--quiet" type="button" onClick={() => abortRef.current?.abort()}>
                Stop waiting
              </button>
            ) : null}
            {!affordable ? (
              <span className="t-small" style={{ color: 'var(--danger)' }}>
                Not enough credit for this order.
              </span>
            ) : null}
          </div>

          <p className="t-small" style={{ fontSize: 12.5 }}>
            Your credit is held, not spent. If the carrier will not release the device it goes back in
            full — that is the whole guarantee.
          </p>
        </div>
      </form>

      {order ? <OrderResult payload={order} /> : null}
    </div>
  )
}

function OrderResult({ payload }: { payload: OrderPayload }) {
  const entries = Object.entries(payload.result ?? {}).filter(
    ([key]) => key !== 'note' && key !== 'source' && key !== 'identifier',
  )
  const note = typeof payload.result?.note === 'string' ? payload.result.note : null

  return (
    <section className="panel">
      <header>
        <h2>{payload.title}</h2>
        <span>
          {payload.status === 'delivered'
            ? `${formatUsd(payload.credit.chargedCents)} charged · ${formatUsd(payload.credit.balanceCents)} left`
            : payload.status === 'unavailable'
              ? `${formatUsd(payload.credit.refundedCents)} refunded in full`
              : `Held · ${formatEta(payload.etaHours)}`}
        </span>
      </header>
      <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <OrderStatusBadge status={payload.status} />
          <span className="t-mono" style={{ fontSize: 13 }}>
            {payload.imei}
          </span>
          <span className="t-small">Order #{payload.orderId}</span>
        </div>

        {payload.unlockCode ? (
          <div className="code-slab">
            <span className="label">Unlock code</span>
            <span className="value">{payload.unlockCode}</span>
          </div>
        ) : null}

        {payload.status === 'processing' ? (
          <p className="alert" role="status">
            <Icon name="info" strokeWidth={1.9} />
            <span>
              The order is with the carrier. You can close this page — the result lands in Orders and
              goes to {payload.imei ? 'your email' : 'you'} when it is ready.
            </span>
          </p>
        ) : null}

        {payload.message ? (
          <p className="alert alert--error" role="status">
            <Icon name="info" strokeWidth={1.9} />
            <span>{payload.message}</span>
          </p>
        ) : null}

        {entries.length > 0 ? (
          <dl className="result-grid">
            {entries.map(([key, value]) => (
              <div key={key}>
                <dt>{key.replace(/([A-Z])/g, ' $1')}</dt>
                <dd>{String(value)}</dd>
              </div>
            ))}
          </dl>
        ) : null}

        {note ? <p className="t-small">{note}</p> : null}
      </div>
    </section>
  )
}
