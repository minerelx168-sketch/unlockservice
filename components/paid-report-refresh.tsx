'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Icon } from './icons'

export function PaidReportRefresh({ orderId, csrfToken }: { orderId: number; csrfToken: string }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function refresh() {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch(`/api/imei/reports/${orderId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'same-origin',
        body: JSON.stringify({ csrfToken }),
      })
      const data = (await response.json()) as { success?: boolean; error?: string }
      if (!response.ok || data.success === false) throw new Error(data.error ?? 'The report status could not be refreshed.')
      router.refresh()
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'The report status could not be refreshed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <button className="button button--quiet" type="button" disabled={busy} onClick={refresh}>
        <Icon name="search" strokeWidth={1.9} />
        {busy ? 'Refreshing…' : 'Refresh status'}
      </button>
      {error ? <p className="t-small" style={{ color: 'var(--danger)' }}>{error}</p> : null}
    </div>
  )
}
