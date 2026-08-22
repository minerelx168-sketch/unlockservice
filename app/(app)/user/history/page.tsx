import type { Metadata } from 'next'
import { StatusBadge } from '@/components/check-console'
import { requireSession } from '@/lib/auth'
import { listChecks } from '@/lib/checks'
import { listLedger } from '@/lib/credits'
import { maskIdentifier } from '@/lib/imei'
import { formatUsd } from '@/lib/money'

export const metadata: Metadata = { title: 'History' }
export const dynamic = 'force-dynamic'

const LEDGER_LABEL: Record<string, string> = {
  topup: 'Top-up',
  hold: 'Held for a check',
  charge: 'Check charged',
  refund: 'Credit restored',
  adjustment: 'Adjustment',
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { user } = await requireSession()
  const tab = (await searchParams).tab === 'usage' ? 'usage' : 'checks'

  const checks = listChecks(user.id, 50)
  const ledger = listLedger(user.id, 50)

  return (
    <>
      <div className="app-head">
        <div>
          <h1>History</h1>
          <p>Completed results stay readable here. Identifiers are masked to the first two and last four.</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a className={`button ${tab === 'checks' ? 'button--primary' : 'button--quiet'}`} href="?tab=checks">
            Checks
          </a>
          <a className={`button ${tab === 'usage' ? 'button--primary' : 'button--quiet'}`} href="?tab=usage">
            Credit movement
          </a>
        </div>
      </div>

      <div className="panel">
        {tab === 'checks' ? (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Identifier</th>
                  <th>Service</th>
                  <th>Status</th>
                  <th className="num">Price</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((row) => (
                  <tr key={row.id}>
                    <td className="mono">{maskIdentifier(row.identifier)}</td>
                    <td>{row.service_name}</td>
                    <td>
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="num">{formatUsd(row.sell_price_cents)}</td>
                    <td>{row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {checks.length === 0 ? <p className="empty">No checks yet.</p> : null}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="grid">
              <thead>
                <tr>
                  <th>Movement</th>
                  <th>Reference</th>
                  <th className="num">Amount</th>
                  <th className="num">Available after</th>
                  <th>When</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((row) => (
                  <tr key={row.id}>
                    <td>{LEDGER_LABEL[row.type] ?? row.type}</td>
                    <td className="mono">
                      {row.ref_type === 'invoice' && row.ref_id
                        ? `#${row.ref_id.slice(0, 10).toUpperCase()}`
                        : row.ref_id
                          ? `check ${row.ref_id}`
                          : '—'}
                    </td>
                    <td className="num">{formatUsd(row.amount_cents)}</td>
                    <td className="num">{formatUsd(row.balance_after_cents)}</td>
                    <td>{row.created_at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ledger.length === 0 ? <p className="empty">No credit movement yet.</p> : null}
          </div>
        )}
      </div>
    </>
  )
}
