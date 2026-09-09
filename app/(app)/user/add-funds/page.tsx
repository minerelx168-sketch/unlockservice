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

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Add funds</h1>
          <p>
            Add credit for reports and unlock orders. Review the total before creating your invoice.
            Credit becomes available after your transfer is verified.
          </p>
        </div>
      </div>

      {product && returnTo ? (
        <section className="panel checkout-funding-summary" aria-label="Your selected report">
          <header><h2>{product.name}</h2><span>{formatUsd(product.priceCents)}</span></header>
          <div className="panel-body">
            <p className="t-small">Available credit: {formatUsd(available)}. {shortfall > 0 ? `You need ${formatUsd(shortfall)} more. Add just the missing credit — no minimum top-up.` : 'You already have enough credit for this report.'}</p>
            <Link className="link-arrow" href={returnTo}>Return to this report</Link>
          </div>
        </section>
      ) : null}

      <div className="panel" style={{ maxWidth: 560 }}>
        <header>
          <h2>New invoice</h2>
          <span>No minimum top-up</span>
        </header>
        <div className="panel-body">
          {GATEWAYS.length > 0 ? (
            <AddFundsForm
              gateways={GATEWAYS.map((gateway) => ({
                id: gateway.id,
                label: gateway.label,
                asset: gateway.asset,
                network: gateway.network,
                feeBasisPoints: gateway.feeBasisPoints,
              }))}
              maxCents={MAX_TOPUP_CENTS}
              initialCents={shortfall > 0 ? Math.min(MAX_TOPUP_CENTS, shortfall) : undefined}
              returnTo={returnTo}
            />
          ) : (
            <p className="alert" role="status">
              <Icon name="info" strokeWidth={1.9} />
              <span>
                Top-ups are temporarily unavailable. <Link href="/contact">Contact support</Link> for help; do not send a payment until a payment method is available here.
              </span>
            </p>
          )}
        </div>
      </div>
    </>
  )
}
