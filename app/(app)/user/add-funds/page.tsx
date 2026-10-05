import type { Metadata } from 'next'
import Link from 'next/link'
import { AddFundsForm } from '@/components/payment-forms'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { MAX_TOPUP_CENTS, GATEWAYS } from '@/lib/payments'
import { watchableRoute } from '@/lib/payment-watcher'
import { formatUsd } from '@/lib/money'
import { listPaidReportProducts } from '@/lib/paid-reports'

export const metadata: Metadata = { title: 'Add funds' }
export const dynamic = 'force-dynamic'

export default async function AddFundsPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { user } = await requireSession()
  const productCode = (await searchParams).product
  const product = productCode ? listPaidReportProducts().find((entry) => entry.code === productCode && entry.providerReady) : undefined
  const available = user.credit_cents - user.held_cents
  const shortfall = product ? Math.max(0, product.priceCents - available) : 0
  const returnTo = product ? `/user/reports/new?product=${encodeURIComponent(product.code)}` : null
  const ready = GATEWAYS.length > 0
  const autoDetecting = GATEWAYS.some((gateway) => watchableRoute(gateway))

  return (
    <>
      <section className="funding-hero">
        <div>
          <span className="eyebrow">Secure account funding</span>
          <h1>Add funds with USDT or USDC.</h1>
          <p>
            Enter your credit amount and choose a network. We’ll create a payment request with the exact amount,
            wallet address and QR code. Send only after you see those details.
          </p>
        </div>
        <div className="funding-balance-card">
          <span>Available credit</span>
          <strong>{formatUsd(available)}</strong>
          <small>{autoDetecting ? 'On-chain payment detection active' : ready ? 'Manual verification available' : 'Payment channel unavailable'}</small>
        </div>
      </section>

      <ol className="funding-journey" aria-label="How adding funds works">
        <li><span>01</span><div><strong>Choose amount and network</strong><small>Set how much credit you want.</small></div></li>
        <li><span>02</span><div><strong>Copy your payment details</strong><small>See the exact amount, address and QR on your request.</small></div></li>
        <li><span>03</span><div><strong>Send and track</strong><small>{autoDetecting ? 'We detect eligible transfers automatically.' : 'Send your transaction ID for manual review.'}</small></div></li>
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
              <h2>Set up your payment</h2>
              <p className="t-small">Choose your credit amount and the token/network you will use. Review the exact transfer instructions next.</p>
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
                  automaticVerification: watchableRoute(gateway),
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
                  Top-ups are temporarily unavailable. <Link href="/contact">Contact support</Link> for help;
                  do not send a payment until the payment details appear on your request.
                </span>
              </p>
            )}
          </div>
        </section>

        <aside className="funding-assurance" aria-label="Payment safety">
          <div>
            <Icon name="shield" strokeWidth={1.9} />
            <h2>Pay only from your request</h2>
          </div>
          <p>The exact token amount and wallet address appear after you create a request. Check the network and token before sending; an old payment request may no longer be valid.</p>
          <p>{autoDetecting ? 'Your request updates as we check the chain. You can close the page; paste a transaction ID only if the payment is not detected.' : 'Keep your transaction ID for manual verification after sending.'}</p>
          <Link className="link-arrow" href="/user/payments">View payment history</Link>
        </aside>
      </div>
    </>
  )
}
