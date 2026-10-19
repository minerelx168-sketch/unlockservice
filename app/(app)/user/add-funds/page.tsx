import type { Metadata } from 'next'
import Link from 'next/link'
import { CryptoDepositFlow } from '@/components/crypto-deposit-flow'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { MIN_TOPUP_CENTS, MAX_TOPUP_CENTS, GATEWAYS } from '@/lib/payments'
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
  const cryptoGateways = GATEWAYS.filter(gateway => gateway.chainKind === 'evm' && gateway.chainId === 56)
  const ready = cryptoGateways.length > 0
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
                ? `You need ${formatUsd(shortfall)} more credit. Add ${formatUsd(MIN_TOPUP_CENTS)}–${formatUsd(MAX_TOPUP_CENTS)} per top-up.`
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
        cryptocurrency={ready ? <CryptoDepositFlow
          csrfToken={session.csrfToken}
          gateways={cryptoGateways.map(gateway => ({ id: gateway.id, asset: gateway.asset, feeBasisPoints: gateway.feeBasisPoints }))}
          minCents={MIN_TOPUP_CENTS} maxCents={MAX_TOPUP_CENTS}
          initialCents={shortfall > 0 ? Math.min(MAX_TOPUP_CENTS, Math.max(MIN_TOPUP_CENTS, shortfall)) : 1000}
          returnTo={returnTo}
        /> : undefined}
      /> : <p className="alert" role="status">
        <Icon name="info" strokeWidth={1.9} />
        <span>Top-ups are temporarily unavailable. <Link href="/contact">Contact support</Link> for help;
          do not send a payment until the payment details appear on your request.</span>
      </p>}
    </>
  )
}
