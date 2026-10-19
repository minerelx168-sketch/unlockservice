'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CryptoDeposit } from '@/lib/crypto-deposit'
import { formatUsd, parseUsd } from '@/lib/money'
import { CopyValue } from './invoice-actions'
import { Icon } from './icons'

type Token = { id: string; asset: string; feeBasisPoints: number }

export function CryptoDepositFlow({ csrfToken, gateways, minCents, maxCents, initialCents = 1000, initialDeposit, returnTo }: {
  csrfToken: string
  gateways: Token[]
  minCents: number
  maxCents: number
  initialCents?: number
  initialDeposit?: CryptoDeposit
  returnTo?: string | null
}) {
  const router = useRouter()
  const root = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const mounted = useRef(true)
  const busy = useRef(false)
  const credited = useRef(false)
  const [amount, setAmount] = useState((initialCents / 100).toFixed(2))
  const [gateway, setGateway] = useState(gateways[0]?.id ?? '')
  const [deposit, setDeposit] = useState<CryptoDeposit | null>(initialDeposit ?? null)
  const [waiting, setWaiting] = useState(Boolean(initialDeposit && initialDeposit.status !== 'pending'))
  const [txId, setTxId] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')
  const cents = parseUsd(amount)
  const valid = cents !== null && cents >= minCents && cents <= maxCents
  const token = gateways.find(item => item.id === gateway)
  const fee = valid && token ? Math.round(cents * token.feeBasisPoints / 10_000) : 0
  const reference = deposit?.reference
  const status = deposit?.status
  const terminal = status === 'success' || status === 'closed' || status === 'review'

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const command = useCallback(async (action: 'create' | 'check' | 'status', values: Record<string, unknown>) => {
    if (busy.current) return false
    busy.current = true
    if (action !== 'status') { setPending(true); setError('') }
    try {
      const response = await fetch('/api/payments/crypto', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, csrfToken, ...values }),
      })
      const result = await response.json()
      if (!response.ok || !result.deposit) throw new Error(result.error ?? 'Unable to check your deposit.')
      if (!mounted.current) return false
      setDeposit(result.deposit)
      setError('')
      if (action === 'create') heading.current?.focus()
      if (result.deposit.status === 'success' && !credited.current) {
        credited.current = true
        router.refresh()
      }
      return true
    } catch (problem) {
      if (mounted.current) setError(problem instanceof Error ? problem.message : 'Connection interrupted. Try again; do not send twice.')
      return false
    } finally {
      busy.current = false
      if (mounted.current) setPending(false)
    }
  }, [csrfToken, router])

  useEffect(() => {
    if (!reference || terminal) return
    const timer = window.setInterval(() => {
      const dialog = root.current?.closest('dialog')
      if (document.visibilityState === 'visible' && (!dialog || dialog.open)) {
        void command('status', { reference })
      }
    }, 5_000)
    return () => window.clearInterval(timer)
  }, [reference, terminal, command]) // status refreshes retain one timer

  async function check() {
    if (!deposit) return
    if (await command('check', { reference: deposit.reference, txId })) {
      setWaiting(true)
      heading.current?.focus()
    }
  }

  const showStatus = deposit && (waiting || deposit.status !== 'pending')
  return (
    <div className="crypto-flow" ref={root}>
      <header className="crypto-heading">
        {deposit && waiting && status === 'pending' ? <button type="button" className="crypto-back" aria-label="Back to QR code" onClick={() => setWaiting(false)}><Icon name="arrowLeft" /></button> : null}
        <h2 ref={heading} tabIndex={-1}>{!deposit ? 'Add money' : showStatus ? 'Deposit status' : 'Deposit crypto'}</h2>
        <p>{!deposit ? 'Top up your account with crypto.' : 'BNB Smart Chain only'}</p>
      </header>
      {error ? <p className="alert alert--error" role="alert">{error}</p> : null}
      {!deposit ? <form onSubmit={event => { event.preventDefault(); if (valid && token) void command('create', { amountCents: cents, gateway }) }}>
        <label className="crypto-amount-label" htmlFor="crypto-amount">Deposit amount (USD)</label>
        <div className="crypto-amount-input"><span aria-hidden="true">$</span><input id="crypto-amount" inputMode="decimal" autoComplete="off" value={amount} onChange={event => setAmount(event.target.value)} aria-describedby="crypto-limits" required disabled={pending} /></div>
        <p id="crypto-limits" className="crypto-note">{formatUsd(minCents)}–{formatUsd(maxCents)} per deposit</p>
        <div className="crypto-presets" role="group" aria-label="Deposit amounts">{[1, 10, 25, 50, 100].filter(value => value * 100 >= minCents && value * 100 <= maxCents).map(value => <button key={value} type="button" aria-pressed={cents === value * 100} onClick={() => setAmount(value.toFixed(2))} disabled={pending}>${value}</button>)}</div>
        <label className="crypto-token-label" htmlFor="crypto-token">Token</label>
        <select id="crypto-token" value={gateway} onChange={event => setGateway(event.target.value)} disabled={pending}>{gateways.map(item => <option value={item.id} key={item.id}>{item.asset === 'BSC-USD' ? 'USDT (Binance-Peg BSC-USD)' : 'USDC (Binance-Peg)'}</option>)}</select>
        <div className="crypto-chain"><span aria-hidden="true">◆</span><div><strong>BNB Smart Chain</strong><small>BEP-20 network</small></div><Icon name="checkSmall" /></div>
        <dl className="crypto-facts"><div><dt>Deposit fee</dt><dd>{valid ? formatUsd(fee) : '—'}</dd></div><div><dt>Selected amount</dt><dd>{valid ? formatUsd(cents) : '—'}</dd></div></dl>
        <p className="crypto-note">Your QR code and exact transfer amount appear next.</p>
        <button className="button button--primary crypto-primary" type="submit" disabled={pending || !valid || !token}>{pending ? 'Preparing deposit…' : 'Continue'}</button>
      </form> : <>
        {showStatus ? <section className="crypto-status" aria-live="polite">
          <div className={`crypto-status-symbol crypto-status-symbol--${status}`} aria-hidden="true">{status === 'success' ? <Icon name="check" /> : terminal ? <Icon name="info" /> : <span className="crypto-spinner" />}</div>
          <h3>{status === 'success' ? `${formatUsd(deposit.creditedCents!)} added` : status === 'review' ? 'Payment needs review' : status === 'closed' ? 'Request closed' : status === 'confirming' ? 'Confirming your deposit' : status === 'checking' ? 'Checking your transfer' : 'Waiting for funds'}</h3>
          <p>{status === 'success' ? 'Your credit is ready to use.' : status === 'review' ? 'Support needs to confirm this transfer. Your balance has not changed. Please do not send again.' : status === 'closed' ? 'Do not send to this request. Contact support if you already paid.' : status === 'confirming' ? `${deposit.confirmations} of ${deposit.confirmationsRequired} confirmations received.` : 'We’ll update this screen when your transfer is verified. You can close it and return from Payments.'}</p>
        </section> : <>
          <div className="crypto-token-pill"><span aria-hidden="true">{deposit.asset === 'USDT' ? '₮' : '$'}</span>{deposit.asset} on BNB Smart Chain</div>
          <div className="crypto-qr"><Image src={deposit.qr} width={208} height={208} alt={`${deposit.asset} receiving wallet QR code on BNB Smart Chain`} unoptimized /></div>
          <CopyValue id="crypto-exact-amount" label={`Send exactly (${deposit.asset})`} value={deposit.amount} buttonLabel="Copy" copiedMessage="Exact amount copied." />
          <CopyValue id="crypto-wallet" label="Wallet address" value={deposit.address} buttonLabel="Copy" copiedMessage="Wallet address copied." />
          <p className="crypto-transfer-note">Send only <strong>{deposit.asset} on BEP-20</strong>. {deposit.coded ? 'Keep all 4 decimal places so we can match your deposit.' : 'This request needs a Tx ID and support review.'}</p>
        </>}
        <dl className="crypto-facts">
          <div><dt>Network</dt><dd>BNB Smart Chain</dd></div>
          <div><dt>Token</dt><dd>{deposit.asset} <small>(Binance-Peg)</small></dd></div>
          <div><dt>Deposit fee</dt><dd>{formatUsd(deposit.feeCents)}</dd></div>
          {deposit.receivedCents !== null ? <div><dt>Verified amount</dt><dd>{formatUsd(deposit.receivedCents)}</dd></div> : <div><dt>Credit</dt><dd>{deposit.actualReceived ? 'Actual amount received' : 'Original request terms'}</dd></div>}
        </dl>
        {!terminal && <form onSubmit={event => { event.preventDefault(); void check() }}>
          <details className="crypto-tx"><summary>Add transaction ID <span>(optional)</span></summary><label htmlFor="crypto-txid">Transaction ID (Tx ID)</label><input id="crypto-txid" value={txId} onChange={event => setTxId(event.target.value)} placeholder="0x…" autoComplete="off" spellCheck={false} pattern="0x[a-fA-F0-9]{64}" minLength={66} maxLength={66} disabled={pending} /><p className="crypto-note">Paste it from your wallet or exchange to help locate your transfer.</p></details>
          <button className="button button--primary crypto-primary" type="submit" disabled={pending}>{pending ? 'Checking deposit…' : waiting ? 'Check deposit again' : 'I have deposited my funds'}</button>
        </form>}
        {status === 'success' ? <Link href={returnTo ?? '/user/reports/new'} className="button button--primary crypto-primary">Continue to services</Link> : null}
        {status === 'review' || status === 'closed' ? <Link href="/contact" className="button button--secondary crypto-primary">Contact support</Link> : null}
        <p className="crypto-note">{deposit.actualReceived ? 'Credit uses the verified amount received, rounded down to cents. Exchange withdrawal fees can reduce that amount.' : 'This existing request keeps its original credit terms.'}</p>
        <div className="crypto-links"><a href={deposit.explorerUrl ?? deposit.addressUrl} target="_blank" rel="noreferrer">View on BscScan ↗</a><Link href={`/user/invoice/${deposit.reference}`}>Payment details</Link></div>
      </>}
    </div>
  )
}
