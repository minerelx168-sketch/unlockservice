'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState } from 'react'
import { formatUsd } from '@/lib/money'
import { Icon } from './icons'

type Service = { id: number; name: string; sellPriceCents: number; identifierType: string }

type CheckPayload = {
  success: boolean
  logId: number
  status: 'pending' | 'success' | 'error'
  identifier: string
  service: { id: number; name: string }
  sellPriceCents: number
  response: Record<string, unknown> | null
  message?: string
  credit: {
    beforeCents: number
    heldCents: number
    chargedCents: number
    refundedCents: number
    balanceCents: number
  }
}

/**
 * Two endpoints, exactly as the observed system splits them: one submits
 * the order, another polls it. The cadence is tighter than the original
 * 4 × 10s ceiling, which its own notes flag as too short — the shape is
 * the same, the wait is just less likely to run out.
 */
const POLL_INTERVAL_MS = 2_000
const POLL_CEILING_MS = 60_000

/**
 * The mock provider branches on the last digit, so these three walk the
 * three outcomes without hunting for an identifier that passes Luhn.
 */
const SAMPLES = [
  { imei: '354909000000095', label: 'answers immediately' },
  { imei: '354909000000012', label: 'goes pending, then resolves' },
  { imei: '354909000000020', label: 'fails — credit refunded' },
]

const PROGRESS = [
  'Connecting to the provider…',
  'The provider is checking this device…',
  'Preparing your device information…',
]

export function CheckConsole({
  services,
  csrfToken,
  availableCents,
  preferredKey,
  maintenance,
}: {
  services: Service[]
  csrfToken: string
  availableCents: number
  preferredKey: string
  maintenance: { active: boolean; message: string }
}) {
  const [query, setQuery] = useState('')
  const [serviceId, setServiceId] = useState<number | null>(null)
  const [identifier, setIdentifier] = useState('')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<CheckPayload | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const router = useRouter()

  /* The last service used is remembered per account, as the observed
     picker does — most people run the same check over and over. */
  useEffect(() => {
    try {
      const stored = localStorage.getItem(preferredKey)
      if (stored) setServiceId(Number(stored))
    } catch {
      /* private mode */
    }
  }, [preferredKey])

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => setProgress((step) => (step + 1) % PROGRESS.length), 10_000)
    return () => clearInterval(timer)
  }, [busy])

  const selected = services.find((service) => service.id === serviceId) ?? null

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return services
    return services.filter((service) => service.name.toLowerCase().includes(needle))
  }, [query, services])

  const affordable = selected ? selected.sellPriceCents <= availableCents : true

  function choose(service: Service) {
    setServiceId(service.id)
    setError(null)
    try {
      localStorage.setItem(preferredKey, String(service.id))
    } catch {
      /* private mode */
    }
  }

  async function post(path: string, body: Record<string, unknown>, signal: AbortSignal) {
    const response = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
      credentials: 'same-origin',
      body: JSON.stringify({ ...body, csrfToken }),
      signal,
    })
    let data: (CheckPayload & { error?: string }) | null = null
    try {
      data = (await response.json()) as CheckPayload & { error?: string }
    } catch {
      throw new Error('The server returned an unreadable response.')
    }
    /* Never trust the HTTP status alone — success is the field. */
    if (!response.ok || data.success === false) {
      throw new Error(data.error ?? data.message ?? 'The check could not be completed.')
    }
    return data
  }

  async function run(event: React.FormEvent) {
    event.preventDefault()
    if (!selected) {
      setError('Pick a service first.')
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setProgress(0)
    setError(null)
    setResult(null)

    try {
      let payload = await post('/api/checks', { serviceId: selected.id, identifier }, controller.signal)

      const deadline = Date.now() + POLL_CEILING_MS
      while (payload.status === 'pending' && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
        if (controller.signal.aborted) return
        payload = await post('/api/checks/status', { logId: payload.logId }, controller.signal)
      }

      setResult(payload)
      /* The balance in the shell is server-rendered, so it has to be told
         that the ledger moved. */
      router.refresh()
      if (payload.status === 'pending') {
        setError('The provider is still working. Your credit stays held — open History in a moment.')
      }
    } catch (thrown) {
      if (controller.signal.aborted) {
        setError('Cancelled. Your credit is protected; check History before trying again.')
      } else {
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
      <form className="panel" onSubmit={run}>
        <header>
          <h2>New check</h2>
          <span>{services.length} services available</span>
        </header>

        <div className="panel-body" style={{ display: 'grid', gap: 20 }}>
          {error ? (
            <p className="alert alert--error" role="alert">
              <Icon name="info" strokeWidth={1.9} />
              <span>{error}</span>
            </p>
          ) : null}

          <div className="picker">
            <div className="field">
              <label htmlFor="service-search">Service</label>
              <input
                id="service-search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                placeholder="Filter by name…"
                autoComplete="off"
                style={{ fontFamily: 'var(--font-body)', letterSpacing: 'normal' }}
              />
            </div>

            <div className="picker-list">
              {filtered.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  className="picker-option"
                  aria-pressed={service.id === serviceId}
                  onClick={() => choose(service)}
                >
                  <span>{service.name}</span>
                  <span className="price">{formatUsd(service.sellPriceCents)}</span>
                </button>
              ))}
              {filtered.length === 0 ? <p className="empty">No service matches that.</p> : null}
            </div>
          </div>

          <div className="field">
            <label htmlFor="identifier">
              {selected?.identifierType === 'serial'
                ? 'Serial number'
                : selected?.identifierType === 'both'
                  ? 'IMEI or serial number'
                  : 'IMEI'}
            </label>
            <input
              id="identifier"
              className="mono"
              value={identifier}
              onChange={(event) => setIdentifier(event.currentTarget.value)}
              placeholder="354909123456789"
              autoComplete="off"
              spellCheck={false}
              required
            />
            <p className="field-note" data-state="idle">
              <Icon name="info" strokeWidth={1.9} />
              <span>
                Sample identifiers:{' '}
                {SAMPLES.map((sample, index) => (
                  <span key={sample.imei}>
                    {index > 0 ? ' · ' : ''}
                    <button
                      type="button"
                      onClick={() => setIdentifier(sample.imei)}
                      style={{
                        font: 'inherit',
                        color: 'var(--primary)',
                        textDecoration: 'underline',
                        padding: 0,
                      }}
                    >
                      {sample.imei}
                    </button>{' '}
                    {sample.label}
                  </span>
                ))}
              </span>
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
            <button className="button button--primary" type="submit" disabled={busy || !affordable}>
              <Icon name="search" strokeWidth={1.9} />
              {busy ? PROGRESS[progress] : selected ? `Check for ${formatUsd(selected.sellPriceCents)}` : 'Check this device'}
            </button>
            {busy ? (
              <button
                className="button button--quiet"
                type="button"
                onClick={() => abortRef.current?.abort()}
              >
                Cancel
              </button>
            ) : null}
            {!affordable ? (
              <span className="t-small" style={{ color: 'var(--danger)' }}>
                Not enough credit for this service.
              </span>
            ) : null}
          </div>
        </div>
      </form>

      {result ? <CheckResult payload={result} /> : null}
    </div>
  )
}

function CheckResult({ payload }: { payload: CheckPayload }) {
  const entries = Object.entries(payload.response ?? {}).filter(
    ([key]) => key !== 'note' && key !== 'source',
  )
  const note = typeof payload.response?.note === 'string' ? payload.response.note : null

  return (
    <section className="panel">
      <header>
        <h2>{payload.service.name}</h2>
        <span>
          {payload.status === 'success'
            ? `${formatUsd(payload.credit.chargedCents)} charged · ${formatUsd(payload.credit.balanceCents)} left`
            : payload.status === 'error'
              ? `${formatUsd(payload.credit.refundedCents)} refunded`
              : 'Still with the provider'}
        </span>
      </header>
      <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <StatusBadge status={payload.status} />
          <span className="t-mono" style={{ fontSize: 13 }}>
            {payload.identifier}
          </span>
        </div>

        {payload.message ? (
          <p className="alert" role="status">
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

export function StatusBadge({ status }: { status: 'pending' | 'success' | 'error' }) {
  const map = {
    success: { className: 'badge badge--success', label: 'Completed' },
    pending: { className: 'badge badge--pending', label: 'With provider' },
    error: { className: 'badge badge--error', label: 'Failed · refunded' },
  } as const
  return <span className={map[status].className}>{map[status].label}</span>
}
