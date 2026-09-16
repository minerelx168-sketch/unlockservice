'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatUsd } from '@/lib/money'

export type InvoiceReviewItem = {
  invoice_reference: string
  username: string
  email: string
  credit_amount_cents: number
  requested_credit_cents: number | null
  verified_credit_cents: number | null
  fee_cents: number
  total_due_cents: number
  currency: string
  tx_hash: string
  status: string
  confirmations: number
  error_code: string | null
  invoice_created_at: string
}

type Decision = 'approve' | 'reject'
type DecisionResponse =
  | { success: true; replayed: boolean; balance: { availableCents: number } }
  | { success: false; error: string; code?: string }

function ReviewCard({ item, csrfToken }: { item: InvoiceReviewItem; csrfToken: string }) {
  const router = useRouter()
  const [decision, setDecision] = useState<Decision | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const idempotencyRef = useRef<string | null>(null)
  const validReason = reason.trim().length >= 8 && reason.trim().length <= 240
  const requestedCreditCents = item.requested_credit_cents ?? item.credit_amount_cents
  const approvalCreditCents = item.verified_credit_cents ?? item.credit_amount_cents

  function choose(next: Decision) {
    setDecision(next)
    setError(null)
    setSuccess(null)
    idempotencyRef.current = null
  }

  async function submit() {
    if (!decision || !validReason || busy) return
    const idempotencyKey = idempotencyRef.current ?? crypto.randomUUID()
    idempotencyRef.current = idempotencyKey
    setBusy(true)
    setError(null)
    setSuccess(null)
    try {
      const response = await fetch('/api/admin/invoice-verifications', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          csrfToken,
          invoiceReference: item.invoice_reference,
          decision,
          reason,
          idempotencyKey,
        }),
      })
      const payload = (await response.json()) as DecisionResponse
      if (!response.ok || !payload.success) {
        setError(payload.success ? 'Invoice decision failed.' : payload.error)
        return
      }
      setSuccess(payload.replayed ? 'Existing decision confirmed.' : 'Decision recorded successfully.')
      router.refresh()
    } catch {
      setError('Network error. Verify the invoice status before trying again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="admin-invoice-card">
      <header>
        <div>
          <span className="eyebrow">#{item.invoice_reference.slice(0, 10).toUpperCase()}</span>
          <h3>{item.username}</h3>
          <p className="t-small">{item.email}</p>
        </div>
        <span className={item.status === 'manual_review' ? 'badge badge--error' : 'badge badge--pending'}>
          {item.status === 'manual_review' ? 'Manual review' : item.status === 'confirming' ? 'Confirming' : 'Submitted'}
        </span>
      </header>

      <dl className="admin-invoice-metrics">
        <div><dt>Requested credit</dt><dd>{formatUsd(requestedCreditCents)}</dd></div>
        <div><dt>Verified on-chain</dt><dd>{item.verified_credit_cents === null ? 'Not cent-exact' : formatUsd(item.verified_credit_cents)}</dd></div>
        <div><dt>Confirmations</dt><dd>{item.confirmations}</dd></div>
        <div><dt>Verifier</dt><dd>{item.error_code ? item.error_code.replaceAll('_', ' ') : 'No mismatch'}</dd></div>
      </dl>

      <p className="admin-tx-hash mono" title={item.tx_hash}>{item.tx_hash}</p>
      <a className="link-arrow" href={`https://bscscan.com/tx/${item.tx_hash}`} target="_blank" rel="noreferrer">
        Inspect transaction on BscScan
      </a>

      <div className="field">
        <label htmlFor={`invoice-reason-${item.invoice_reference}`}>Decision reason</label>
        <textarea
          id={`invoice-reason-${item.invoice_reference}`}
          value={reason}
          onChange={(event) => {
            setReason(event.currentTarget.value)
            idempotencyRef.current = null
            setError(null)
            setSuccess(null)
          }}
          minLength={8}
          maxLength={240}
          placeholder="Describe the independent evidence used for this decision…"
          disabled={busy}
        />
        <span className="field-note">Required for the permanent append-only audit · {reason.trim().length}/240</span>
      </div>

      {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
      {success ? <p className="alert" role="status">{success}</p> : null}

      {decision ? (
        <div className="admin-confirm" role="alertdialog" aria-label={`Confirm ${decision} invoice`}>
          <p>
            <strong>
              {decision === 'approve'
                ? `Approve ${formatUsd(approvalCreditCents)} credit for ${item.username}?`
                : `Reject payment request for ${item.username}?`}
            </strong>
          </p>
          <p className="t-small">
            {decision === 'approve'
              ? 'Approval writes one top-up ledger effect using the verified amount when available. Confirm contract, recipient, amount and finality independently.'
              : 'Rejection closes this request without changing the customer balance.'}
          </p>
          <div className="admin-confirm-actions">
            <button
              className={decision === 'approve' ? 'button button--primary' : 'button button--danger'}
              type="button"
              disabled={!validReason || busy}
              onClick={submit}
            >
              {busy ? 'Recording…' : `Yes, ${decision} request`}
            </button>
            <button className="button button--quiet" type="button" disabled={busy} onClick={() => setDecision(null)}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="admin-invoice-actions">
          <button className="button button--primary" type="button" disabled={!validReason || busy} onClick={() => choose('approve')}>Approve credit</button>
          <button className="button button--quiet" type="button" disabled={!validReason || busy} onClick={() => choose('reject')}>Reject request</button>
        </div>
      )}
    </article>
  )
}

export function AdminInvoiceReviewQueue({ csrfToken, items }: { csrfToken: string; items: InvoiceReviewItem[] }) {
  if (items.length === 0) return <p className="empty">No payment requests require administrator review.</p>
  return (
    <div className="admin-invoice-queue">
      {items.map((item) => <ReviewCard key={item.invoice_reference} item={item} csrfToken={csrfToken} />)}
    </div>
  )
}
