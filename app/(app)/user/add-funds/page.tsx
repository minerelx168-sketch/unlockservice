import type { Metadata } from 'next'
import Link from 'next/link'
import { AddFundsForm } from '@/components/payment-forms'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { MAX_TOPUP_CENTS, GATEWAYS } from '@/lib/payments'
import { watchableRoute } from '@/lib/payment-watcher'
import { formatUsd } from '@/lib/money'
import { listPaidReportProducts } from '@/lib/paid-reports'
import { whopCheckoutEnabled, WHOP_MIN_CENTS, WHOP_MAX_CENTS } from '@/lib/whop'
import { WhopPaymentForm } from '@/components/whop-payment-form'
import { FundingMethodSelector } from '@/components/funding-method-selector'

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
  const autoDetecting = GATEWAYS.some((gateway) => watchableRoute(gateway))
  const onlyBep20 = GATEWAYS.length > 0 && GATEWAYS.every((gateway) => gateway.chainKind === 'evm' && gateway.chainId === 56)
  const cardReady = whopCheckoutEnabled()

  return (
    <>
      <section className="funding-hero">
        <div>
          <span className="eyebrow">Secure account funding</span>
          <h1>{cardReady ? 'Add credit to your account.' : onlyBep20 ? 'Add funds on BEP20.' : 'Add funds with USDT or USDC.'}</h1>
          <p>
            {cardReady
              ? 'Choose how you want to pay, then enter your credit amount. Your credit is added after payment has been verified.'
              : onlyBep20
              ? 'Choose USDT or USDC on BEP20 (BNB Smart Chain). We’ll create a payment request with the exact amount, wallet address and QR code. Send only after you see those details.'
              : 'Enter your credit amount and choose a network. We’ll create a payment request with the exact amount, wallet address and QR code. Send only after you see those details.'}
          </p>
        </div>
        <div className="funding-balance-card">
          <span>Available credit</span>
          <strong>{formatUsd(available)}</strong>
          <small>{cardReady || ready ? 'Ready for your next order' : 'Payment channel unavailable'}</small>
        </div>
      </section>

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

      {cardReady || ready ? <FundingMethodSelector
        cryptoDescription={onlyBep20 ? 'USDT or USDC on BEP20 (BNB Smart Chain)' : 'Choose an available token and network'}
        card={cardReady ? <section className="panel funding-panel" aria-label="Pay by card">
          <header><h2>Credit or debit card</h2><p className="t-small">Secure checkout powered by Whop</p></header>
          <div className="panel-body"><WhopPaymentForm csrfToken={session.csrfToken}
            minCents={WHOP_MIN_CENTS} maxCents={WHOP_MAX_CENTS}
            initialCents={shortfall > 0 ? Math.min(WHOP_MAX_CENTS, Math.max(WHOP_MIN_CENTS, shortfall)) : undefined} /></div>
        </section> : undefined}
        cryptocurrency={ready ? <>
          <ol className="funding-journey" aria-label={cardReady ? 'How cryptocurrency funding works' : 'How adding funds works'}>
            <li><span>01</span><div><strong>Choose amount and network</strong><small>Set how much credit you want.</small></div></li>
            <li><span>02</span><div><strong>Copy your payment details</strong><small>See the exact amount, address and QR on your request.</small></div></li>
            <li><span>03</span><div><strong>Send and track</strong><small>{autoDetecting ? 'We detect eligible transfers automatically.' : 'Send your transaction ID for manual review.'}</small></div></li>
          </ol>
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
        </> : undefined}
      /> : <p className="alert" role="status">
        <Icon name="info" strokeWidth={1.9} />
        <span>Top-ups are temporarily unavailable. <Link href="/contact">Contact support</Link> for help;
          do not send a payment until the payment details appear on your request.</span>
      </p>}
    </>
  )
}
