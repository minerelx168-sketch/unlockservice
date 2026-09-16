import type { Metadata } from 'next'
import Link from 'next/link'
import { AddFundsForm } from '@/components/payment-forms'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { MAX_TOPUP_CENTS, GATEWAYS } from '@/lib/payments'
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

  return (
    <>
      <section className="funding-hero">
        <div>
          <span className="eyebrow">Secure account funding</span>
          <h1>Add credit in four clear steps.</h1>
          <p>
            Create a locked payment request, send the exact USDT amount on BNB Smart Chain,
            then paste the transaction hash. Verification and credit delivery are automatic.
          </p>
        </div>
        <div className="funding-balance-card">
          <span>Available credit</span>
          <strong>{formatUsd(available)}</strong>
          <small>{ready ? 'Automatic verification ready' : 'Payment channel unavailable'}</small>
        </div>
      </section>

      <ol className="funding-progress" aria-label="Add funds process">
        <li><span>1</span><strong>Choose amount</strong><small>Preview the exact total</small></li>
        <li><span>2</span><strong>Create request</strong><small>Numbers are locked</small></li>
        <li><span>3</span><strong>Send and paste hash</strong><small>Use BEP-20 only</small></li>
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
              <h2>Create payment request</h2>
              <p className="t-small">One method, one network, and a locked amount before you send.</p>
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
          <p>Only send the listed USDT token on BNB Smart Chain (BEP-20). Other networks and tokens cannot be auto-verified.</p>
          <p>Copy the exact amount and wallet from your invoice. Never reuse a transaction hash for another invoice.</p>
          <p>iUnlockMobile will never ask for your wallet password, private key, seed phrase, or remote wallet access.</p>
          <Link className="link-arrow" href="/user/payments">View payment history</Link>
        </aside>
      </div>
    </>
  )
}
