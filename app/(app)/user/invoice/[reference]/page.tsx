import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon } from '@/components/icons'
import { ApproveInvoiceForm } from '@/components/payment-forms'
import { CopyButton, InvoiceLiveStatus } from '@/components/usdt-payment'
import { requireSession } from '@/lib/auth'
import { explorerTxUrl, formatE4 } from '@/lib/bsc'
import { formatUsd } from '@/lib/money'
import {
  expireStaleInvoices,
  GATEWAYS,
  getInvoice,
  invoiceExpired,
  paymentCode,
  reservationEndsAt,
  selfApprovalEnabled,
  shortfallToleranceCents,
  shortReference,
} from '@/lib/payments'
import { unlockOrderingEnabled } from '@/lib/provider'
import { qrPath } from '@/lib/qr'
import { invoicePaymentStatus } from '@/lib/usdt'

export const metadata: Metadata = { title: 'Invoice' }
export const dynamic = 'force-dynamic'

/**
 * Pay, then leave. The page asks for one exact amount on one network to one
 * address — each with a copy button, the address with a QR code — and then
 * watches the chain itself. The amount's last two digits are the invoice's
 * code, which is what lets the payment find this invoice without the
 * customer coming back to paste a transaction id.
 */
export default async function InvoicePage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { user, session } = await requireSession()
  const { reference } = await params
  expireStaleInvoices()
  const invoice = getInvoice(reference, user.id)
  if (!invoice) notFound()

  const gateway = GATEWAYS.find((entry) => entry.id === invoice.gateway)
  const settled = invoice.status === 'success'
  const open = invoice.status === 'pending' || invoice.status === 'review'
  const coded = invoice.pay_amount_e4 !== null
  const payE4 = invoice.pay_amount_e4 ?? invoice.total_due_cents * 100
  const payText = formatE4(payE4)
  const code = String(paymentCode(payE4)).padStart(2, '0')
  const tolerance = shortfallToleranceCents(invoice.total_due_cents)
  const ordering = unlockOrderingEnabled()
  const nextStep = ordering
    ? { href: '/user/unlock', label: 'Unlock a device' }
    : { href: '/user/reports/new', label: 'Run a phone check' }
  // Instructions only while nothing has been sent; once a transfer is in
  // review the page is about its status, not about sending again.
  const expired = invoiceExpired(invoice)
  const awaitingSend = invoice.status === 'pending' && !expired
  const live = expired ? { ...invoicePaymentStatus(invoice), status: 'failed' as const } : invoicePaymentStatus(invoice)
  const qr = gateway && awaitingSend ? qrPath(gateway.address) : null
  const creditedCents = invoice.credited_cents ?? invoice.credit_amount_cents

  return (
    <>
      <div className="app-head">
        <div>
          <h1>{settled ? `Paid — ${formatUsd(creditedCents)} added` : `Add ${formatUsd(invoice.credit_amount_cents)} of credit`}</h1>
          <p>
            {settled
              ? 'The credit is on your balance and ready to use.'
              : invoice.status === 'review'
                ? 'Your payment is in. A person is confirming it — there is nothing else for you to do.'
                : expired || invoice.status === 'failed'
                  ? 'This invoice has closed. Do not send to it — create a new top-up instead.'
                  : open && coded
                    ? 'Send the USDT below from any exchange or wallet. We spot it on the network and add the credit by ourselves — no transaction ID to paste, no waiting on support.'
                    : open
                      ? 'Send the exact total below, then paste the transaction ID so it can be checked.'
                      : `This invoice is ${invoice.status}.`}
          </p>
        </div>
        <Link className="button button--quiet" href="/user/payments">
          All payments
        </Link>
      </div>

      {!gateway && !settled ? (
        <p className="alert alert--error" role="alert" style={{ maxWidth: 640 }}>
          <Icon name="info" strokeWidth={1.9} />
          <span>
            This payment method is no longer configured. Do not send funds using old instructions; contact support if you
            already paid.
          </span>
        </p>
      ) : null}

      {gateway && awaitingSend && qr ? (
        <div className="pay-grid">
          <section className="panel">
            <header>
              <h2>Send exactly</h2>
              <span>
                {gateway.asset} · {gateway.networkLabel}
              </span>
            </header>
            <div className="panel-body pay-steps">
              <div className="pay-step">
                <span className="pay-step-n" aria-hidden="true">1</span>
                <div className="pay-step-body">
                  <span className="pay-step-label" id="pay-amount-label">Amount</span>
                  <div className="pay-value">
                    <span className="pay-amount" aria-labelledby="pay-amount-label">
                      {coded ? (
                        <>
                          {payText.slice(0, -2)}
                          <mark className="pay-code">{code}</mark>
                        </>
                      ) : (
                        payText
                      )}
                      <span className="pay-unit">{gateway.asset}</span>
                    </span>
                    <CopyButton value={payText} label="amount" />
                  </div>
                  <p className="pay-hint">
                    {coded ? (
                      <>
                        The last two digits, <strong>{code}</strong>, are this invoice&rsquo;s code — they are how we
                        recognise your payment. Send the amount exactly as shown.
                      </>
                    ) : (
                      'Send exactly this amount.'
                    )}
                  </p>
                </div>
              </div>

              <div className="pay-step">
                <span className="pay-step-n" aria-hidden="true">2</span>
                <div className="pay-step-body">
                  <span className="pay-step-label">Network</span>
                  <div className="pay-network">{gateway.networkLabel}</div>
                  <p className="pay-hint">
                    Binance lists it as <strong>BNB Smart Chain (BEP20)</strong>; Trust Wallet and MetaMask as{' '}
                    <strong>BNB Smart Chain</strong>. USDT sent on TRON (TRC20), Ethereum (ERC20) or any other network
                    will not arrive.
                  </p>
                </div>
              </div>

              <div className="pay-step">
                <span className="pay-step-n" aria-hidden="true">3</span>
                <div className="pay-step-body">
                  <span className="pay-step-label">To this address</span>
                  <div className="pay-address">
                    <div className="pay-qr">
                      <svg viewBox={`0 0 ${qr.size} ${qr.size}`} role="img" aria-label="QR code of the wallet address" shapeRendering="crispEdges">
                        <rect className="qr-paper" width={qr.size} height={qr.size} />
                        <path className="qr-ink" d={qr.path} />
                      </svg>
                    </div>
                    <div className="pay-address-text">
                      <code>{gateway.address}</code>
                      <CopyButton value={gateway.address} label="wallet address" />
                      <p className="pay-hint">
                        Scan it from your exchange app, or copy it. After pasting, check the first and last few
                        characters match.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {coded && tolerance > 0 ? (
                <p className="alert">
                  <Icon name="info" strokeWidth={1.9} />
                  <span>
                    If your exchange takes its withdrawal fee out of the amount, that is fine: up to{' '}
                    {formatUsd(tolerance)} short is still credited in full. Any other amount is credited as it arrives.
                  </span>
                </p>
              ) : null}
            </div>
          </section>

          <section className="panel">
            <header>
              <h2>Status</h2>
              <span>Invoice {shortReference(invoice.reference)}</span>
            </header>
            <div className="panel-body pay-side">
              <InvoiceLiveStatus
                reference={invoice.reference}
                csrfToken={session.csrfToken}
                initial={live}
                reservedUntil={reservationEndsAt(invoice).toISOString()}
                nextStep={nextStep}
              />
              <hr className="hairline" />
              <dl className="pay-summary">
                <div>
                  <dt>Credit</dt>
                  <dd>{formatUsd(invoice.credit_amount_cents)}</dd>
                </div>
                <div>
                  <dt>Network fee</dt>
                  <dd>{formatUsd(invoice.fee_cents)}</dd>
                </div>
                <div>
                  <dt>You send</dt>
                  <dd>
                    <strong>
                      {payText} {gateway.asset}
                    </strong>
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </div>
      ) : null}

      {gateway && !awaitingSend ? (
        <section className="panel" style={{ maxWidth: 640 }}>
          <header>
            <h2>{settled ? 'Settled' : open ? 'In review' : 'Invoice'}</h2>
            <span>Invoice {shortReference(invoice.reference)}</span>
          </header>
          <div className="panel-body pay-side">
            <InvoiceLiveStatus
              reference={invoice.reference}
              csrfToken={session.csrfToken}
              initial={live}
              reservedUntil={reservationEndsAt(invoice).toISOString()}
              nextStep={nextStep}
            />
            <hr className="hairline" />
            <dl className="pay-summary">
              <div>
                <dt>Credit added</dt>
                <dd>{settled ? formatUsd(creditedCents) : '—'}</dd>
              </div>
              <div>
                <dt>{settled ? 'Received' : 'Asked'}</dt>
                <dd>
                  {invoice.received_e4 !== null
                    ? `${formatE4(invoice.received_e4)} USDT`
                    : `${payText} ${gateway.asset}`}
                </dd>
              </div>
              {invoice.payment_reference ? (
                <div>
                  <dt>Transaction</dt>
                  <dd>
                    {/^0x[0-9a-f]{64}$/.test(invoice.payment_reference) ? (
                      <a className="tx-link" href={explorerTxUrl(invoice.payment_reference)} target="_blank" rel="noreferrer">
                        {invoice.payment_reference.slice(0, 10)}…{invoice.payment_reference.slice(-6)}
                      </a>
                    ) : (
                      <span className="t-mono">{invoice.payment_reference}</span>
                    )}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </section>
      ) : null}

      {open && selfApprovalEnabled() ? (
        <>
          <div style={{ height: 20 }} />
          <section className="panel" style={{ maxWidth: 560 }}>
            <header>
              <h2>Rehearsal only</h2>
            </header>
            <div className="panel-body" style={{ display: 'grid', gap: 12 }}>
              <p className="t-small">No administrator in this build — use this to walk the invoice through to settled.</p>
              <ApproveInvoiceForm reference={invoice.reference} />
            </div>
          </section>
        </>
      ) : null}
    </>
  )
}
