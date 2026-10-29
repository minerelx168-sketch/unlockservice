import { randomInt } from 'node:crypto'
import { db } from './db'
import { logPaymentFailure } from './payment-diagnostics'

/**
 * Phase 0 server-side conversions (GA4 Measurement Protocol).
 *
 * Rules (docs/verified-payment-analytics.md):
 * - Sent only by the payment worker after money is verified; never from a page view.
 * - One send per (transaction_id, event_name), claimed in ga4_events_sent first.
 * - Admins, team email domains and checkouts from INTERNAL_IPS are skipped.
 * - A customer who refused optional tracking is skipped. Without a GA client ID
 *   the event is still sent with a random fallback ID so GA4 counts the sale,
 *   and the reason is recorded as missing_client_id.
 */
export const DEFAULT_MEASUREMENT_ID = 'G-9WCELVR3V3'

export function ga4Config() {
  const measurementId = process.env.GA4_MEASUREMENT_ID?.trim() || DEFAULT_MEASUREMENT_ID
  const secret = process.env.GA4_MP_API_SECRET?.trim() || process.env.GA4_MEASUREMENT_API_SECRET?.trim() || ''
  const flag = process.env.GA4_SERVER_PAYMENTS_ENABLED === '1'
  const origin = process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN === 'https://iunlockmobile.com'
  const validId = /^G-[A-Z0-9]{4,16}$/.test(measurementId)
  const missing = [!flag && 'GA4_SERVER_PAYMENTS_ENABLED', !secret && 'GA4_MP_API_SECRET', !origin && 'IUNLOCKMOBILE_PUBLIC_ORIGIN', !validId && 'GA4_MEASUREMENT_ID'].filter(Boolean) as string[]
  return { enabled: missing.length === 0, measurementId, secret, missing }
}

/** First start of the Phase 0 release (set in db()). Nothing paid before it is ever sent: no backfill. */
export function deliveryStartedAt(): string | null {
  const row = db().prepare("SELECT value FROM ga4_meta WHERE key='delivery_started_at'").get() as { value: string } | undefined
  return row?.value ?? null
}
export function markDeliveryStarted(): string {
  db().prepare("INSERT OR IGNORE INTO ga4_meta(key,value) VALUES('delivery_started_at',datetime('now'))").run()
  return deliveryStartedAt()!
}

function listEnv(name: string): string[] {
  return (process.env[name] ?? '').split(/[\s,]+/).map((value) => value.trim().toLowerCase()).filter(Boolean)
}
export function isInternalIp(ip: string | null | undefined): boolean {
  if (!ip) return false
  const candidate = ip.split(',')[0].trim().toLowerCase().replace(/^::ffff:/, '')
  return listEnv('INTERNAL_IPS').some((entry) => entry === candidate)
}
/** The visitor address as seen by Caddy (single proxy in front of Node). */
export function clientIp(headers: { get(name: string): string | null }): string | null {
  return headers.get('x-real-ip')?.trim() || headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
}
export function isInternalEmail(email: string | null | undefined): boolean {
  const domain = email?.toLowerCase().split('@')[1]
  return !!domain && listEnv('INTERNAL_EMAIL_DOMAINS').some((entry) => domain === entry.replace(/^@/, ''))
}

export type ConsentChoice = 'granted' | 'denied' | 'unknown'
type ContextInput = { landingPage?: unknown; utmSource?: unknown; utmMedium?: unknown; utmCampaign?: unknown }
const SAFE_TEXT = /^[A-Za-z0-9._~+-]{1,80}$/
const SAFE_PATH = /^\/[A-Za-z0-9/_.-]{0,159}$/
const clean = (value: unknown, pattern: RegExp) => (typeof value === 'string' && pattern.test(value) ? value : null)

/** Store what this checkout request knew. Never IPs, emails or IMEIs: only a boolean for the internal list. */
export function recordCheckoutContext(kind: 'topup' | 'order' | 'paid_imei_report' | 'guest', reference: string, userId: number | null,
  consent: ConsentChoice, ip: string | null, clickIds: { gclid?: string; gbraid?: string; wbraid?: string } = {}, input: unknown = {}) {
  if (!reference || reference.length > 128) return
  const context = (input && typeof input === 'object' ? input : {}) as ContextInput
  const granted = consent !== 'denied'
  db().prepare(`INSERT OR IGNORE INTO ga4_checkout_context(kind,reference,user_id,consent,internal,gclid,gbraid,wbraid,landing_page,utm_source,utm_medium,utm_campaign)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`).run(kind, reference, userId, consent, isInternalIp(ip) ? 1 : 0,
    granted ? clickIds.gclid ?? null : null, granted ? clickIds.gbraid ?? null : null, granted ? clickIds.wbraid ?? null : null,
    granted ? clean(context.landingPage, SAFE_PATH) : null, granted ? clean(context.utmSource, SAFE_TEXT) : null,
    granted ? clean(context.utmMedium, SAFE_TEXT) : null, granted ? clean(context.utmCampaign, SAFE_TEXT) : null)
}
/** Withdrawal of consent on a signed-in account also covers checkouts not yet sent. */
export function revokeCheckoutContext(userId: number) {
  db().prepare("UPDATE ga4_checkout_context SET consent='denied',gclid=NULL,gbraid=NULL,wbraid=NULL,landing_page=NULL,utm_source=NULL,utm_medium=NULL,utm_campaign=NULL WHERE user_id=?").run(userId)
}
export function checkoutContext(kind: string, reference: string) {
  return db().prepare('SELECT consent,internal FROM ga4_checkout_context WHERE kind=? AND reference=?').get(kind, reference) as
    { consent: ConsentChoice; internal: number } | undefined
}

/** GA-format random client ID for sales whose browser ID was not captured. */
export function fallbackClientId(): string {
  return `${randomInt(1_000_000_000, 2_147_483_647)}.${Math.floor(Date.now() / 1000)}`
}
export const validClientId = (value: unknown): value is string => typeof value === 'string' && /^\d{1,20}\.\d{1,20}$/.test(value)
export const validSessionId = (value: unknown): value is string => typeof value === 'string' && /^\d{1,12}$/.test(value) && Number(value) > 0

type EventRecord = { transactionId: string; eventName: 'purchase' | 'payment_completed'; kind: string; paidAt: string }
/** Atomic claim. False means this transaction/event was already handled. */
export function claimEvent(event: EventRecord): boolean {
  return db().prepare(`INSERT OR IGNORE INTO ga4_events_sent(transaction_id,event_name,kind,state,paid_at) VALUES(?,?,?,'sending',?)`)
    .run(event.transactionId, event.eventName, event.kind, event.paidAt).changes === 1
}
export function skipEvent(event: EventRecord, reason: string) {
  db().prepare(`INSERT OR IGNORE INTO ga4_events_sent(transaction_id,event_name,kind,state,reason,paid_at) VALUES(?,?,?,'skipped',?,?)`)
    .run(event.transactionId, event.eventName, event.kind, reason, event.paidAt)
}
export function alreadyHandled(transactionId: string, eventName: string): boolean {
  return !!db().prepare('SELECT 1 FROM ga4_events_sent WHERE transaction_id=? AND event_name=?').get(transactionId, eventName)
}

export function toMicros(sqliteTime: string): number {
  const iso = sqliteTime.includes('T') ? sqliteTime : `${sqliteTime.replace(' ', 'T')}Z`
  return Date.parse(iso) * 1000
}

type SendDetails = { valueCents: number; paidCents: number; clientSource: 'ga' | 'fallback'; customerType: 'new' | 'returning'; marginKnown: boolean | null; reason: string | null }
/**
 * Sends a claimed event. 2xx = 'submitted' (transport accepted, not proof of
 * attribution). Anything else is 'uncertain' and never retried automatically:
 * Measurement Protocol has no exactly-once guarantee.
 */
export async function sendClaimedEvent(event: EventRecord, body: Record<string, unknown>, details: SendDetails): Promise<'submitted' | 'uncertain'> {
  const config = ga4Config()
  let state: 'submitted' | 'uncertain' = 'uncertain'
  try {
    const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(config.measurementId)}&api_secret=${encodeURIComponent(config.secret)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000),
    })
    if (response.ok) state = 'submitted'
    else logPaymentFailure('ga4.delivery', { name: 'Error', status: response.status })
  } catch (error) { logPaymentFailure('ga4.delivery', error) }
  db().prepare(`UPDATE ga4_events_sent SET state=?,reason=?,value_cents=?,paid_cents=?,client_source=?,customer_type=?,margin_known=?,sent_at=datetime('now')
    WHERE transaction_id=? AND event_name=?`).run(state, state === 'uncertain' ? details.reason ? `${details.reason}; delivery_uncertain` : 'delivery_uncertain' : details.reason,
    details.valueCents, details.paidCents, details.clientSource, details.customerType, details.marginKnown === null ? null : details.marginKnown ? 1 : 0,
    event.transactionId, event.eventName)
  return state
}

/**
 * True when a credit-paid service was funded by credit that did not come from a
 * real payment (admin adjustments, test credit): the money never came in.
 */
export function fundedByTestCredit(userId: number, chargeLedgerId: number, amountCents: number): boolean {
  const funded = db().prepare(`SELECT COALESCE(SUM(l.amount_cents),0) total FROM credit_ledger l
    LEFT JOIN invoices i ON l.ref_type='invoice' AND i.reference=l.ref_id
    LEFT JOIN whop_topups w ON w.invoice_reference=i.reference
    WHERE l.user_id=? AND l.id<? AND (
      (l.type='topup' AND l.ref_type='invoice' AND i.status='success' AND (i.gateway!='whop_card' OR w.environment='live'))
      OR (l.type='topup' AND l.ref_type='guest_card_difference')
      OR (l.type='adjustment' AND l.ref_type IN ('whop_refund','guest_card_difference_refund')))`).get(userId, chargeLedgerId) as { total: number }
  const spent = db().prepare("SELECT COALESCE(SUM(-amount_cents),0) total FROM credit_ledger WHERE user_id=? AND id<? AND type='charge'")
    .get(userId, chargeLedgerId) as { total: number }
  return funded.total - spent.total < amountCents
}

/**
 * Spec: every payment that is NOT sent is recorded with its reason. The send
 * queries only pick eligible rows, so failed, refunded, disputed, sandbox and
 * zero-amount payments since delivery started are written here as skipped.
 */
export function recordUnsentPayments(started: string) {
  const skip = db().prepare(`INSERT OR IGNORE INTO ga4_events_sent(transaction_id,event_name,kind,state,reason,paid_at) VALUES(?,?,?,'skipped',?,?)`)
  const topups = db().prepare(`SELECT i.reference,i.status,i.credit_amount_cents,COALESCE(i.credited_at,i.paid_at,i.updated_at) at,w.environment,w.reversed_cents,w.review_reason
    FROM invoices i JOIN users u ON u.id=i.user_id LEFT JOIN whop_topups w ON w.invoice_reference=i.reference
    WHERE u.account_type!='guest' AND julianday(COALESCE(i.credited_at,i.paid_at,i.updated_at))>=julianday(?)
      AND (i.status IN ('failed','refunded') OR (i.status='success' AND (i.credit_amount_cents<=0 OR (w.invoice_reference IS NOT NULL AND (w.environment!='live' OR w.reversed_cents>0 OR w.review_reason IS NOT NULL))))
        OR (i.status='review' AND w.review_reason LIKE '%dispute%'))
      AND NOT EXISTS(SELECT 1 FROM guest_checkouts g WHERE g.crypto_invoice_reference=i.reference)`).all(started) as
    { reference: string; status: string; credit_amount_cents: number; at: string; environment: string | null; reversed_cents: number | null; review_reason: string | null }[]
  for (const t of topups) {
    const reason = t.status === 'failed' ? 'payment_failed' : t.review_reason && /dispute|resolution/.test(t.review_reason) ? 'chargeback'
      : t.status === 'refunded' || (t.reversed_cents ?? 0) > 0 ? 'refunded' : t.environment && t.environment !== 'live' ? 'test_environment'
      : t.credit_amount_cents <= 0 ? 'zero_amount' : 'payment_review'
    if (reason !== 'payment_review') skip.run(`topup-${t.reference}`, 'payment_completed', 'topup', reason, t.at)
  }
  const guests = db().prepare(`SELECT reference,state,review_reason,environment,payment_method,paid_at FROM guest_checkouts
    WHERE paid_at IS NOT NULL AND state!='pending' AND julianday(paid_at)>=julianday(?)
      AND (state IN ('refunded','refund_pending') OR review_reason IS NOT NULL OR (payment_method='card' AND environment!='live'))`).all(started) as
    { reference: string; state: string; review_reason: string | null; environment: string; payment_method: string; paid_at: string }[]
  for (const g of guests) {
    const reason = g.review_reason && /dispute|resolution/.test(g.review_reason) ? 'chargeback'
      : ['refunded', 'refund_pending'].includes(g.state) || g.review_reason === 'partial_refund' ? 'refunded'
      : g.payment_method === 'card' && g.environment !== 'live' ? 'test_environment' : 'payment_review'
    // A review that later clears is still sent: only final outcomes are recorded here.
    if (reason !== 'payment_review') skip.run(`guest-${g.reference}`, 'purchase', 'guest', reason, g.paid_at)
  }
}

/** Claims older than five minutes that never finished: the process died mid-send. */
export function releaseStaleClaims() {
  db().prepare("UPDATE ga4_events_sent SET state='uncertain',reason=COALESCE(reason,'worker_interrupted') WHERE state='sending' AND created_at<datetime('now','-5 minutes')").run()
}

export type Identity = { clientId: string; sessionId: number | null; source: 'ga' | 'fallback' }
export function identity(clientId: unknown, sessionId: unknown): Identity {
  if (validClientId(clientId)) return { clientId, sessionId: validSessionId(sessionId) ? Number(sessionId) : null, source: 'ga' }
  return { clientId: fallbackClientId(), sessionId: null, source: 'fallback' }
}
