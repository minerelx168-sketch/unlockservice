'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { CryptoDeposit } from '@/lib/crypto-deposit'
import type { guestResult } from '@/lib/guest-checkout'
import { formatUsd } from '@/lib/money'
import { CopyValue } from './invoice-actions'
import { Icon } from './icons'

type CryptoOrderStatus = {
  deposit: CryptoDeposit
  order: ReturnType<typeof guestResult>
  resultUrl: string
}

export function GuestCryptoPayment({ initial, accessKey, backUrl }: {
  initial: CryptoOrderStatus
  accessKey: string
  backUrl: string
}) {
  const router = useRouter()
  const [status, setStatus] = useState(initial)
  const [transactionId, setTransactionId] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(false)
  const mounted = useRef(true)
  const inFlight = useRef(false)
  const { deposit, order } = status
  const reference = initial.order.reference
  const receivedCents = deposit.creditedCents ?? deposit.receivedCents
  const underpaid = deposit.status === 'success' && receivedCents !== null && receivedCents < order.priceCents
  const needsReview = underpaid || deposit.status === 'review' || order.state === 'review'
  const closed = deposit.status === 'closed'
  const paid = order.paymentReceived && ['paid', 'processing', 'completed'].includes(order.state)
  const refund = ['refund_pending', 'refunded'].includes(order.state)
  const terminal = paid || needsReview || closed || refund
  const resultUrl = status.resultUrl.startsWith(`/checkout/result/${reference}?`)
    ? status.resultUrl : ''

  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const refresh = useCallback(async (confirm = false) => {
    if (inFlight.current) return
    inFlight.current = true
    if (confirm) { setBusy(true); setError('') }
    try {
      const endpoint = `/api/checkout/crypto/${reference}`
      const response = await fetch(confirm ? endpoint : `${endpoint}?key=${encodeURIComponent(accessKey)}`, confirm ? {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: accessKey, transactionId: transactionId.trim() || undefined }),
        signal: AbortSignal.timeout(20_000),
      } : { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      const data = await response.json()
      if (!response.ok || !data.deposit || !data.order || data.order.reference !== reference) {
        throw new Error(data.error || 'Unable to refresh your payment. Please try again; do not send twice.')
      }
      if (!mounted.current) return
      setStatus(data)
      setError('')
      if (confirm) setChecked(true)
    } catch (problem) {
      if (mounted.current) setError(problem instanceof Error ? problem.message : 'Connection interrupted. Please try again; do not send twice.')
    } finally {
      inFlight.current = false
      if (mounted.current) setBusy(false)
    }
  }, [accessKey, reference, transactionId])

  useEffect(() => {
    if (terminal) return
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh()
    }, 10_000)
    return () => window.clearInterval(timer)
  }, [refresh, terminal])

  useEffect(() => {
    if (paid && resultUrl) router.replace(resultUrl)
  }, [paid, resultUrl, router])

  const title = paid ? 'Payment confirmed'
    : refund ? order.state === 'refunded' ? 'Payment refunded' : 'Refund needs assistance'
    : underpaid ? 'The received amount is below your order total'
    : needsReview ? 'Your payment needs a review'
    : closed ? 'This payment request is closed'
    : deposit.status === 'confirming' ? 'Confirming your transfer'
    : deposit.status === 'success' ? 'Matching payment to your order'
    : deposit.status === 'checking' || checked ? 'Waiting for payment confirmation' : 'Pay with crypto'
  const explanation = paid ? 'Opening your private order page. Your service starts after verified payment.'
    : refund ? order.state === 'refunded' ? 'Your order is marked refunded. Contact support if you need help locating the returned payment.' : 'Please contact support with your order reference. Crypto refunds need a verified return address; do not send another payment.'
    : underpaid ? `We verified ${formatUsd(receivedCents!)} against the ${formatUsd(order.priceCents)} service price. Your service has not started. Contact support before sending more.`
    : needsReview ? 'Keep your order reference and contact support. Please do not send another payment.'
    : closed ? 'Do not send funds to this payment request. If you have already paid, contact support with your transaction ID.'
    : deposit.status === 'confirming' ? `${deposit.confirmations} of ${deposit.confirmationsRequired} network confirmations received. Your service starts once payment is verified.`
    : deposit.status === 'success' ? 'We are confirming the payment for this service order. You do not need to send again.'
    : deposit.status === 'checking' || checked ? 'This page updates automatically. Keep this private link so you can return to your order.'
    : 'Pay for this order directly. No account or wallet top-up needed.'
  const showPaymentDetails = !terminal && deposit.status !== 'success'

  return <section className="guest-shell guest-crypto">
    <Link className="guest-back" href={backUrl}><Icon name="arrowLeft" /> Back to order</Link>
    <header className="guest-heading guest-crypto__heading">
      <span className="eyebrow">SECURE CRYPTO CHECKOUT</span>
      <h1 aria-live="polite">{title}</h1>
      <p>{explanation}</p>
      <div className="guest-crypto__badges"><span>No fee</span><span>No minimum</span><span>BNB Smart Chain</span></div>
    </header>
    <div className="guest-crypto__grid">
      <article className="guest-card guest-crypto__payment">
        {showPaymentDetails ? <>
          <p className="guest-crypto__service">{order.productName}</p>
          <div className="guest-crypto__network"><span className="guest-crypto__token" aria-hidden="true">{deposit.asset === 'USDT' ? '₮' : '$'}</span><div><strong>{deposit.asset}</strong><span>BNB Smart Chain · BEP-20</span></div><Icon name="shieldCheck" /></div>
          <div className="guest-crypto__qr"><Image src={deposit.qr} width={208} height={208} alt={`${deposit.asset} receiving wallet address QR code on BNB Smart Chain`} unoptimized /></div>
          <CopyValue id="guest-crypto-amount" label={`Send exactly (${deposit.asset})`} value={deposit.amount} buttonLabel="Copy amount" copiedMessage="Exact transfer amount copied." />
          <CopyValue id="guest-crypto-address" label="Receiving wallet address" value={deposit.address} buttonLabel="Copy" copiedMessage="Wallet address copied. Use BNB Smart Chain (BEP-20)." />
          <p className="guest-crypto__transfer-note">Send only <strong>{deposit.asset} on BNB Smart Chain (BEP-20)</strong>. The last two decimal digits identify your order. Keep all four decimal places.</p>
          <p className="guest-note">No website payment fee or minimum order amount. Network or exchange withdrawal fees may apply; the full amount shown must reach this address.</p>
        </> : <div className={`guest-crypto__status ${paid ? 'guest-crypto__status--paid' : ''}`}><Icon name={paid ? 'check' : 'info'} /><h2>{paid ? 'Your payment is verified' : refund ? 'Contact support about your refund' : needsReview ? 'Please contact support' : closed ? 'Please do not send funds' : 'Payment received by the network'}</h2><p>{explanation}</p></div>}
        {deposit.status === 'confirming' && !terminal ? <div className="guest-crypto__confirmations" role="status"><Icon name="clock" /><span>Network confirmations: <strong>{deposit.confirmations} / {deposit.confirmationsRequired}</strong></span></div> : null}
        {error ? <p className="guest-error" role="alert">{error}</p> : null}
        {!terminal && deposit.status !== 'success' ? <form className="guest-crypto__confirm" onSubmit={event => { event.preventDefault(); void refresh(true) }}>
          <details className="guest-crypto__transaction"><summary>Add transaction ID <span>(optional)</span></summary><label htmlFor="guest-crypto-tx">Transaction ID (Tx ID)</label><input id="guest-crypto-tx" value={transactionId} onChange={event => setTransactionId(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false} placeholder="0x…" pattern="0x[a-fA-F0-9]{64}" minLength={66} maxLength={66} disabled={busy} /><p className="guest-note">Copy it from your wallet or exchange to help locate your transfer.</p></details>
          <button className="button button--primary" type="submit" disabled={busy}>{busy ? 'Checking payment…' : checked ? 'Check payment again' : 'I have deposited my funds'}</button>
          <p className="guest-note guest-crypto__verification">Your service starts only after payment is verified on the blockchain.</p>
        </form> : null}
        {paid && resultUrl ? <Link className="button button--primary guest-crypto__action" href={resultUrl}>View my order <Icon name="arrowRight" /></Link> : null}
        {needsReview || closed || refund ? <Link className="button button--secondary guest-crypto__action" href="/support">Contact support</Link> : null}
        <a className="guest-crypto__explorer" href={deposit.explorerUrl ?? deposit.addressUrl} target="_blank" rel="noreferrer">View on BscScan ↗</a>
      </article>
      <aside className="guest-card guest-crypto__summary">
        <span className="eyebrow">YOUR ORDER</span>
        <h2>{order.productName}</h2>
        <dl><div><dt>Service</dt><dd>{formatUsd(order.priceCents)}</dd></div><div><dt>Payment fee</dt><dd>{formatUsd(deposit.feeCents)}</dd></div><div><dt>Token</dt><dd>{deposit.asset}</dd></div><div><dt>Exact transfer amount</dt><dd>{deposit.amount} {deposit.asset}</dd></div>{receivedCents !== null ? <div><dt>Verified amount</dt><dd>{formatUsd(receivedCents)}</dd></div> : null}</dl>
        <p className="guest-reference">Order reference: <strong>{reference}</strong></p>
        <p className="guest-note">Keep this page link private. It gives access to your order and result without a password.</p>
        <div className="guest-crypto__assurance"><Icon name="mail" /><p>Your confirmation, tracking link and completed result will be sent to your delivery email.</p></div>
        <p className="guest-note">If we cannot deliver the service, contact support to arrange a crypto refund. We will confirm the correct return address with you.</p>
      </aside>
    </div>
  </section>
}
