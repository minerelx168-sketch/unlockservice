'use client'

import { useRef, useState } from 'react'
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

type Decision = 'confirm' | 'dismiss' | 'reject'
function short(value: string): string {
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value
}

function TransferActions({ csrfToken, item }: { csrfToken: string; item: UnmatchedTransferItem }) {
  const router = useRouter()
  const [invoiceReference, setInvoiceReference] = useState('')
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const idempotency = useRef<string | null>(null)
  const valid = reason.trim().length >= 8 && reason.trim().length <= 240 && (decision !== 'confirm' || Boolean(invoiceReference))

  function choose(next: Decision) {
    setDecision(next)
    setError(null)
    setSuccess(null)
    idempotency.current = null
  }

  async function submit() {
    if (!decision || !valid || busy) return
    const key = idempotency.current ?? crypto.randomUUID()
    idempotency.current = key
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/admin/payment-transfers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ csrfToken, transferId: item.id, invoiceReference, decision, reason, idempotencyKey: key }),
      })
      const body = await response.json() as { success: boolean; error?: string; status?: string; replayed?: boolean }
      if (!response.ok || !body.success) {
        setError(body.error ?? 'Decision failed. Check this transfer before retrying.')
        return
      }
      setSuccess(body.replayed ? 'Decision already recorded.' : body.status === 'credited'
        ? 'Credit settled after independent on-chain verification.'
        : body.status === 'review' ? 'Transfer associated, but no credit added. Check the owner, then use Confirm manual payment & credit in the Payment verification queue above.'
          : 'Transfer closed without changing credit.')
      router.refresh()
    } catch {
      setError('Network error. Check the transfer state before trying again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ display: 'grid', gap: 9, minWidth: 190, justifyItems: 'start' }}>
      {item.candidates.length ? (
        <label className="t-small" htmlFor={`transfer-invoice-${item.id}`}>
          Payment request
          <select
            className="input"
            id={`transfer-invoice-${item.id}`}
            value={invoiceReference}
            disabled={busy}
            onChange={(event) => { setInvoiceReference(event.currentTarget.value); idempotency.current = null; setDecision(null) }}
          >
            <option value="">Choose verified owner</option>
            {item.candidates.map((candidate) => (
              <option key={candidate.reference} value={candidate.reference}>
                {candidate.username} · #{candidate.reference.slice(0, 10).toUpperCase()}
              </option>
            ))}
          </select>
        </label>
      ) : <span className="t-small">No nearby request. Ask the customer to create one before associating funds.</span>}
      <label className="t-small" htmlFor={`transfer-reason-${item.id}`}>
        Decision reason (8–240 characters)
        <textarea
          className="input"
          id={`transfer-reason-${item.id}`}
          value={reason}
          minLength={8}
          maxLength={240}
          disabled={busy}
          onChange={(event) => { setReason(event.currentTarget.value); idempotency.current = null; setDecision(null) }}
          placeholder="Record the independent evidence and customer request…"
        />
      </label>
      {error ? <span className="t-small" role="alert">{error}</span> : null}
      {success ? <span className="t-small" role="status">{success}</span> : null}
      {decision ? (
        <div className="admin-confirm" role="alertdialog" aria-label={`Confirm ${decision} transfer`}>
          <p className="t-small"><strong>{decision === 'confirm' ? `Associate ${item.amount} with the selected request?` : `${decision === 'reject' ? 'Reject' : 'Dismiss'} ${item.amount}?`}</strong></p>
          <p className="t-small">{decision === 'confirm'
            ? 'Rechecks the actual token, recipient, amount, time and confirmations on-chain. An uncoded transfer still needs separate approval in the invoice review queue; no credit is added by selecting a nearby name alone.'
            : 'Closes this unmatched transfer without a refund or balance change. This decision cannot be reversed from the queue.'}</p>
          <div className="admin-confirm-actions">
            <button className={decision === 'reject' ? 'button button--danger' : 'button button--primary'} type="button" disabled={!valid || busy} onClick={submit}>
              {busy ? 'Checking…' : `Yes, ${decision} transfer`}
            </button>
            <button className="button button--quiet" type="button" disabled={busy} onClick={() => setDecision(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="admin-invoice-actions">
          <button className="button button--primary" type="button" disabled={!invoiceReference || reason.trim().length < 8 || busy} onClick={() => choose('confirm')}>Verify &amp; associate</button>
          <button className="button button--quiet" type="button" disabled={reason.trim().length < 8 || busy} onClick={() => choose('dismiss')}>Dismiss</button>
          <button className="button button--quiet" type="button" disabled={reason.trim().length < 8 || busy} onClick={() => choose('reject')}>Reject</button>
        </div>
      )}
    </div>
  )
}

/**
 * Money that reached a wallet without a matching code and that nobody has
 * pasted. Association never credits just because a name is shown nearby.
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
            <th>Decision</th>
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
                ) : <span className="mono">{short(item.tx_hash)}</span>}
                {item.from_address ? <div className="t-small">from <span className="mono">{short(item.from_address)}</span></div> : null}
                {item.note ? <div className="t-small">{item.note}</div> : null}
              </td>
              <td>{item.candidates.length === 0 ? <span className="t-small">None created before it</span>
                : item.candidates.map((candidate) => (
                  <div key={candidate.reference} className="t-small">
                    {candidate.username} · #{candidate.reference.slice(0, 10).toUpperCase()}
                    {candidate.amount ? ` · asked ${candidate.amount}` : ''}
                  </div>
                ))}</td>
              <td><TransferActions csrfToken={csrfToken} item={item} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > items.length ? <p className="t-small">Showing the newest {items.length} of {total}.</p> : null}
    </div>
  )
}
