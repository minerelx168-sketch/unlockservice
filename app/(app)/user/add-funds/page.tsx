import type { Metadata } from 'next'
import { AddFundsForm } from '@/components/payment-forms'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { formatUsd, parseUsd } from '@/lib/money'
import { GATEWAYS, MAX_TOPUP_CENTS, MIN_TOPUP_CENTS } from '@/lib/payments'

export const metadata: Metadata = { title: 'Add funds' }
export const dynamic = 'force-dynamic'

export default async function AddFundsPage({
  searchParams,
}: {
  searchParams: Promise<{ amount?: string }>
}) {
  await requireSession()

  /* An order page that was short of credit links here with the shortfall,
     so the customer tops up exactly what they need instead of guessing. */
  const { amount } = await searchParams
  const asked = parseUsd(String(amount ?? ''))
  const defaultAmount =
    asked === null
      ? undefined
      : (Math.min(Math.max(asked, MIN_TOPUP_CENTS), MAX_TOPUP_CENTS) / 100).toFixed(2).replace(/\.00$/, '')

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Add funds</h1>
          <p>
            Credit pays for orders. Pick an amount and you get one exact USDT figure to send — the credit is added by
            itself as soon as the transfer arrives.
          </p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 560 }}>
        <header>
          <h2>Top up</h2>
          <span>Minimum {formatUsd(MIN_TOPUP_CENTS)}</span>
        </header>
        <div className="panel-body">
          {GATEWAYS.length > 0 ? (
            <AddFundsForm
              defaultAmount={defaultAmount}
              gateways={GATEWAYS.map((gateway) => ({
                id: gateway.id,
                label: gateway.label,
                asset: gateway.asset,
                network: gateway.network,
                networkLabel: gateway.networkLabel,
              }))}
            />
          ) : (
            <p className="alert" role="status">
              <Icon name="info" strokeWidth={1.9} />
              <span>
                Top-ups are temporarily unavailable. No payment destination has been configured, so
                the system will not display a placeholder address or accept a payment reference.
              </span>
            </p>
          )}
        </div>
      </div>
    </>
  )
}
