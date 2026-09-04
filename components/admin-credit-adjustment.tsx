'use client'

import { useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatUsd } from '@/lib/money'

export type AdjustableUser = {
  id: number
  username: string
  email: string
  account_type: string
  status: string
  credit_cents: number
  held_cents: number
}

type AdjustmentSuccess = {
  success: true
  replayed: boolean
  balance: { creditCents: number; heldCents: number; availableCents: number }
  adjustment: { public_id: string; target_username: string; amount_cents: number }
}

type AdjustmentFailure = { success: false; error: string; code?: string }

function amountToCents(value: string): number | null {
  const clean = value.trim()
  if (!/^[+-]?\d{1,5}(?:\.\d{1,2})?$/.test(clean)) return null
  const amount = Number(clean)
  const cents = Math.round(amount * 100)
  if (!Number.isSafeInteger(cents) || cents === 0 || Math.abs(cents) > 1_000_000) return null
  return cents
}

export function AdminCreditAdjustment({
  csrfToken,
  users,
}: {
  csrfToken: string
  users: AdjustableUser[]
}) {
  const router = useRouter()
  const [userRows, setUserRows] = useState(users)
  const [targetUserId, setTargetUserId] = useState(users[0]?.id ? String(users[0].id) : '')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const idempotencyRef = useRef<string | null>(null)

  const selected = useMemo(
    () => userRows.find((user) => user.id === Number(targetUserId)),
    [targetUserId, userRows],
  )
  const amountCents = amountToCents(amount)
  const projectedCredit = selected && amountCents !== null ? selected.credit_cents + amountCents : null
  const projectedAvailable = selected && projectedCredit !== null ? projectedCredit - selected.held_cents : null
  const canSubmit = Boolean(
    selected
      && amountCents !== null
      && reason.trim().length >= 8
      && projectedCredit !== null
      && projectedCredit >= selected.held_cents,
  )

  function resetRequestKey() {
    idempotencyRef.current = null
    setError(null)
    setSuccess(null)
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected || amountCents === null || !canSubmit || busy) return

    const direction = amountCents > 0 ? 'add' : 'remove'
    const confirmed = window.confirm(
      `Confirm ${direction} ${formatUsd(Math.abs(amountCents))} ${amountCents > 0 ? 'to' : 'from'} ${selected.username}? This financial action is recorded permanently.`,
    )
    if (!confirmed) return

    const idempotencyKey = idempotencyRef.current ?? crypto.randomUUID()
    idempotencyRef.current = idempotencyKey
    setBusy(true)
    setError(null)
    setSuccess(null)

    try {
      const response = await fetch('/api/admin/credit-adjustments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          csrfToken,
          targetUserId: selected.id,
          amountCents,
          reason,
          idempotencyKey,
        }),
      })
      const payload = (await response.json()) as AdjustmentSuccess | AdjustmentFailure
      if (!response.ok || !payload.success) {
        setError(payload.success ? 'Credit adjustment failed.' : payload.error)
        return
      }

      setUserRows((rows) => rows.map((user) => (
        user.id === selected.id
          ? { ...user, credit_cents: payload.balance.creditCents, held_cents: payload.balance.heldCents }
          : user
      )))
      setSuccess(
        `${payload.replayed ? 'Existing adjustment confirmed' : 'Credit adjusted'}: ${payload.adjustment.public_id}`,
      )
      setAmount('')
      setReason('')
      idempotencyRef.current = null
      router.refresh()
    } catch {
      setError('Network error. Do not submit again until you verify the recent adjustments table.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="admin-adjustment-grid" onSubmit={submit}>
      <div className="admin-adjustment-fields">
        <div className="field">
          <label htmlFor="adjustment-user">User account</label>
          <select
            id="adjustment-user"
            value={targetUserId}
            onChange={(event) => {
              setTargetUserId(event.currentTarget.value)
              resetRequestKey()
            }}
            disabled={busy || users.length === 0}
          >
            {userRows.map((user) => (
              <option key={user.id} value={user.id}>
                {user.username} · {user.email} · {formatUsd(user.credit_cents - user.held_cents)} available
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label htmlFor="adjustment-amount">Adjustment amount (USD)</label>
          <input
            id="adjustment-amount"
            inputMode="decimal"
            value={amount}
            onChange={(event) => {
              setAmount(event.currentTarget.value)
              resetRequestKey()
            }}
            placeholder="25.00 or -10.00"
            disabled={busy}
          />
          <span className="field-note">Use a positive value to add credit or a negative value to remove credit.</span>
        </div>

        <div className="field">
          <label htmlFor="adjustment-reason">Reason</label>
          <textarea
            id="adjustment-reason"
            value={reason}
            onChange={(event) => {
              setReason(event.currentTarget.value)
              resetRequestKey()
            }}
            minLength={8}
            maxLength={240}
            placeholder="Customer support correction, refund reference, or approved goodwill credit…"
            disabled={busy}
            required
          />
          <span className="field-note">Required for the permanent audit record · {reason.trim().length}/240</span>
        </div>
      </div>

      <aside className="admin-balance-preview" aria-live="polite">
        <span className="kicker">Balance preview</span>
        {selected ? (
          <>
            <div className="balance-preview-row"><span>Current credit</span><strong>{formatUsd(selected.credit_cents)}</strong></div>
            <div className="balance-preview-row"><span>Held for orders</span><strong>{formatUsd(selected.held_cents)}</strong></div>
            <div className="balance-preview-row"><span>Available now</span><strong>{formatUsd(selected.credit_cents - selected.held_cents)}</strong></div>
            <hr className="hairline" />
            <div className="balance-preview-row balance-preview-row--strong">
              <span>Projected available</span>
              <strong>{projectedAvailable === null ? '—' : formatUsd(projectedAvailable)}</strong>
            </div>
          </>
        ) : <p className="t-small">No user account is available.</p>}

        {projectedCredit !== null && selected && projectedCredit < selected.held_cents ? (
          <p className="alert alert--error">The debit would reduce credit below held funds.</p>
        ) : null}
        {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
        {success ? <p className="alert" role="status">{success}</p> : null}

        {/* The button already refuses these; saying which one is missing is
            what turns a grey control into an instruction. The
            below-held-funds case has its own alert above. */}
        {!canSubmit && !busy ? (
          <p className="t-small" role="status">
            {!selected
              ? 'Pick the account to adjust.'
              : amountCents === null
                ? 'Enter an amount, like 25 or -12.50.'
                : reason.trim().length < 8
                  ? 'Write a reason of at least eight characters — it goes on the ledger row.'
                  : 'This adjustment cannot be recorded as entered.'}
          </p>
        ) : null}

        <button className="button button--primary button--wide" type="submit" disabled={!canSubmit || busy}>
          {busy ? 'Recording adjustment…' : amountCents && amountCents < 0 ? 'Remove credit' : 'Add credit'}
        </button>
        <p className="t-small">Confirmation is required. Every adjustment is append-only and linked to the credit ledger.</p>
      </aside>
    </form>
  )
}
