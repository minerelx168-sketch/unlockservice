import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon } from '@/components/icons'
import { ApproveInvoiceForm, PaymentReferenceForm } from '@/components/payment-forms'
import { AutoRefreshPaymentStatus, CopyValue, PaymentAddress } from '@/components/invoice-actions'
import { requireSession } from '@/lib/auth'
import { safeContinuation } from '@/lib/continuation'
import { formatUsd } from '@/lib/money'
import { GATEWAYS, getInvoice, selfApprovalEnabled, shortReference } from '@/lib/payments'
import { getInvoiceVerification } from '@/lib/payment-verification'
import { paymentAddressQrDataUrl } from '@/lib/payment-qr'

export const metadata: Metadata = { title: 'Payment request' }
export const dynamic = 'force-dynamic'

function statusCopy(
  invoiceStatus: 'pending' | 'review' | 'success' | 'failed' | 'refunded',
  verificationStatus?: string,
) {
  if (invoiceStatus === 'success') return { label: 'Verified', tone: 'success', message: 'Payment verified and credit added.' }
  if (invoiceStatus === 'failed' || invoiceStatus === 'refunded' || verificationStatus === 'rejected') {
    return { label: 'Closed', tone: 'danger', message: 'This payment request is closed. Do not send another transfer to it.' }
  }
  if (verificationStatus === 'manual_review') {
    return { label: 'Manual review', tone: 'warning', message: 'Automatic checks need an administrator. Your credit has not changed.' }
  }
  if (verificationStatus === 'confirming') {
    return { label: 'Confirming', tone: 'warning', message: 'The transfer matched. We are waiting for the confirmation threshold.' }
  }
  if (verificationStatus === 'submitted') {
    return { label: 'Checking', tone: 'warning', message: 'Your transaction hash is queued for automatic verification.' }
  }
  return { label: 'Awaiting transfer', tone: 'neutral', message: 'Send supported USDT, then paste your transaction hash.' }
}

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ reference: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const { user } = await requireSession()
  const { reference } = await params
  const returnTo = safeContinuation((await searchParams).next)
  const invoice = getInvoice(reference, user.id)
  if (!invoice) notFound()

  const gateway = GATEWAYS.find((entry) => entry.id === invoice.gateway)
  const verification = getInvoiceVerification(invoice.reference, user.id)
  const settled = invoice.status === 'success'
  const closed = invoice.status === 'failed' || invoice.status === 'refunded'
  const status = statusCopy(invoice.status, verification?.status)
  const refreshActive = invoice.status === 'review' && ['submitted', 'confirming'].includes(verification?.status ?? '')
  const qrDataUrl = gateway ? await paymentAddressQrDataUrl(gateway.address).catch(() => null) : null
  const explorerUrl = verification ? `https://bscscan.com/tx/${verification.tx_hash}` : null
  const requestedCreditCents = verification?.requested_credit_cents ?? invoice.credit_amount_cents
  const verifiedCreditCents = verification?.verified_credit_cents ?? null
  const requestedTokenUnits = (requestedCreditCents / 100).toFixed(2)

  return (
    <>
      <section className="payment-request-head">
        <div>
          <span className="eyebrow">Payment request {shortReference(invoice.reference)}</span>
          <h1>{status.label}</h1>
          <p>{status.message}</p>
        </div>
        <div className={`payment-status payment-status--${status.tone}`}>
          <span aria-hidden="true" />
          {status.label}
        </div>
      </section>

      <ol className="invoice-progress" aria-label="Payment progress">
        <li className="is-complete"><span>1</span><strong>Request created</strong></li>
        <li className={verification || settled ? 'is-complete' : 'is-current'}><span>2</span><strong>Transfer submitted</strong></li>
        <li className={settled ? 'is-complete' : verification ? 'is-current' : ''}><span>3</span><strong>On-chain checks</strong></li>
        <li className={settled ? 'is-complete' : ''}><span>4</span><strong>Credit added</strong></li>
      </ol>

      <div className="invoice-shell">
        <main className="invoice-primary">
          <section className="panel transfer-card">
            <header>
              <div>
                <h2>Send USDT on BNB Smart Chain</h2>
                <p className="t-small">Use only the asset and network shown below.</p>
              </div>
              <span>{gateway ? `${gateway.asset} · ${gateway.network}` : invoice.gateway}</span>
            </header>
            <div className="panel-body">
              {gateway && !settled && !closed ? (
                <div className="transfer-layout">
                  <div className="transfer-details">
                    <div className="network-banner">
                      <span className="payment-method-icon">₮</span>
                      <div><strong>{gateway.asset}</strong><small>{gateway.network}</small></div>
                      <span className="badge badge--success">Auto verification</span>
                    </div>
                    <CopyValue
                      id="payment-total"
                      label={`Requested amount (${gateway.asset})`}
                      value={requestedTokenUnits}
                      buttonLabel="Copy requested amount"
                      copiedMessage="Requested amount copied."
                    />
                    <PaymentAddress address={gateway.address} />
                    <p className="alert alert--warning">
                      <Icon name="info" strokeWidth={1.9} />
                      <span>
                        Send only the supported token on BNB Smart Chain. Credit is based on the verified on-chain amount;
                        amounts that cannot be represented exactly in cents require manual review. Blockchain transfers cannot be reversed.
                      </span>
                    </p>
                  </div>
                  {qrDataUrl ? (
                    <div className="payment-qr">
                      <Image src={qrDataUrl} width={220} height={220} alt="QR code containing the payment wallet address" unoptimized />
                      <strong>Scan wallet address</strong>
                      <small>Confirm BNB Smart Chain, the supported token contract and the receiving address before sending.</small>
                    </div>
                  ) : null}
                </div>
              ) : settled ? (
                <div className="payment-success">
                  <Icon name="check" strokeWidth={2} />
                  <div>
                    <h2>{formatUsd(invoice.credit_amount_cents)} added</h2>
                    <p>The payment passed verification and the ledger applied this invoice once.</p>
                  </div>
                </div>
              ) : (
                <p className="alert alert--error" role="alert">
                  <Icon name="info" strokeWidth={1.9} />
                  <span>
                    This payment channel is unavailable or this request is closed. Do not send funds using old instructions;
                    contact support if you already paid.
                  </span>
                </p>
              )}
            </div>
          </section>

          {!settled && !closed ? (
            <section className="panel verification-card">
              <header>
                <div>
                  <h2>{verification ? 'Automatic verification' : 'Paste your transaction hash'}</h2>
                  <p className="t-small">Submitting a hash never adds credit by itself.</p>
                </div>
                {verification ? <span>{verification.confirmations} confirmations</span> : null}
              </header>
              <div className="panel-body">
                {verification ? (
                  <div className="verification-state">
                    <div className="verification-state-copy">
                      <span className={`payment-status payment-status--${status.tone}`}><span aria-hidden="true" />{status.label}</span>
                      <p>{status.message}</p>
                      {verifiedCreditCents !== null ? (
                        <p className="t-small">Verified on-chain amount: <strong>{formatUsd(verifiedCreditCents)}</strong></p>
                      ) : null}
                      {explorerUrl ? <Link className="link-arrow" href={explorerUrl} target="_blank" rel="noreferrer">View transaction on BscScan</Link> : null}
                    </div>
                    <AutoRefreshPaymentStatus active={refreshActive} />
                  </div>
                ) : gateway ? (
                  <PaymentReferenceForm reference={invoice.reference} returnTo={returnTo} />
                ) : null}

                {selfApprovalEnabled() ? (
                  <>
                    <hr className="hairline" />
                    <p className="t-small">Development simulation only: this adds test credit without a real transfer.</p>
                    <ApproveInvoiceForm reference={invoice.reference} returnTo={returnTo} />
                  </>
                ) : null}
              </div>
            </section>
          ) : null}

          {settled ? (
            <div className="invoice-next-actions">
              <Link className="button button--primary" href={returnTo ?? '/user/reports/new'}>Continue to services</Link>
              <Link className="button button--secondary" href="/user/payments">View payment history</Link>
            </div>
          ) : null}
        </main>

        <aside className="invoice-summary-card">
          <h2>Request summary</h2>
          <dl>
            <div><dt>Requested credit</dt><dd>{formatUsd(requestedCreditCents)}</dd></div>
            {verifiedCreditCents !== null ? (
              <div><dt>Verified on-chain</dt><dd>{formatUsd(verifiedCreditCents)}</dd></div>
            ) : null}
            <div><dt>Service fee</dt><dd>{formatUsd(invoice.fee_cents)}</dd></div>
            <div><dt>Tax</dt><dd>{formatUsd(invoice.tax_cents)}</dd></div>
            <div className="invoice-summary-total"><dt>Total due</dt><dd>{formatUsd(invoice.total_due_cents)}</dd></div>
          </dl>
          <p>The request preserves the original amount for audit. After verification, the account receives the cent-exact amount proven by the on-chain transfer exactly once.</p>
          <Link className="link-arrow" href="/user/payments">All payments</Link>
        </aside>
      </div>

      <p className="t-small payment-help">
        Need help? <Link href="/contact">Contact support</Link> and include payment request {shortReference(invoice.reference)}.
        Never send your wallet password, private key or seed phrase.
      </p>
    </>
  )
}
