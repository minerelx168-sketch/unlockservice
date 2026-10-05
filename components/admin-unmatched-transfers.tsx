'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export type UnmatchedTransferItem = {
  id: number
  route_label: string
  tx_hash: string
  explorer_url: string | null
  from_address: string | null
  amount: string
  block_time: string
  note: string | null
  candidates: Array<{ reference: string; username: string; amount: string | null }>
}

function short(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value
}

function DismissButton({ csrfToken, id }: { csrfToken: string; id: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function dismiss() {
    const reason = window.prompt('Why is this transfer not being credited? (e.g. refunded to sender, our own test)')
    if (!reason || busy) return
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/admin/payment-transfers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transferId: id, reason, csrfToken }),
      })
      const body = (await response.json().catch(() => null)) as { success: boolean; error?: string } | null
      if (!body?.success) setError(body?.error ?? 'The request failed.')
      else router.refresh()
    } catch {
      setError('The request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 6, justifyItems: 'start' }}>
      <button className="button button--quiet" type="button" disabled={busy} onClick={dismiss} style={{ whiteSpace: 'nowrap' }}>
        {busy ? 'Dismissing…' : 'Dismiss'}
      </button>
      {error ? <span className="t-small" role="alert">{error}</span> : null}
    </div>
  )
}

/**
 * Money that reached a wallet without a matching code and that nobody has
 * pasted. Usually a customer who rounded the amount: once they paste the
 * transaction ID it moves to the review queue above. Otherwise credit it
 * with "Adjust user credit" and dismiss it here with a note.
 */
export function AdminUnmatchedTransfers({
  csrfToken,
  items,
  total,
}: {
  csrfToken: string
  items: UnmatchedTransferItem[]
  total: number
}) {
  if (items.length === 0) return <p className="empty">Every transfer found its payment request.</p>
  return (
    <div className="table-wrap">
      <table className="grid">
        <thead>
          <tr>
            <th>Arrived</th>
            <th className="num">Amount</th>
            <th>Transfer</th>
            <th>Open requests near it</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                {item.block_time.replace('T', ' ').slice(0, 16)} UTC
                <div className="t-small">{item.route_label}</div>
              </td>
              <td className="num mono">{item.amount}</td>
              <td>
                {item.explorer_url ? (
                  <a className="mono" href={item.explorer_url} target="_blank" rel="noreferrer">{short(item.tx_hash)}</a>
                ) : (
                  <span className="mono">{short(item.tx_hash)}</span>
                )}
                {item.from_address ? <div className="t-small">from <span className="mono">{short(item.from_address)}</span></div> : null}
                {item.note ? <div className="t-small">{item.note}</div> : null}
              </td>
              <td>
                {item.candidates.length === 0
                  ? <span className="t-small">None created before it</span>
                  : item.candidates.map((candidate) => (
                      <div key={candidate.reference} className="t-small">
                        {candidate.username} · #{candidate.reference.slice(0, 10).toUpperCase()}
                        {candidate.amount ? ` · asked ${candidate.amount}` : ''}
                      </div>
                    ))}
              </td>
              <td><DismissButton csrfToken={csrfToken} id={item.id} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > items.length ? <p className="t-small">Showing the newest {items.length} of {total}.</p> : null}
    </div>
  )
}
