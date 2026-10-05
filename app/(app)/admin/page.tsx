import type { Metadata } from 'next'
import { adminOverview, listAdminUsers } from '@/lib/admin'
import { listAdminCreditAdjustments } from '@/lib/admin-credit-adjustments'
import { requireAdmin } from '@/lib/auth'
import { formatUsd } from '@/lib/money'
import { AdminCreditAdjustment } from '@/components/admin-credit-adjustment'
import { ConfirmInvoiceButton, DismissTransferButton, RejectInvoiceButton, ScanNowButton } from '@/components/admin-payments'
import { explorerTxUrl, formatE4 } from '@/lib/bsc'
import { shortReference } from '@/lib/payments'
import { countUnmatchedTransfers, invoicesNeedingReview, unmatchedTransfers, watcherHealth } from '@/lib/usdt'

function ago(iso: string | null): string {
  if (!iso) return 'never'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
  if (seconds < 90) return `${seconds}s ago`
  if (seconds < 5_400) return `${Math.round(seconds / 60)} min ago`
  return `${Math.round(seconds / 3_600)} h ago`
}

function shortHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`
}

export const metadata: Metadata = { title: 'Control panel' }
export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const { user: administrator, session } = await requireAdmin()
  const overview = adminOverview()
  const users = listAdminUsers(100)
  const adjustments = listAdminCreditAdjustments(25)
  const watcher = watcherHealth()
  const reviews = invoicesNeedingReview(50)
  const strays = unmatchedTransfers(50)
  const strayTotal = countUnmatchedTransfers()
  const watcherStale = watcher.configured && (!watcher.lastOkAt || Date.now() - new Date(watcher.lastOkAt).getTime() > 5 * 60_000)

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Control panel</h1>
          <p>Signed in as {administrator.username}. Administrator access and every financial mutation are enforced on the server.</p>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <span className="label">Accounts</span>
          <span className="value">{overview.users}</span>
          <span className="caption">{overview.activeUsers} active</span>
        </div>
        <div className="stat">
          <span className="label">Administrators</span>
          <span className="value">{overview.admins}</span>
          <span className="caption">Server-side RBAC enabled</span>
        </div>
        <div className="stat">
          <span className="label">Orders</span>
          <span className="value">{overview.orders}</span>
          <span className="caption">{overview.processingOrders} processing</span>
        </div>
        <div className="stat">
          <span className="label">Payments needing you</span>
          <span className="value">{reviews.length + strayTotal}</span>
          <span className="caption">{overview.pendingInvoices} invoices open or in review</span>
        </div>
      </div>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <div>
            <h2>USDT payments needing a decision</h2>
            <p className="t-small">
              Transfers carrying an invoice&rsquo;s code are credited automatically. What is left here arrived without
              one, or a customer pointed at it — check it, then confirm or dismiss.
            </p>
          </div>
          <span>
            {reviews.length + strayTotal} open
            {strayTotal > strays.length ? ` · newest ${strays.length} unmatched shown` : ''}
          </span>
        </header>
        <div className="panel-body" style={{ display: 'grid', gap: 18 }}>
          <div className="watcher-line">
            <span className={!watcher.configured ? 'badge badge--muted' : watcher.lastError || watcherStale ? 'badge badge--error' : 'badge badge--success'}>
              {!watcher.configured ? 'No wallet configured' : watcher.lastError ? 'Watcher failing' : watcherStale ? 'Watcher stale' : 'Watching'}
            </span>
            {watcher.configured ? (
              <>
                <span>RPC {watcher.rpcHost}</span>
                <span>Last good scan {ago(watcher.lastOkAt)}</span>
                <span>Block {watcher.lastBlock ?? '—'}</span>
                <span>{watcher.confirmations} confirmations</span>
                <ScanNowButton csrfToken={session.csrfToken} />
              </>
            ) : null}
          </div>
          <p className="t-small" style={{ fontSize: 13 }}>
            Money that arrived before its sender created an invoice can&rsquo;t be attached to one. Credit it with
            &ldquo;Adjust user credit&rdquo; below, then dismiss the transfer with a note naming the adjustment.
          </p>
          {watcher.lastError ? (
            <p className="alert alert--error" role="alert" style={{ margin: 0 }}>
              <span>{watcher.lastError}</span>
            </p>
          ) : null}
        </div>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Customer</th>
                <th className="num">Asked</th>
                <th>Evidence</th>
                <th>Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reviews.map((row) => (
                <tr key={row.reference}>
                  <td className="mono">{shortReference(row.reference)}</td>
                  <td>
                    <strong>{row.username}</strong>
                    <div className="t-small">{row.email}</div>
                  </td>
                  <td className="num">
                    {row.pay_amount_e4 !== null ? `${formatE4(row.pay_amount_e4)} USDT` : formatUsd(row.total_due_cents)}
                  </td>
                  <td>
                    {row.transfer_tx_hash ? (
                      <>
                        <a className="tx-link" href={explorerTxUrl(row.transfer_tx_hash)} target="_blank" rel="noreferrer">
                          {shortHash(row.transfer_tx_hash)}
                        </a>
                        <div className="t-small">
                          On chain: {formatE4(row.transfer_amount_e4 ?? 0)} USDT, no code · from{' '}
                          <span className="mono">{shortHash(row.transfer_from ?? '')}</span> ·{' '}
                          {(row.transfer_time ?? '').replace('T', ' ').slice(0, 16)} UTC
                        </div>
                        {row.rivals ? (
                          <div className="t-small" style={{ color: 'var(--danger)' }}>
                            Disputed — also claimed by {row.rivals}. Check the sender against each customer before choosing.
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <>
                        <span className="mono">{row.payment_reference ?? '—'}</span>
                        <div className="t-small">
                          {row.payment_reference && /^(0x)?[0-9a-fA-F]{64}$/.test(row.payment_reference.trim())
                            ? 'Transaction hash not seen yet — confirming checks it on the chain first'
                            : 'Reference from before automatic detection — check it yourself'}
                        </div>
                      </>
                    )}
                  </td>
                  <td>{row.updated_at.replace('T', ' ').slice(0, 16)} UTC</td>
                  <td>
                    <ConfirmInvoiceButton
                      csrfToken={session.csrfToken}
                      reference={row.reference}
                      transferId={row.transfer_id ?? undefined}
                      summary={
                        row.transfer_tx_hash
                          ? `Credit ${row.username} for ${formatE4(row.transfer_amount_e4 ?? 0)} USDT received on chain from ${row.transfer_from}?${
                              row.rivals ? ` Another invoice (${row.rivals}) claims the same transfer and will be sent back to unpaid.` : ''
                            }`
                          : `Credit ${row.username} ${formatUsd(row.credit_amount_cents)} against reference ${row.payment_reference ?? '(none)'}?`
                      }
                    />
                    <RejectInvoiceButton csrfToken={session.csrfToken} reference={row.reference} />
                  </td>
                </tr>
              ))}
              {strays.map((row) => (
                <tr key={`t-${row.id}`}>
                  <td className="t-small">No invoice</td>
                  <td>
                    <span className="mono">{shortHash(row.from_address)}</span>
                    <div className="t-small">sender</div>
                  </td>
                  <td className="num">{formatE4(row.amount_e4)} USDT</td>
                  <td>
                    <a className="tx-link" href={explorerTxUrl(row.tx_hash)} target="_blank" rel="noreferrer">
                      {shortHash(row.tx_hash)}
                    </a>
                    <div className="t-small">{row.note ?? 'Arrived without a matching code'}</div>
                  </td>
                  <td>{row.block_time.replace('T', ' ').slice(0, 16)} UTC</td>
                  <td style={{ display: 'grid', gap: 8 }}>
                    {row.candidates.map((candidate) => (
                      <ConfirmInvoiceButton
                        key={candidate.reference}
                        csrfToken={session.csrfToken}
                        reference={candidate.reference}
                        transferId={row.id}
                        label={`Credit to ${candidate.username} ${shortReference(candidate.reference)}`}
                        summary={`Credit ${formatE4(row.amount_e4)} USDT to ${candidate.username}'s invoice ${shortReference(candidate.reference)} (asked ${
                          candidate.pay_amount_e4 !== null ? `${formatE4(candidate.pay_amount_e4)} USDT` : formatUsd(candidate.total_due_cents)
                        })?`}
                      />
                    ))}
                    {row.candidates.length === 0 ? (
                      <span className="t-small">No open invoice near this amount.</span>
                    ) : null}
                    <DismissTransferButton csrfToken={session.csrfToken} transferId={row.id} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {reviews.length + strays.length === 0 ? <p className="empty">Nothing waiting. Every payment found its invoice.</p> : null}
        </div>
      </section>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <div>
            <h2>Adjust user credit</h2>
            <p className="t-small">Add or remove USD credit through the existing append-only ledger. A reason and confirmation are required.</p>
          </div>
          <span>Maximum ±{formatUsd(1_000_000)} per action</span>
        </header>
        <div className="panel-body">
          <AdminCreditAdjustment csrfToken={session.csrfToken} users={users} />
        </div>
      </section>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <div>
            <h2>Recent credit adjustments</h2>
            <p className="t-small">Permanent administrator audit. Rows cannot be edited or deleted.</p>
          </div>
          <span>{adjustments.length} shown</span>
        </header>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>Reference</th>
                <th>User</th>
                <th>Administrator</th>
                <th className="num">Amount</th>
                <th className="num">Available after</th>
                <th>Reason</th>
                <th>Recorded</th>
              </tr>
            </thead>
            <tbody>
              {adjustments.map((adjustment) => (
                <tr key={adjustment.public_id}>
                  <td className="mono">{adjustment.public_id}</td>
                  <td>
                    <strong>{adjustment.target_username}</strong>
                    <div className="t-small">{adjustment.target_email}</div>
                  </td>
                  <td>{adjustment.admin_username}</td>
                  <td className="num">
                    <span className={adjustment.amount_cents >= 0 ? 'money-positive' : 'money-negative'}>
                      {adjustment.amount_cents >= 0 ? '+' : ''}{formatUsd(adjustment.amount_cents)}
                    </span>
                  </td>
                  <td className="num">{formatUsd(adjustment.credit_after_cents - adjustment.held_after_cents)}</td>
                  <td>{adjustment.reason}</td>
                  <td>{adjustment.created_at.replace('T', ' ').slice(0, 16)} UTC</td>
                </tr>
              ))}
            </tbody>
          </table>
          {adjustments.length === 0 ? <p className="empty">No administrator credit adjustments yet.</p> : null}
        </div>
      </section>

      <div style={{ height: 22 }} />

      <section className="panel">
        <header>
          <div>
            <h2>Accounts</h2>
            <p className="t-small">Up to 100 recent accounts. Password hashes and session tokens are never displayed.</p>
          </div>
          <span>{users.length} shown</span>
        </header>
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Status</th>
                <th>Tier</th>
                <th className="num">Available credit</th>
                <th className="num">Held</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.username}</strong>
                    <div className="t-small">{user.email}</div>
                  </td>
                  <td>{user.account_type}</td>
                  <td>{user.status}</td>
                  <td>{user.membership_tier}</td>
                  <td className="num">{formatUsd(user.credit_cents - user.held_cents)}</td>
                  <td className="num">{formatUsd(user.held_cents)}</td>
                  <td>{user.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.length === 0 ? <p className="empty">No accounts yet.</p> : null}
        </div>
      </section>
    </>
  )
}
