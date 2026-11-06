import { GoogleAuth } from 'google-auth-library'
import { randomUUID } from 'node:crypto'
import { db } from './db'
import { adsIneligibleReason, timestamp, type AdsPurchase } from './ads-conversion-eligibility'

const API = 'https://datamanager.googleapis.com/v1/'
const SCOPE = 'https://www.googleapis.com/auth/datamanager'
type Config = { mode: 'live' | 'validate'; account: string; conversion: string; project: string; startAt: number; destination: string }
export function adsDataManagerConfig(): Config | null {
  const mode = process.env.ADS_DATA_MANAGER_MODE
  const account = process.env.ADS_DATA_MANAGER_ACCOUNT_ID ?? ''
  const conversion = process.env.ADS_DATA_MANAGER_CONVERSION_ID ?? ''
  const project = process.env.ADS_DATA_MANAGER_PROJECT_ID ?? ''
  const startAt = Date.parse(process.env.ADS_DATA_MANAGER_START_AT ?? '')
  if (!['live', 'validate'].includes(mode ?? '') || !/^\d{10}$/.test(account) || !/^\d+$/.test(conversion)
    || !/^[a-z][a-z0-9-]{4,62}$/.test(project) || !Number.isFinite(startAt)
    || process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN !== 'https://iunlockmobile.com') return null
  return { mode: mode as Config['mode'], account, conversion, project, startAt, destination: `${account}/${conversion}` }
}

export function adsRequest(row: AdsPurchase, config: Config) {
  return {
    validateOnly: config.mode !== 'live',
    destinations: [{ operatingAccount: { accountType: 'GOOGLE_ADS', accountId: config.account }, productDestinationId: config.conversion }],
    events: [{ transactionId: row.transaction_id, eventTimestamp: new Date(timestamp(row.conversion_time)).toISOString(),
      eventSource: 'WEB', adIdentifiers: { [row.click_id_type]: row.click_id }, currency: 'USD', conversionValue: row.revenue_cents / 100,
      // Optional tracking consent covers measurement. Do not assert consent for ad personalization.
      consent: { adUserData: 'CONSENT_GRANTED' } }]
  }
}

type Transport = {
  token(): Promise<string>;
  fetch: typeof globalThis.fetch;
}
const auth = new GoogleAuth({ scopes: [SCOPE] })
const defaultTransport: Transport = {
  async token() { const token = await auth.getAccessToken(); if (!token) throw new Error('ADC unavailable'); return token },
  fetch: (...args) => globalThis.fetch(...args)
}
type Delivery = { transaction_id: string; destination: string; state: string; request_id: string | null; attempts: number }
const safeCode = (value: unknown) => typeof value === 'string' && /^[A-Z][A-Z0-9_]{0,150}$/.test(value) ? value : 'UNSPECIFIED'
const safeRequestId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{1,180}$/.test(value)
function headers(token: string, config: Config) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'x-goog-user-project': config.project }
}

/** No real purchase or personal data: verify SDK ADC and destination with validateOnly hard-coded. */
export async function validateAdsDestination() {
  const config = adsDataManagerConfig()
  if (!config) return false
  try {
    const token = await defaultTransport.token()
    const body = adsRequest({ transaction_id: 'iunlockmobile-validation-only', kind: 'guest', context_reference: '',
      state: 'awaiting_configuration', click_id_type: 'gclid', click_id: 'VALIDATION_ONLY_NOT_A_REAL_CLICK',
      conversion_time: new Date(Date.now() - 300000).toISOString(), revenue_cents: 100, currency: 'USD' }, { ...config, mode: 'validate' })
    const response = await defaultTransport.fetch(API + 'events:ingest', {
      method: 'POST', headers: headers(token, config), body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
    })
    if (!response.ok) return false
    const result = await response.json() as { error?: unknown; fieldWarnings?: unknown[] }
    return !result.error && !result.fieldWarnings?.length
  } catch { return false }
}

/** Single-event requests make partial failures attributable. Never log raw Google responses or tokens. */
export async function deliverAdsConversions(limit = 10, transport: Transport = defaultTransport) {
  const stats = { disabled: false, validated: 0, accepted: 0, suppressed: 0, retry: 0, uncertain: 0, rejected: 0, authFailed: false }
  const config = adsDataManagerConfig()
  if (!config) { stats.disabled = true; return stats }
  // A crashed process may already have sent the request. Expiry must NOT authorize another upload.
  db().prepare(`UPDATE ads_conversion_delivery SET state='uncertain',reason='worker_interrupted',lease_token=NULL
    WHERE state='sending' AND lease_until<?`).run(Date.now())
  let token: string
  try { token = await transport.token() } catch { stats.authFailed = true; return stats }
  const candidates = db().prepare(`SELECT o.* FROM ads_conversion_outbox o LEFT JOIN ads_conversion_delivery d USING(transaction_id)
    WHERE o.state='awaiting_configuration' AND (d.transaction_id IS NULL OR
      (d.destination=? AND ((d.state='retry' AND d.next_at<=?) OR (d.state='validated' AND ?='live'))))
    ORDER BY o.created_at,o.transaction_id LIMIT ?`).all(config.destination, Date.now(), config.mode, Math.max(0, Math.min(50, Math.floor(limit) || 0))) as AdsPurchase[]
  for (const candidate of candidates) {
    const lease = randomUUID()
    const claim = db().transaction(() => {
      db().prepare(`INSERT OR IGNORE INTO ads_conversion_delivery(transaction_id,destination,state) VALUES(?,?,'retry')`).run(candidate.transaction_id, config.destination)
      const changed = db().prepare(`UPDATE ads_conversion_delivery SET state='sending',lease_token=?,lease_until=?,attempts=attempts+1,updated_at=datetime('now')
        WHERE transaction_id=? AND destination=? AND ((state='retry' AND next_at<=?) OR (state='validated' AND ?='live'))`)
        .run(lease, Date.now() + 120000, candidate.transaction_id, config.destination, Date.now(), config.mode).changes
      if (!changed) return null
      const row = db().prepare('SELECT * FROM ads_conversion_outbox WHERE transaction_id=?').get(candidate.transaction_id) as AdsPurchase
      const reason = adsIneligibleReason(row, config.startAt)
      if (reason) {
        db().prepare(`UPDATE ads_conversion_delivery SET state='suppressed',reason=?,lease_token=NULL,lease_until=0 WHERE transaction_id=? AND lease_token=?`).run(reason, row.transaction_id, lease)
        return { suppressed: true as const, row }
      }
      return { suppressed: false as const, row }
    }).immediate()
    if (!claim) continue
    if (claim.suppressed) { stats.suppressed++; continue }
    const row = claim.row
    let state: 'validated' | 'accepted' | 'retry' | 'uncertain' | 'rejected' = 'uncertain'
    let reason: string | null = 'transport_or_response_unknown', requestId: string | null = null
    try {
      const response = await transport.fetch(API + 'events:ingest', {
        method: 'POST', headers: headers(token, config), body: JSON.stringify(adsRequest(row, config)), signal: AbortSignal.timeout(30000)
      })
      const body = await response.json() as { requestId?: unknown; fieldWarnings?: unknown[]; error?: { status?: unknown } }
      if (response.ok) {
        if (config.mode === 'validate') { state = 'validated'; reason = body.fieldWarnings?.length ? 'field_warnings' : null }
        else if (safeRequestId(body.requestId) && !body.requestId.startsWith('v-')) {
          state = 'accepted'; requestId = body.requestId; reason = body.fieldWarnings?.length ? 'field_warnings' : null
        }
      } else {
        reason = `http_${response.status}_${safeCode(body.error?.status)}`
        // Explicit auth/rate-limit rejections are retryable; 5xx/timeouts may have ingested data.
        state = [401, 403, 429].includes(response.status) ? 'retry' : response.status >= 500 || response.status === 408 ? 'uncertain' : 'rejected'
      }
    } catch { /* Never expose payloads, customer identifiers, credentials, or SDK error bodies. */ }
    const delivery = db().prepare('SELECT attempts FROM ads_conversion_delivery WHERE transaction_id=?').get(row.transaction_id) as { attempts: number }
    if (state === 'retry' && delivery.attempts >= 5) { state = 'rejected'; reason = 'retry_limit_' + reason }
    db().prepare(`UPDATE ads_conversion_delivery SET state=?,reason=?,request_id=?,next_at=?,lease_token=NULL,lease_until=0,updated_at=datetime('now')
      WHERE transaction_id=? AND lease_token=? AND state='sending'`).run(state, reason, requestId,
      Date.now() + Math.min(3600000, 60000 * 2 ** delivery.attempts), row.transaction_id, lease)
    stats[state]++
  }
  return stats
}

/** Accepted only means queued at Google. Persist later processing results separately from attribution. */
export async function reconcileAdsConversions(limit = 20, transport: Transport = defaultTransport) {
  const config = adsDataManagerConfig()
  const stats = { disabled: !config, delivered: 0, rejected: 0, pending: 0, needsReview: 0, errors: 0 }
  if (!config) return stats
  const rows = db().prepare(`SELECT * FROM ads_conversion_delivery WHERE destination=? AND state IN ('accepted','delivered','uncertain')
    AND checked_at<? ORDER BY checked_at,created_at LIMIT ?`).all(config.destination, Date.now() - 60000, Math.max(0, Math.min(100, limit))) as Delivery[]
  if (!rows.length) return stats
  let token: string
  try { token = await transport.token() } catch { stats.errors++; return stats }
  for (const delivery of rows) {
    const row = db().prepare('SELECT * FROM ads_conversion_outbox WHERE transaction_id=?').get(delivery.transaction_id) as AdsPurchase
    // After submission, refunds/withdrawals require review/adjustment; do not silently erase a sent conversion.
    const eligibility = adsIneligibleReason(row, 0)
    const review = eligibility && eligibility !== 'outside_delivery_window' ? eligibility : null
    db().prepare('UPDATE ads_conversion_delivery SET needs_review=?,checked_at=? WHERE transaction_id=?').run(review, Date.now(), delivery.transaction_id)
    if (review) stats.needsReview++
    if (delivery.state !== 'accepted' || !delivery.request_id) continue
    try {
      const response = await transport.fetch(API + 'requestStatus:retrieve?requestId=' + encodeURIComponent(delivery.request_id), {
        headers: headers(token, config), signal: AbortSignal.timeout(30000)
      })
      if (!response.ok) { stats.errors++; continue }
      const body = await response.json() as { requestStatusPerDestination?: { requestStatus: string;
        destination?: { operatingAccount?: { accountId?: string }; productDestinationId?: string };
        errorInfo?: { errorCounts?: { reason?: unknown }[] }; warningInfo?: { warningCounts?: { reason?: unknown }[] } }[] }
      const result = body.requestStatusPerDestination?.find(item => item.destination?.operatingAccount?.accountId === config.account && item.destination?.productDestinationId === config.conversion)
      if (!result || !['SUCCESS', 'FAILED', 'PARTIAL_SUCCESS'].includes(result.requestStatus)) { stats.pending++; continue }
      const state = result.requestStatus === 'SUCCESS' ? 'delivered' : 'rejected'
      const reasons = [...(result.errorInfo?.errorCounts ?? []), ...(result.warningInfo?.warningCounts ?? [])].map(item => safeCode(item.reason)).join(';').slice(0, 1000) || null
      db().prepare(`UPDATE ads_conversion_delivery SET state=?,reason=?,updated_at=datetime('now') WHERE transaction_id=? AND state='accepted' AND request_id=?`)
        .run(state, reasons, delivery.transaction_id, delivery.request_id)
      stats[state]++
    } catch { stats.errors++ }
  }
  return stats
}

/** Aggregate-only diagnostics suitable for copying into support chats. */
export function adsDeliveryStatus() {
  return {
    mode: adsDataManagerConfig()?.mode ?? 'disabled',
    staging: db().prepare('SELECT state,count(*) AS count FROM ads_conversion_outbox GROUP BY state').all(),
    delivery: db().prepare('SELECT state,reason,count(*) AS count FROM ads_conversion_delivery GROUP BY state,reason').all(),
    needsReview: db().prepare('SELECT needs_review AS reason,count(*) AS count FROM ads_conversion_delivery WHERE needs_review IS NOT NULL GROUP BY needs_review').all(),
    checkoutCoverage: db().prepare(`SELECT x.kind,
      CASE WHEN c.reference IS NULL THEN 'missing_context' WHEN c.consent!='granted' THEN c.consent
        WHEN c.gclid IS NOT NULL THEN 'gclid' WHEN c.wbraid IS NOT NULL OR c.gbraid IS NOT NULL THEN 'braid'
        ELSE 'consented_without_ad_click' END AS attribution,count(*) AS count
      FROM (
        SELECT 'order' AS kind,idempotency_key AS reference,created_at FROM orders WHERE source='website'
        UNION ALL SELECT 'paid_imei_report',idempotency_key,created_at FROM paid_report_orders WHERE source='website'
        UNION ALL SELECT 'guest',reference,created_at FROM guest_checkouts
        UNION ALL SELECT 'topup',i.reference,i.created_at FROM invoices i JOIN users u ON u.id=i.user_id WHERE u.account_type IN ('customer','reseller')
      ) x LEFT JOIN ga4_checkout_context c ON c.kind=x.kind AND c.reference=x.reference
      WHERE x.created_at>=datetime('now','-7 days') GROUP BY x.kind,attribution`).all()
  }
}
