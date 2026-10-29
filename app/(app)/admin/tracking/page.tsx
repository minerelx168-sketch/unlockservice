import Link from 'next/link'
import type { ReactNode } from 'react'
import { requireAdmin } from '@/lib/auth'
import { db } from '@/lib/db'
import { deliveryStartedAt, ga4Config } from '@/lib/ga4'
import { formatUsd } from '@/lib/money'
import { saveTrackingDailyAction } from '@/lib/tracking-actions'
import '@/styles/admin-analytics.css'
export const dynamic = 'force-dynamic'
export const metadata = { title: 'Tracking health | Control panel', robots: { index: false, follow: false } }

const DAYS = 14
type Daily = { day: string; ads_clicks: number | null; ga4_cpc_sessions: number | null; ads_conversions: number | null }
type EventRow = { transaction_id: string; event_name: string; kind: string; state: string; reason: string | null; value_cents: number | null;
  paid_cents: number | null; client_source: string | null; customer_type: string | null; paid_at: string }

const label = (v: string) => { const t = v.replaceAll('_', ' '); return t.charAt(0).toUpperCase() + t.slice(1) }
const tone = (state: string) => state === 'submitted' ? 'badge--success' : state === 'skipped' ? 'badge--muted' : 'badge--pending'
const pct = (a: number | null, b: number | null) => a && b !== null ? `${Math.round((b / a) * 100)}%` : '—'
const num = (v: number | null | undefined) => v === null || v === undefined ? '—' : v.toLocaleString()

function Stat({ label: l, value, note }: { label: string; value: ReactNode; note: string }) {
  return <div className="stat"><span className="label">{l}</span><span className="value">{value}</span><span className="caption">{note}</span></div>
}
function Counts({ items, empty }: { items: { key: string; label: string; count: number }[]; empty: string }) {
  if (!items.length) return <div className="analytics-empty"><p>{empty}</p></div>
  return <ul className="tracking-counts">{items.map(x => <li key={x.key}><span>{x.label}</span><strong>{x.count.toLocaleString()}</strong></li>)}</ul>
}

/** Paid by real customers, straight from the ledger and checkouts — independent of what GA4 was sent. */
function paidOrdersByDay(since: string) {
  const rows = db().prepare(`SELECT day, COUNT(*) n FROM (
      SELECT date(l.created_at) day FROM credit_ledger l JOIN users u ON u.id=l.user_id
        LEFT JOIN orders o ON l.ref_type='order' AND o.id=CAST(l.ref_id AS INTEGER)
        LEFT JOIN paid_report_orders r ON l.ref_type='paid_imei_report' AND r.id=CAST(l.ref_id AS INTEGER)
      WHERE l.type='charge' AND l.ref_type IN ('order','paid_imei_report') AND u.account_type!='admin' AND l.created_at>=?
        AND COALESCE(o.source,r.source)='website'
        AND NOT EXISTS(SELECT 1 FROM credit_ledger f WHERE f.user_id=l.user_id AND f.type='refund' AND f.ref_type=l.ref_type AND f.ref_id=l.ref_id)
      UNION ALL
      SELECT date(replace(substr(paid_at,1,19),'T',' ')) day FROM guest_checkouts
      WHERE environment='live' AND paid_at IS NOT NULL AND replace(substr(paid_at,1,19),'T',' ')>=? AND state NOT IN ('refunded','refund_pending')
    ) GROUP BY day`).all(since, since) as { day: string; n: number }[]
  return new Map(rows.map(r => [r.day, r.n]))
}

export default async function TrackingHealth({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  await requireAdmin()
  const { saved } = await searchParams
  const config = ga4Config()
  const started = deliveryStartedAt()
  const today = new Date()
  const days = Array.from({ length: DAYS }, (_, i) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i)).toISOString().slice(0, 10))
  const since = `${days.at(-1)} 00:00:00`

  const manual = new Map((db().prepare('SELECT day,ads_clicks,ga4_cpc_sessions,ads_conversions FROM tracking_daily_manual WHERE day>=?').all(days.at(-1)) as Daily[]).map(r => [r.day, r]))
  const paid = paidOrdersByDay(since)
  const sent = db().prepare(`SELECT date(replace(substr(paid_at,1,19),'T',' ')) day, event_name,
      SUM(state='submitted') ok, SUM(state IN ('uncertain','sending')) failed, SUM(state='skipped') skipped,
      SUM(client_source='fallback') fallback, COUNT(*) total
    FROM ga4_events_sent WHERE replace(substr(paid_at,1,19),'T',' ')>=? GROUP BY day,event_name`).all(since) as
    { day: string; event_name: string; ok: number; failed: number; skipped: number; fallback: number; total: number }[]
  const by = (d: string, name: string) => sent.find(r => r.day === d && r.event_name === name)
  const topups = new Map((db().prepare(`SELECT date(i.credited_at) day, COUNT(*) n FROM invoices i JOIN users u ON u.id=i.user_id
    WHERE i.status='success' AND u.account_type!='admin' AND i.credited_at>=? GROUP BY day`).all(since) as { day: string; n: number }[]).map(r => [r.day, r.n]))
  const failReasons = new Map((db().prepare(`SELECT date(replace(substr(paid_at,1,19),'T',' ')) day, GROUP_CONCAT(DISTINCT reason) reasons FROM ga4_events_sent
    WHERE event_name='purchase' AND state!='submitted' AND reason IS NOT NULL AND replace(substr(paid_at,1,19),'T',' ')>=? GROUP BY day`).all(since) as { day: string; reasons: string }[]).map(r => [r.day, r.reasons]))

  const events = db().prepare(`SELECT transaction_id,event_name,kind,state,reason,value_cents,paid_cents,client_source,customer_type,paid_at
    FROM ga4_events_sent ORDER BY paid_at DESC LIMIT 50`).all() as EventRow[]
  const totals = db().prepare(`SELECT SUM(event_name='purchase' AND state='submitted') purchases, SUM(event_name='payment_completed' AND state='submitted') topups,
    SUM(client_source='fallback') fallback, SUM(state='skipped') skipped, SUM(state IN ('uncertain','sending')) failed,
    SUM(CASE WHEN event_name='purchase' AND state='submitted' THEN value_cents ELSE 0 END) value
    FROM ga4_events_sent WHERE replace(substr(paid_at,1,19),'T',' ')>=?`).get(since) as Record<string, number | null>
  const reasons = db().prepare(`SELECT reason, COUNT(*) count FROM ga4_events_sent WHERE reason IS NOT NULL AND created_at>=datetime('now','-90 days') GROUP BY reason ORDER BY count DESC`).all() as { reason: string; count: number }[]
  const consent = db().prepare(`SELECT CASE WHEN internal=1 THEN 'internal_network' ELSE consent END state, COUNT(*) count FROM ga4_checkout_context
    WHERE created_at>=datetime('now','-90 days') GROUP BY state ORDER BY count DESC`).all() as { state: string; count: number }[]
  const diagnostics = db().prepare(`SELECT reason,COUNT(*) count FROM tracking_capture_diagnostics WHERE created_at>=datetime('now','-90 days') GROUP BY reason ORDER BY count DESC`).all() as { reason: string; count: number }[]
  const eventHead = ['Paid at · UTC', 'Event', 'Transaction', 'Value', 'Paid', 'Customer', 'Client ID', 'Delivery', 'Reason']

  return <div className="admin-analytics tracking-health">
    <div className="app-head"><div><span className="eyebrow">Control panel · Measurement</span><h1>Tracking health</h1><p>Verified payments vs. GA4 server delivery · last {DAYS} days · UTC · USD</p></div><Link className="button button--secondary" href="/admin/analytics">Customer analytics</Link></div>

    <section className={`tracking-status ${config.enabled ? 'is-on' : 'is-off'}`} aria-label="Server delivery status">
      <span className={`badge ${config.enabled ? 'badge--success' : 'badge--error'}`}>{config.enabled ? 'Enabled' : 'Disabled'}</span>
      <div>
        <h2>Server delivery {config.enabled ? <>enabled · {config.measurementId}</> : 'is off or not fully configured'}</h2>
        <p>{config.enabled
          ? <>Delivery started: {started ? `${started} UTC` : '—'}. Payments before that are never sent; each verified payment after it is sent once or listed below with a reason.</>
          : <>Missing: {config.missing.join(', ')}. Set them in both service environments, then restart the web service and the poll timer.</>}</p>
      </div>
    </section>

    <div className="stat-grid analytics-stats">
      <Stat label="Purchases sent" value={num(totals.purchases ?? 0)} note={`Margin value ${formatUsd(totals.value ?? 0)}`} />
      <Stat label="Top-ups sent" value={num(totals.topups ?? 0)} note="payment_completed · value 0" />
      <Stat label="Fallback client ID" value={num(totals.fallback ?? 0)} note="missing_client_id · counted, not ad-attributed" />
      <Stat label="Not sent" value={num((totals.skipped ?? 0) + (totals.failed ?? 0))} note={`${totals.skipped ?? 0} skipped · ${totals.failed ?? 0} uncertain`} />
    </div>

    <section className="panel" id="daily"><header><div><h2>Daily reconciliation</h2><p>Target: clicks → GA4 sessions ≥ 70%. Ads columns are entered by hand until the APIs are connected; Ads conversions arrive 1–3 days late.</p></div></header>
      <div className="analytics-table-wrap"><table className="analytics-table tracking-daily"><thead><tr>
        {['Date', 'Ads clicks', 'GA4 google/cpc sessions', 'Click → session', 'Paid orders', 'purchase sent / failed', 'No client ID', 'Top-ups / sent', 'Ads purchases'].map(h => <th scope="col" key={h}>{h}</th>)}
      </tr></thead><tbody>{days.map(d => {
        const m = manual.get(d), p = by(d, 'purchase'), t = by(d, 'payment_completed')
        const why = failReasons.get(d)
        return <tr key={d}>
          <td data-label="Date"><div className="analytics-account">{d}</div></td>
          <td data-label="Ads clicks"><div>{num(m?.ads_clicks)}</div></td>
          <td data-label="GA4 google/cpc sessions"><div>{num(m?.ga4_cpc_sessions)}</div></td>
          <td data-label="Click → session"><div className={m?.ads_clicks && m.ga4_cpc_sessions !== null && m.ga4_cpc_sessions / m.ads_clicks < 0.7 ? 'tracking-low' : undefined}>{pct(m?.ads_clicks ?? null, m?.ga4_cpc_sessions ?? null)}</div></td>
          <td data-label="Paid orders"><div>{num(paid.get(d) ?? 0)}</div></td>
          <td data-label="purchase sent / failed"><div>{p ? `${p.ok} / ${p.failed + p.skipped}` : '0 / 0'}{why ? <span className="analytics-secondary">{why.split(',').map(r => label(r.split(';')[0])).join(' · ')}</span> : null}</div></td>
          <td data-label="No client ID"><div>{num(p?.fallback ?? 0)}</div></td>
          <td data-label="Top-ups / sent"><div>{num(topups.get(d) ?? 0)} / {num(t?.ok ?? 0)}</div></td>
          <td data-label="Ads purchases"><div>{num(m?.ads_conversions)}</div></td>
        </tr>
      })}</tbody></table></div>
      <form className="tracking-manual" action={saveTrackingDailyAction}>
        <label>Date<input type="date" name="day" required defaultValue={days[1]} max={days[0]} /></label>
        <label>Ads clicks<input type="number" name="ads_clicks" min="0" inputMode="numeric" /></label>
        <label>GA4 google/cpc sessions<input type="number" name="ga4_cpc_sessions" min="0" inputMode="numeric" /></label>
        <label>Ads purchases (GA4 import)<input type="number" name="ads_conversions" min="0" inputMode="numeric" /></label>
        <button className="button button--primary" type="submit">Save day</button>
        {saved ? <p className={`tracking-saved ${saved === '1' ? '' : 'is-error'}`} role="status">{saved === '1' ? 'Saved.' : 'Check the date and numbers.'}</p> : null}
      </form>
    </section>

    <section className="panel"><header><div><h2>Latest GA4 events</h2><p>One row per transaction and event. Value = gross margin (purchase) or 0 (top-up). “Fallback” = sent without a browser ID.</p></div></header>
      {events.length ? <div className="analytics-table-wrap"><table className="analytics-table"><thead><tr>{eventHead.map(h => <th scope="col" key={h}>{h}</th>)}</tr></thead><tbody>{events.map(e => <tr key={e.transaction_id + e.event_name}>
        <td data-label={eventHead[0]}><div>{e.paid_at.replace('T', ' ').slice(0, 16)}</div></td>
        <td data-label={eventHead[1]}><div>{e.event_name}</div></td>
        <td data-label={eventHead[2]}><div className="mono">{e.transaction_id}</div></td>
        <td data-label={eventHead[3]}><div>{e.value_cents === null ? '—' : formatUsd(e.value_cents)}</div></td>
        <td data-label={eventHead[4]}><div>{e.paid_cents === null ? '—' : formatUsd(e.paid_cents)}</div></td>
        <td data-label={eventHead[5]}><div>{e.customer_type ? label(e.customer_type) : '—'}</div></td>
        <td data-label={eventHead[6]}><div>{e.client_source === 'ga' ? 'GA' : e.client_source === 'fallback' ? 'Fallback' : '—'}</div></td>
        <td data-label={eventHead[7]}><div><span className={`badge ${tone(e.state)}`}>{label(e.state)}</span></div></td>
        <td data-label={eventHead[8]}><div>{e.reason ? e.reason.split('; ').map(label).join(' · ') : '—'}</div></td>
      </tr>)}</tbody></table></div> : <div className="analytics-empty"><strong>No events yet</strong><p>{config.enabled ? 'The first verified payment after delivery started will appear here.' : 'Enable server delivery to start sending verified payments.'}</p></div>}
    </section>

    <div className="tracking-grid">
      <section className="panel"><header><div><h2>Why events were not plain sends</h2><p>Last 90 days, from the event log.</p></div></header>
        <Counts items={reasons.map(r => ({ key: r.reason, label: r.reason.split('; ').map(label).join(' · '), count: r.count }))} empty="Every event so far was sent with a browser ID and a known margin." /></section>
      <section className="panel"><header><div><h2>Checkout consent</h2><p>Choice seen when the checkout was created. Internal network = INTERNAL_IPS.</p></div></header>
        <Counts items={consent.map(c => ({ key: c.state, label: label(c.state), count: c.count }))} empty="No checkouts recorded since this release." /></section>
      <section className="panel"><header><div><h2>Browser ID capture</h2><p>Whether the checkout page passed GA client and session IDs.</p></div></header>
        <Counts items={diagnostics.map(d => ({ key: d.reason, label: label(d.reason), count: d.count }))} empty="No diagnostics recorded yet." /></section>
    </div>

    <p className="analytics-footnote">“Submitted” means Google accepted the request; confirm processing in GA4 DebugView and attribution in Google Ads. Uncertain sends are never retried automatically. Missing a browser ID does not prove a customer declined cookies.</p>
  </div>
}
