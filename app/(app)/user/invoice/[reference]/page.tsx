import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { Icon } from '@/components/icons'
import { ApproveInvoiceForm, PaymentReferenceForm } from '@/components/payment-forms'
import { requireSession } from '@/lib/auth'
import { formatUsd } from '@/lib/money'
import { GATEWAYS, getInvoice, selfApprovalEnabled, shortReference } from '@/lib/payments'

export const metadata: Metadata = { title: 'Invoice' }
export const dynamic = 'force-dynamic'

export default async function InvoicePage({
  params,
}: {
  params: Promise<{ reference: string }>
}) {
  const { user } = await requireSession()
  const { reference } = await params
  const invoice = getInvoice(reference, user.id)
  if (!invoice) notFound()

  const gateway = GATEWAYS.find((entry) => entry.id === invoice.gateway)
  const settled = invoice.status === 'success'

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Invoice {shortReference(invoice.reference)}</h1>
          <p>
            {settled
              ? 'Settled. The credit is on your balance.'
              : 'Send the exact total below, then submit the transaction reference so it can be checked.'}
          </p>
        </div>
        <Link className="button button--quiet" href="/user/payments">
          All payments
        </Link>
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)' }}>
        <section className="panel">
          <header>
            <h2>Amount</h2>
            <span>{invoice.currency}</span>
          </header>
          <div className="panel-body">
            <dl className="result-grid">
              <div>
                <dt>Credit added</dt>
                <dd>{formatUsd(invoice.credit_amount_cents)}</dd>
              </div>
              <div>
                <dt>Network fee</dt>
                <dd>{formatUsd(invoice.fee_cents)}</dd>
              </div>
              <div>
                <dt>Tax</dt>
                <dd>{formatUsd(invoice.tax_cents)}</dd>
              </div>
              <div>
                <dt>Total due</dt>
                <dd>
                  <strong>{formatUsd(invoice.total_due_cents)}</strong>
                </dd>
              </div>
            </dl>
            <div style={{ height: 14 }} />
            <p className="t-small">
              Locked when the invoice was created. Credit is added only after the transfer is
              confirmed — never on submission.
            </p>
          </div>
        </section>

        <section className="panel">
          <header>
            <h2>Where to send it</h2>
            <span>{gateway ? `${gateway.asset} · ${gateway.network}` : invoice.gateway}</span>
          </header>
          <div className="panel-body" style={{ display: 'grid', gap: 14 }}>
            {gateway ? (
              <>
                <div className="field">
                  <label htmlFor="address">Wallet address</label>
                  <input id="address" className="mono" readOnly value={gateway.address} />
                </div>
                <p className="alert">
                  <Icon name="info" strokeWidth={1.9} />
                  <span>
                    Send only {gateway.asset} on {gateway.network}. Credit is issued after the
                    transaction is verified; submitting a reference never credits the wallet by itself.
                  </span>
                </p>
              </>
            ) : (
              <p className="alert alert--error" role="alert">
                <Icon name="info" strokeWidth={1.9} />
                <span>
                  This payment method is no longer configured. Do not send funds using old instructions;
                  contact support if you already paid.
                </span>
              </p>
            )}
          </div>
        </section>
      </div>

      <div style={{ height: 20 }} />

      <section className="panel" style={{ maxWidth: 560 }}>
        <header>
          <h2>{settled ? 'Confirmed' : invoice.payment_reference ? 'Submitted for review' : 'Confirm your transfer'}</h2>
        </header>
        <div className="panel-body" style={{ display: 'grid', gap: 16 }}>
          {settled ? (
            <p className="t-small">
              Reference <span className="t-mono">{invoice.payment_reference}</span> was accepted and{' '}
              {formatUsd(invoice.credit_amount_cents)} was added to your balance.
            </p>
          ) : (
            <>
              {invoice.payment_reference ? (
                <p className="t-small">
                  Waiting on a human to verify{' '}
                  <span className="t-mono">{invoice.payment_reference}</span>.
                </p>
              ) : null}
              {gateway ? <PaymentReferenceForm reference={invoice.reference} /> : null}
              {selfApprovalEnabled() ? (
                <>
                  <hr className="hairline" />
                  <p className="t-small">
                    No administrator in this build — use this to walk the invoice through to settled.
                  </p>
                  <ApproveInvoiceForm reference={invoice.reference} />
                </>
              ) : null}
            </>
          )}
        </div>
      </section>
    </>
  )
}
