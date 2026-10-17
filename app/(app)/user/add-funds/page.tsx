import type { Metadata } from 'next'
import Link from 'next/link'
import { AddFundsForm } from '@/components/payment-forms'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { MAX_TOPUP_CENTS, GATEWAYS } from '@/lib/payments'
import { formatUsd } from '@/lib/money'
import { listPaidReportProducts } from '@/lib/paid-reports'
import { whopCheckoutEnabled, WHOP_MIN_CENTS, WHOP_MAX_CENTS } from '@/lib/whop'
import { WhopPaymentForm } from '@/components/whop-payment-form'

export const metadata: Metadata = { title: 'Add funds' }
export const dynamic = 'force-dynamic'

export default async function AddFundsPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { user, session } = await requireSession()
  const productCode = (await searchParams).product
  const product = productCode ? listPaidReportProducts().find((entry) => entry.code === productCode && entry.providerReady) : undefined
  const available = user.credit_cents - user.held_cents
  const shortfall = product ? Math.max(0, product.priceCents - available) : 0
  const returnTo = product ? `/user/reports/new?product=${encodeURIComponent(product.code)}` : null
  const ready = GATEWAYS.length > 0
  const cardReady = whopCheckoutEnabled()

  return (
    <>
      <section className="funding-hero">
        <div>
          <span className="eyebrow">Secure account funding</span>
          <h1>Add credit to your account.</h1>
          <p>
            Choose an available payment method. Your credit is added after payment has been verified.
          </p>
        </div>
        <div className="funding-balance-card">
          <span>Available credit</span>
          <strong>{formatUsd(available)}</strong>
          <small>{ready || cardReady ? 'Automatic verification ready' : 'Payment channel unavailable'}</small>
        </div>
      </section>

      {cardReady ? <section className="panel funding-panel" aria-label="Pay by card">
        <header><h2>Credit or debit card</h2><p className="t-small">Secure checkout powered by Whop</p></header>
        <div className="panel-body"><WhopPaymentForm csrfToken={session.csrfToken}
          minCents={WHOP_MIN_CENTS} maxCents={WHOP_MAX_CENTS}
          initialCents={shortfall > 0 ? Math.min(WHOP_MAX_CENTS, Math.max(WHOP_MIN_CENTS, shortfall)) : undefined} /></div>
      </section> : null}

      <ol className="funding-progress" aria-label="Token payment process">
        <li><span>1</span><strong>Choose amount</strong><small>Preview the exact total</small></li>
        <li><span>2</span><strong>Create request</strong><small>Numbers are locked</small></li>
        <li><span>3</span><strong>Send and paste ID</strong><small>Match the selected network</small></li>
        <li><span>4</span><strong>Credit verified</strong><small>Added once on confirmation</small></li>
      </ol>

      {product && returnTo ? (
        <section className="panel checkout-funding-summary" aria-label="Your selected report">
          <header><h2>{product.name}</h2><span>{formatUsd(product.priceCents)}</span></header>
          <div className="panel-body">
            <p className="t-small">
              Available credit: {formatUsd(available)}.{' '}
              {shortfall > 0
                ? `Add ${formatUsd(shortfall)} to cover the exact shortfall, or choose a larger amount for future orders.`
                : 'You already have enough credit for this report.'}
            </p>
            <Link className="link-arrow" href={returnTo}>Return to this report</Link>
          </div>
        </section>
      ) : null}

      <div className="funding-layout">
        <section className="panel funding-panel">
          <header>
            <div>
              <h2>Pay with cryptocurrency</h2>
              <p className="t-small">Select one token and network; your invoice locks the verified route before you send.</p>
            </div>
            <span>No minimum top-up</span>
          </header>
          <div className="panel-body">
            {ready ? (
              <AddFundsForm
                gateways={GATEWAYS.map((gateway) => ({
                  id: gateway.id,
                  label: gateway.label,
                  asset: gateway.asset,
                  network: gateway.network,
                  feeBasisPoints: gateway.feeBasisPoints,
                  automaticVerification: gateway.automaticVerification,
                  riskClassification: gateway.riskClassification,
                }))}
                maxCents={MAX_TOPUP_CENTS}
                initialCents={shortfall > 0 ? Math.min(MAX_TOPUP_CENTS, shortfall) : undefined}
                returnTo={returnTo}
              />
            ) : (
              <p className="alert" role="status">
                <Icon name="info" strokeWidth={1.9} />
                <span>
                  Automatic top-ups are temporarily unavailable. <Link href="/contact">Contact support</Link> for help;
                  do not send a payment until the wallet and verification channel appear on this page.
                </span>
              </p>
            )}
          </div>
        </section>

        <aside className="funding-assurance" aria-label="Payment safety">
          <div>
            <Icon name="shield" strokeWidth={1.9} />
            <h2>Before you send</h2>
          </div>
          <p>Use only the token, network, amount and wallet shown on your invoice.</p>
          <Link className="link-arrow" href="/user/payments">View payment history</Link>
        </aside>
      </div>
    </>
  )
}
