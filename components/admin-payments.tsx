'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

/**
 * The buttons on the administrator's payment queue. Each is one POST to
 * /api/admin/payments with the session's CSRF token, confirmed in a dialog
 * first because each one moves money or closes a door on it.
 */

async function post(csrfToken: string, payload: Record<string, unknown>) {
  const response = await fetch('/api/admin/payments', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, csrfToken }),
  })
  const body = (await response.json().catch(() => null)) as { success: boolean; error?: string } | null
  if (!body?.success) throw new Error(body?.error ?? 'The request failed.')
  return body
}

function useAction(csrfToken: string) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(question: string, payload: Record<string, unknown>) {
    if (busy || !window.confirm(question)) return
    setBusy(true)
    setError(null)
    try {
      await post(csrfToken, payload)
      router.refresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The request failed.')
    } finally {
      setBusy(false)
    }
  }

  return { busy, error, run }
}

export function ConfirmInvoiceButton({
  csrfToken,
  reference,
  transferId,
  summary,
  label = 'Confirm & credit',
}: {
  csrfToken: string
  reference: string
  transferId?: number
  summary: string
  label?: string
}) {
  const { busy, error, run } = useAction(csrfToken)
  return (
    <div className="payment-actions">
      <button
        type="button"
        className="button button--secondary"
        disabled={busy}
        onClick={() =>
          run(`${summary}\n\nThis adds credit and is recorded permanently. Continue?`, {
            action: 'confirm',
            reference,
            transferId: transferId ?? null,
          })
        }
      >
        {busy ? 'Confirming…' : label}
      </button>
      {error ? (
        <span className="t-small" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

export function RejectInvoiceButton({ csrfToken, reference }: { csrfToken: string; reference: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function reject() {
    const reason = window.prompt('Why is this invoice not being credited? The customer sees this.')
    if (!reason || busy) return
    setBusy(true)
    setError(null)
    try {
      await post(csrfToken, { action: 'reject', reference, reason })
      router.refresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="payment-actions">
      <button type="button" className="button button--quiet" disabled={busy} onClick={reject}>
        {busy ? 'Rejecting…' : 'Reject'}
      </button>
      {error ? (
        <span className="t-small" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

export function DismissTransferButton({ csrfToken, transferId }: { csrfToken: string; transferId: number }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function dismiss() {
    const reason = window.prompt('Why is this transfer not being credited? (e.g. refunded to sender, our own test)')
    if (!reason || busy) return
    setBusy(true)
    setError(null)
    try {
      await post(csrfToken, { action: 'dismiss', transferId, reason })
      router.refresh()
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="payment-actions">
      <button type="button" className="button button--quiet" disabled={busy} onClick={dismiss}>
        {busy ? 'Dismissing…' : 'Dismiss'}
      </button>
      {error ? (
        <span className="t-small" role="alert" style={{ color: 'var(--danger)' }}>
          {error}
        </span>
      ) : null}
    </div>
  )
}

export function ScanNowButton({ csrfToken }: { csrfToken: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)

  async function scan() {
    setBusy(true)
    setResult(null)
    try {
      const body = (await post(csrfToken, { action: 'scan' })) as {
        success: boolean
        scan?: { status: string; found?: number; settled?: number; error?: string }
      }
      const scanResult = body.scan
      setResult(
        scanResult?.status === 'ok'
          ? `Scanned — ${scanResult.found ?? 0} new transfer(s), ${scanResult.settled ?? 0} settled.`
          : scanResult?.status === 'error'
            ? `Scan failed: ${scanResult.error}`
            : `Scan ${scanResult?.status ?? 'skipped'}.`,
      )
      router.refresh()
    } catch (failure) {
      setResult(failure instanceof Error ? failure.message : 'The request failed.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="payment-actions" style={{ alignItems: 'center' }}>
      <button type="button" className="button button--quiet" disabled={busy} onClick={scan}>
        {busy ? 'Scanning…' : 'Scan now'}
      </button>
      {result ? (
        <span className="t-small" role="status" style={{ fontSize: 13 }}>
          {result}
        </span>
      ) : null}
    </div>
  )
}
