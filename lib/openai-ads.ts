import { db } from './db'
import { validateOppref } from './attribution'
import { timestamp, verifiedPurchaseIneligibleReason, type VerifiedPurchase } from './ads-conversion-eligibility'

type Row = VerifiedPurchase & { pixel_id: string; reason: string | null; needs_review: string | null }
export function openAiAdsConfig() {
  const mode = process.env.OPENAI_ADS_MODE
  const pixelId = process.env.OPENAI_ADS_PIXEL_ID?.trim() ?? ''
  const key = process.env.OPENAI_ADS_CAPI_KEY?.trim() ?? ''
  const startAt = Date.parse(process.env.OPENAI_ADS_START_AT ?? '')
  if (!['validate', 'live'].includes(mode ?? '') || !/^[A-Za-z0-9_-]{8,128}$/.test(pixelId) || !key
      || !Number.isFinite(startAt) || process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN !== 'https://iunlockmobile.com') return null
  return { mode: mode as 'validate' | 'live', pixelId, key, startAt }
}
function ineligible(row: Row, config: NonNullable<ReturnType<typeof openAiAdsConfig>>) {
  if (row.pixel_id !== config.pixelId) return 'destination_changed'
  const reason = verifiedPurchaseIneligibleReason({ ...row, state: 'awaiting_configuration' }, config.startAt)
  if (reason) return reason
  if (Date.now() - timestamp(row.conversion_time) >= 7 * 86400000) return 'outside_openai_window'
  const context = db().prepare('SELECT oppref FROM ga4_checkout_context WHERE kind=? AND reference=?')
    .get(row.kind, row.context_reference) as { oppref: string | null } | undefined
  if (!validateOppref(context?.oppref)) return 'missing_openai_click'
  return null
}
function stage(config: NonNullable<ReturnType<typeof openAiAdsConfig>>) {
  const candidates = db().prepare(`SELECT * FROM (
    SELECT 'unlock-'||o.id AS transaction_id,'order' AS kind,o.idempotency_key AS reference,l.created_at AS paid_at,o.price_cents AS revenue
    FROM orders o JOIN credit_ledger l ON l.user_id=o.user_id AND l.ref_type='order' AND l.ref_id=CAST(o.id AS TEXT)
      AND l.type='charge' AND l.amount_cents=-o.price_cents
    WHERE o.status='delivered' AND o.source='website' AND o.price_cents>0
    UNION ALL
    SELECT 'report-'||o.id,'paid_imei_report',o.idempotency_key,l.created_at,o.price_cents
    FROM paid_report_orders o JOIN credit_ledger l ON l.user_id=o.user_id AND l.ref_type='paid_imei_report' AND l.ref_id=CAST(o.id AS TEXT)
      AND l.type='charge' AND l.amount_cents=-o.price_cents
    WHERE o.status='completed' AND o.source='website'
    UNION ALL
    SELECT 'guest-'||g.reference,'guest',g.reference,g.paid_at,
      CASE WHEN g.card_order_price_cents IS NULL THEN g.price_cents ELSE g.card_order_price_cents+g.fee_cents-g.tax_cents END
    FROM guest_checkouts g JOIN paid_report_orders p ON p.id=g.report_id AND p.user_id=g.user_id
    WHERE g.environment='live' AND g.state IN ('paid','processing','completed') AND g.payment_id IS NOT NULL
      AND g.paid_at IS NOT NULL AND p.status='completed'
  ) candidates
  WHERE julianday(paid_at)>=julianday(?) AND julianday(paid_at)>=julianday('now','-7 days')
    AND NOT EXISTS(SELECT 1 FROM openai_conversion_delivery a WHERE a.transaction_id=candidates.transaction_id)
    AND EXISTS(SELECT 1 FROM ga4_checkout_context c WHERE c.kind=candidates.kind AND c.reference=candidates.reference
      AND c.consent='granted' AND c.internal=0 AND c.oppref IS NOT NULL AND c.oppref!='')
  ORDER BY paid_at,transaction_id LIMIT ?`).all(new Date(config.startAt).toISOString(), 100) as {
    transaction_id: string; kind: string; reference: string; paid_at: string; revenue: number
  }[]
  const insert = db().prepare(`INSERT OR IGNORE INTO openai_conversion_delivery
    (transaction_id,kind,context_reference,conversion_time,revenue_cents,currency,pixel_id,state)
    VALUES(?,?,?,?,?,'USD',?,'pending')`)
  for (const row of candidates) insert.run(row.transaction_id, row.kind, row.reference, row.paid_at, row.revenue, config.pixelId)
}
export function openAiAdsStatus() {
  return { mode: openAiAdsConfig()?.mode ?? 'disabled',
    delivery: db().prepare('SELECT state,reason,COUNT(*) count FROM openai_conversion_delivery GROUP BY state,reason').all(),
    needsReview: db().prepare('SELECT needs_review,COUNT(*) count FROM openai_conversion_delivery WHERE needs_review IS NOT NULL GROUP BY needs_review').all(),
    coverage: db().prepare(`SELECT kind,consent,CASE WHEN oppref IS NOT NULL THEN 'openai_click' ELSE 'without_openai_click' END attribution,
      COUNT(*) count FROM ga4_checkout_context WHERE created_at>=datetime('now','-7 days') GROUP BY kind,consent,attribution`).all() }
}
/** Separate destination ledger; never emits a second GA4 purchase or Google OCI. */
export async function deliverOpenAiAds(fetcher: typeof fetch = fetch) {
  const config = openAiAdsConfig()
  const result = { disabled: !config, validated: 0, submitted: 0, suppressed: 0, uncertain: 0, rejected: 0 }
  if (!config) return result
  stage(config)
  db().prepare("UPDATE openai_conversion_delivery SET state='uncertain',reason='worker_interrupted' WHERE state='sending' AND updated_at<datetime('now','-5 minutes')").run()
  // Refunds/withdrawals after delivery need review; do not claim that a remote event was retracted.
  const sent = db().prepare("SELECT * FROM openai_conversion_delivery WHERE state='submitted' AND needs_review IS NULL AND conversion_time>=datetime('now','-30 days')").all() as Row[]
  for (const row of sent) {
    const reason = verifiedPurchaseIneligibleReason({ ...row, state: 'awaiting_configuration' }, config.startAt)
    if (reason) db().prepare('UPDATE openai_conversion_delivery SET needs_review=? WHERE transaction_id=?').run(reason, row.transaction_id)
  }
  for (let n = 0; n < 100; n++) {
    const row = db().transaction(() => {
      const candidate = db().prepare(`SELECT * FROM openai_conversion_delivery WHERE state='pending'
        OR (state='validated' AND ?='live') ORDER BY conversion_time,transaction_id LIMIT 1`).get(config.mode) as Row | undefined
      if (!candidate) return null
      db().prepare("UPDATE openai_conversion_delivery SET state='sending',updated_at=datetime('now') WHERE transaction_id=?").run(candidate.transaction_id)
      return candidate
    }).immediate()
    if (!row) break
    const reason = ineligible(row, config)
    if (reason) {
      db().prepare("UPDATE openai_conversion_delivery SET state='suppressed',reason=?,updated_at=datetime('now') WHERE transaction_id=?").run(reason, row.transaction_id)
      result.suppressed++; continue
    }
    const context = db().prepare('SELECT oppref FROM ga4_checkout_context WHERE kind=? AND reference=?').get(row.kind, row.context_reference) as { oppref: string }
    const body = { validate_only: config.mode === 'validate', integration_source: 'iunlockmobile', events: [{
      id: row.transaction_id, type: 'order_created', timestamp_ms: timestamp(row.conversion_time),
      oppref: context.oppref, source_url: 'https://iunlockmobile.com/', action_source: 'web', opt_out: true,
      data: { type: 'contents', amount: row.revenue_cents, currency: row.currency }
    }] }
    let state: 'validated' | 'submitted' | 'uncertain' | 'rejected' = 'uncertain'
    let failure: string | null = 'transport_uncertain'
    try {
      const response = await fetcher(`https://bzr.openai.com/v1/events?pid=${encodeURIComponent(config.pixelId)}`, {
        method: 'POST', headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body), signal: AbortSignal.timeout(10000), redirect: 'error'
      })
      if (response.ok) { state = config.mode === 'validate' ? 'validated' : 'submitted'; failure = null }
      else if (response.status >= 400 && response.status < 500) { state = 'rejected'; failure = `http_${response.status}` }
    } catch { /* Never log keys, click references, customer data, or response bodies. */ }
    db().prepare("UPDATE openai_conversion_delivery SET state=?,reason=?,updated_at=datetime('now') WHERE transaction_id=?").run(state, failure, row.transaction_id)
    result[state]++
  }
  return result
}

/** Synthetic schema/authentication probe. The API must never store this event. */
export async function validateOpenAiAds(fetcher: typeof fetch = fetch): Promise<boolean> {
  const config = openAiAdsConfig(); if (!config) return false
  try {
    const response = await fetcher(`https://bzr.openai.com/v1/events?pid=${encodeURIComponent(config.pixelId)}`, {
      method: 'POST', headers: { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json' },
      redirect: 'error', signal: AbortSignal.timeout(10000), body: JSON.stringify({ validate_only: true,
        integration_source: 'iunlockmobile', events: [{ id: 'iunlockmobile-validation-only', type: 'order_created',
          timestamp_ms: Date.now(), action_source: 'web', source_url: 'https://iunlockmobile.com/', opt_out: true,
          data: { type: 'contents', amount: 100, currency: 'USD' } }] })
    })
    return response.ok
  } catch { return false }
}
