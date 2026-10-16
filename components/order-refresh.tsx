'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Icon } from './icons'

/**
 * Asks the server to check in on an order that is still with the carrier,
 * then re-renders the page from the database. The endpoint already exists
 * for the order console; this is only a button in front of it.
 */
export function OrderRefresh({ orderId, csrfToken }: { orderId: number; csrfToken: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function refresh() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/orders/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: JSON.stringify({ csrfToken, orderId }),
      })
      const data = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || data.success === false) throw new Error(data.error ?? 'The order status could not be refreshed.')
      router.refresh()
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'The order status could not be refreshed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="order-refresh">
      <button className="button button--quiet" type="button" disabled={busy} onClick={refresh}>
        <Icon name="refresh" strokeWidth={2} className={busy ? 'is-spinning' : undefined} />
        {busy ? 'Checking…' : 'Refresh status'}
      </button>
      {error ? <p className="t-small order-refresh-error" role="alert">{error}</p> : null}
    </div>
  )
}
