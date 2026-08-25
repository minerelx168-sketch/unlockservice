import type { Metadata } from 'next'
import { AddFundsForm } from '@/components/payment-forms'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { MIN_TOPUP_CENTS, GATEWAYS } from '@/lib/payments'
import { formatUsd } from '@/lib/money'

export const metadata: Metadata = { title: 'Add funds' }
export const dynamic = 'force-dynamic'

export default async function AddFundsPage() {
  await requireSession()

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Add funds</h1>
          <p>
            Credit pays for unlock orders. Fees, tax and the final amount are locked into the
            invoice the moment it is created, so the number you see is the number you pay — and the
            credit lands once the transfer is confirmed.
          </p>
        </div>
      </div>

      <div className="panel" style={{ maxWidth: 560 }}>
        <header>
          <h2>New invoice</h2>
          <span>Minimum {formatUsd(MIN_TOPUP_CENTS)}</span>
        </header>
        <div className="panel-body">
          {GATEWAYS.length > 0 ? (
            <AddFundsForm
              gateways={GATEWAYS.map((gateway) => ({
                id: gateway.id,
                label: gateway.label,
                asset: gateway.asset,
                network: gateway.network,
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
