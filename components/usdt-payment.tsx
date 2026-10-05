'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Icon } from './icons'

/*
 * The live half of the invoice page. The server renders what to send and
 * where; this watches for the money to arrive, and holds the fallback for
 * a transfer the code could not place.
 */

type PaymentState = {
  status: 'pending' | 'review' | 'success' | 'failed' | 'refunded'
  creditedCents: number | null
  receivedE4: number | null
  claim: { txHash: string; amountE4: number; explorerUrl: string } | null
  detection: 'automatic' | 'manual'
}

function usd(cents: number): string {
  return `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`
}

function usdt(e4: number): string {
  return `${Math.floor(e4 / 10_000)}.${String(e4 % 10_000).padStart(4, '0')}`
}

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      /* Clipboard access is refused on plain http and in some in-app
         browsers; selecting a scratch field still works there. */
      const area = document.createElement('textarea')
      area.value = value
      area.setAttribute('readonly', '')
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      try {
        document.execCommand('copy')
      } finally {
        area.remove()
      }
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1_800)
  }

  return (
    <button type="button" className="button button--quiet copy-button" onClick={copy} aria-label={`Copy ${label}`}>
      <Icon name={copied ? 'check' : 'copy'} strokeWidth={1.9} />
      <span aria-live="polite">{copied ? 'Copied' : 'Copy'}</span>
    </button>
  )
}

/** "23 h 41 min" until the amount stops being held. Rendered after mount so server and browser agree. */
function useHeldFor(until: string): string | null {
  const [text, setText] = useState<string | null>(null)
  useEffect(() => {
    const update = () => {
      const minutes = Math.max(0, Math.floor((new Date(until).getTime() - Date.now()) / 60_000))
      setText(
        minutes === 0
          ? null
          : minutes >= 1_440
            ? `${Math.floor(minutes / 1_440)} d ${Math.floor((minutes % 1_440) / 60)} h`
            : minutes >= 60
              ? `${Math.floor(minutes / 60)} h ${minutes % 60} min`
              : `${minutes} min`,
      )
    }
    update()
    const timer = window.setInterval(update, 30_000)
    return () => window.clearInterval(timer)
  }, [until])
  return text
}

export function InvoiceLiveStatus({
  reference,
  csrfToken,
  initial,
  reservedUntil,
  nextStep,
}: {
  reference: string
  csrfToken: string
  initial: PaymentState
  reservedUntil: string
  /** Where a paid customer goes next — ordering, or a phone check while ordering is paused. */
  nextStep: { href: string; label: string }
}) {
  const router = useRouter()
  const [state, setState] = useState<PaymentState>(initial)
  const [checks, setChecks] = useState(0)
  const heldFor = useHeldFor(reservedUntil)
  const open = state.status === 'pending' || state.status === 'review'

  useEffect(() => {
    if (!open) return
    let stopped = false
    let timer: number | undefined
    const started = Date.now()

    const tick = async () => {
      window.clearTimeout(timer)
      try {
        const response = await fetch('/api/payments/status', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reference, csrfToken }),
        })
        const body = (await response.json().catch(() => null)) as (PaymentState & { success: boolean }) | null
        if (!stopped && body?.success) {
          setState(body)
          setChecks((count) => count + 1)
          // The server lays the page out per status; let it, when that changes.
          if (body.status !== initial.status) {
            router.refresh()
            if (body.status === 'success') return
          }
        }
      } catch {
        // A dropped poll is not news; the next one will say.
      }
      if (stopped) return
      const elapsed = Date.now() - started
      timer = window.setTimeout(tick, elapsed < 10 * 60_000 ? 5_000 : elapsed < 60 * 60_000 ? 20_000 : 60_000)
    }

    /* Most people pay from their phone's exchange app and switch back.
       Check the moment they do, rather than up to a poll later. */
    const onVisible = () => {
      if (document.visibilityState === 'visible') void tick()
    }

    timer = window.setTimeout(tick, 3_000)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      window.clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [open, reference, csrfToken, router, initial.status])

  return (
    <div className="pay-live">
      {state.status === 'success' ? (
        <div className="pay-state pay-state--done" role="status">
          <span className="pay-state-icon">
            <Icon name="check" strokeWidth={2.2} />
          </span>
          <div>
            <strong>Payment received</strong>
            <p>
              {state.creditedCents !== null ? `${usd(state.creditedCents)} was added to your balance.` : 'Your balance has been updated.'}
            </p>
          </div>
        </div>
      ) : state.status === 'review' ? (
        <div className="pay-state" role="status">
          <span className="pay-state-icon pay-state-icon--review">
            <Icon name="shieldCheck" strokeWidth={1.9} />
          </span>
          <div>
            <strong>We have your transfer — confirming it</strong>
            <p>
              {state.claim
                ? `${usdt(state.claim.amountE4)} USDT arrived, but without this invoice's code, so a person confirms it. Nothing else to do.`
                : 'A person is confirming your payment. Nothing else to do.'}
            </p>
            <p className="pay-meta">Usually within a few hours. You can close this page.</p>
            {state.claim ? (
              <a className="link-arrow" href={state.claim.explorerUrl} target="_blank" rel="noreferrer">
                View the transfer on BscScan
              </a>
            ) : null}
          </div>
        </div>
      ) : state.status === 'pending' ? (
        <div className="pay-state" role="status" aria-live="polite">
          <span className="pay-pulse" aria-hidden="true" />
          <div>
            <strong>{state.detection === 'automatic' ? 'Waiting for your transfer' : 'Waiting for your payment'}</strong>
            <p>
              {state.detection === 'automatic'
                ? 'Credit is added automatically once the network confirms it — usually within a minute of sending. You can close this page; it is added either way.'
                : 'This invoice was made before automatic detection. After sending, paste the transaction ID below.'}
            </p>
            <p className="pay-meta">
              {checks > 0 ? 'Checked just now' : 'Checking the network'}
              {heldFor && state.detection === 'automatic' ? ` · invoice open for ${heldFor}` : ''}
            </p>
          </div>
        </div>
      ) : (
        <div className="pay-state" role="status">
          <span className="pay-state-icon pay-state-icon--review">
            <Icon name="info" strokeWidth={1.9} />
          </span>
          <div>
            <strong>This invoice is {state.status === 'failed' ? 'closed' : state.status}</strong>
            <p>Create a new invoice to add funds. If you already paid it, contact support with the transaction ID.</p>
          </div>
        </div>
      )}

      {open && !state.claim ? (
        <details className="pay-fallback" open={state.detection === 'manual'}>
          <summary>
            {state.detection === 'manual' ? 'Paste your transaction ID' : 'Sent it, but nothing after 10 minutes?'}
          </summary>
          <ClaimForm
            reference={reference}
            csrfToken={csrfToken}
            onChanged={() => router.refresh()}
            onReview={(next) => setState(next)}
          />
        </details>
      ) : null}

      {state.status === 'success' ? (
        <div className="pay-actions">
          <Link className="button button--primary" href={nextStep.href}>
            <Icon name="arrowRight" strokeWidth={1.9} />
            {nextStep.label}
          </Link>
          <Link className="button button--quiet" href="/user/payments">
            All payments
          </Link>
        </div>
      ) : null}
    </div>
  )
}

function ClaimForm({
  reference,
  csrfToken,
  onChanged,
  onReview,
}: {
  reference: string
  csrfToken: string
  onChanged: () => void
  onReview: (state: PaymentState) => void
}) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !value.trim()) return
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/payments/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reference, txHash: value, csrfToken }),
      })
      const body = (await response.json().catch(() => null)) as
        | { success: true; outcome: 'credited' | 'review' | 'waiting'; message: string }
        | { success: false; error: string }
        | null
      if (!body) {
        setError('Something went wrong. Try again in a moment.')
      } else if (!body.success) {
        setError(body.error)
      } else if (body.outcome === 'credited') {
        setMessage(body.message)
        onChanged()
      } else if (body.outcome === 'review') {
        setMessage(body.message)
        const status = await fetch('/api/payments/status', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ reference, csrfToken }),
        }).then((reply) => reply.json() as Promise<PaymentState & { success: boolean }>)
        if (status.success) onReview(status)
        onChanged()
      } else {
        setMessage(body.message)
      }
    } catch {
      setError('We could not reach the server. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form className="pay-claim" onSubmit={submit}>
      <p className="pay-claim-help">
        In your exchange or wallet, open the withdrawal in its history and copy the <strong>TxID</strong> (also called the
        transaction hash), or the BscScan link. We look it up on the chain straight away.
      </p>
      {error ? (
        <p className="alert alert--error" role="alert">
          <Icon name="info" strokeWidth={1.9} />
          <span>{error}</span>
        </p>
      ) : null}
      {message ? (
        <p className="alert alert--success" role="status">
          <Icon name="checkSmall" strokeWidth={1.9} />
          <span>{message}</span>
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="txid">Transaction ID or BscScan link</label>
        <input
          id="txid"
          name="txid"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
        />
      </div>
      <button className="button button--secondary" type="submit" disabled={busy || !value.trim()}>
        {busy ? 'Checking the chain…' : 'Find my payment'}
      </button>
    </form>
  )
}
