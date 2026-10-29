import { upgradeResellerAfterTopup } from './reseller-pricing'
import { logPaymentFailure } from './payment-diagnostics'
import { randomBytes } from 'node:crypto'
import { WhopClient, WhopEnvironment, type Whop } from '@whop/sdk'
import { unwrapWebhook } from '@whop/sdk/helpers'
import { db } from './db'
import { credit, getBalance } from './credits'
import { formatUsd, parseUsd } from './money'
import { publicOrigin } from './site'
import { consumeAttempt } from './rate-limit'
import { MIN_TOPUP_CENTS, MAX_TOPUP_CENTS } from './topup-limits'
import { cardFeeCents } from './card-fee'

export const WHOP_API_VERSION = '2026-10-15-1'
export const WHOP_MIN_CENTS = MIN_TOPUP_CENTS
export const WHOP_MAX_CENTS = MAX_TOPUP_CENTS
export const WHOP_EVENTS = ['payment.succeeded', 'payment.failed', 'payment.canceled',
  'refund.created', 'refund.updated', 'dispute.created', 'dispute.updated', 'dispute_alert.created',
  'resolution_center_case.created', 'resolution_center_case.updated', 'resolution_center_case.decided'] as const

export class WhopPaymentError extends Error {
  constructor(message: string, readonly status = 400) { super(message) }
}

type Configuration = { apiKey: string; secret: string; accountId: string; productId: string; mode: 'live' | 'sandbox' }
export function whopConfiguration(): Configuration | null {
  const apiKey = process.env.WHOP_API_KEY?.trim()
  const secret = process.env.WHOP_WEBHOOK_SECRET?.trim()
  const accountId = process.env.WHOP_ACCOUNT_ID?.trim()
  const productId = process.env.WHOP_PRODUCT_ID?.trim()
  const mode = process.env.WHOP_MODE
  if (!apiKey || !secret || !/^biz_[A-Za-z0-9]+$/.test(accountId ?? '')
    || !/^prod_[A-Za-z0-9]+$/.test(productId ?? '') || (mode !== 'live' && mode !== 'sandbox')) return null
  return { apiKey, secret, accountId: accountId!, productId: productId!, mode }
}
export function whopCheckoutEnabled(): boolean {
  const config = whopConfiguration()
  return process.env.IUNLOCKMOBILE_WHOP_ENABLED === '1' && config !== null
    && !(process.env.NODE_ENV === 'production' && config.mode === 'sandbox')
}
export function client(config: Configuration): WhopClient {
  return new WhopClient({ token: config.apiKey, apiVersionDate: WHOP_API_VERSION,
    environment: config.mode === 'live' ? WhopEnvironment.Production : WhopEnvironment.Sandbox,
    timeoutInSeconds: 10, maxRetries: 0 })
}

export type WhopTopup = {
  invoice_reference: string; user_id: number; request_key: string; account_id: string; product_id: string
  environment: 'live' | 'sandbox'; checkout_id: string | null; plan_id: string | null
  checkout_url: string | null; payment_id: string | null; credited: number; reversed_cents: number
  reversal_due_cents: number; review_reason: string | null; processor_updated_at: string | null
  credit_amount_cents: number; fee_cents: number; tax_cents: number; total_due_cents: number; status: string
}
const TOPUP_SELECT = 'SELECT w.*, i.credit_amount_cents, i.fee_cents, i.tax_cents, i.total_due_cents, i.status FROM whop_topups w JOIN invoices i ON i.reference = w.invoice_reference'
export function getWhopTopup(reference: string, userId: number): WhopTopup | undefined {
  return db().prepare(`${TOPUP_SELECT} WHERE w.invoice_reference = ? AND w.user_id = ?`).get(reference, userId) as WhopTopup | undefined
}
export function safeWhopCheckoutUrl(value: string, mode: 'live' | 'sandbox'): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' || url.hostname !== (mode === 'live' ? 'whop.com' : 'sandbox.whop.com')
    || url.username || url.password || url.port) throw new WhopPaymentError('Invalid checkout response.', 502)
  return url.href
}

/** One locally owned invoice and one provider idempotency key across retries. */
export async function createWhopCheckout(userId: number, amountCents: number, requestKey: string): Promise<WhopTopup> {
  const config = whopConfiguration()
  if (!config || !whopCheckoutEnabled()) throw new WhopPaymentError('Card payments are not available yet.', 503)
  if (!Number.isSafeInteger(amountCents) || amountCents < WHOP_MIN_CENTS || amountCents > WHOP_MAX_CENTS) {
    throw new WhopPaymentError(`Enter an amount from ${formatUsd(WHOP_MIN_CENTS)} to ${formatUsd(WHOP_MAX_CENTS)}.`)
  }
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(requestKey)) throw new WhopPaymentError('Invalid request key.')
  const topup = db().transaction(() => {
    const user = db().prepare('SELECT status, banned_at, email_verified_at FROM users WHERE id = ?').get(userId) as
      { status: string; banned_at: string | null; email_verified_at: string | null } | undefined
    if (!user || user.status !== 'active' || user.banned_at || !user.email_verified_at) throw new WhopPaymentError('An active, verified account is required.', 403)
    if (db().prepare('SELECT 1 FROM whop_topups WHERE user_id = ? AND review_reason IS NOT NULL LIMIT 1').get(userId)) {
      throw new WhopPaymentError('A previous card payment needs review. Please contact support.', 409)
    }
    const existing = db().prepare(`${TOPUP_SELECT} WHERE w.user_id = ? AND w.request_key = ?`).get(userId, requestKey) as WhopTopup | undefined
    if (existing) {
      if (existing.credit_amount_cents !== amountCents || existing.account_id !== config.accountId
        || existing.product_id !== config.productId || existing.environment !== config.mode) {
        throw new WhopPaymentError('This request key belongs to a different payment.', 409)
      }
      return existing
    }
    if (!consumeAttempt('whop-checkout', String(userId), 10, 3600)) throw new WhopPaymentError('Too many payment requests. Please try again later.', 429)
    const reference = randomBytes(16).toString('hex')
    const feeCents = cardFeeCents(amountCents)
    db().prepare(`INSERT INTO invoices (reference, user_id, gateway, credit_amount_cents, fee_cents, total_due_cents, provider, idempotency_key)
      VALUES (?, ?, 'whop_card', ?, ?, ?, 'whop', ?)`).run(reference, userId, amountCents, feeCents, amountCents + feeCents, `whop-${reference}`)
    db().prepare(`INSERT INTO whop_topups (invoice_reference, user_id, request_key, account_id, product_id, environment)
      VALUES (?, ?, ?, ?, ?, ?)`).run(reference, userId, requestKey, config.accountId, config.productId, config.mode)
    return getWhopTopup(reference, userId)!
  }).immediate()
  if (topup.checkout_url || topup.credited) return topup
  const subtotalCents = topup.credit_amount_cents + topup.fee_cents

  // The hosted page collects all card data. This server never receives a PAN/CVC.
  const checkout = await client(config).checkoutConfigurations.create({
    account_id: config.accountId, mode: 'payment',
    plan: { account_id: config.accountId, product_id: config.productId, currency: 'usd',
      initial_price: subtotalCents / 100, plan_type: 'one_time', renewal_price: 0,
      title: `Service credits — USD ${(amountCents / 100).toFixed(2)}`,
      description: 'Prepaid credits on iunlockmobile.com for device reports, carrier unlocking and available device services, including iCloud activation-lock, MDM profile and Google account (FRP) removal, subject to eligibility.'
        + (topup.fee_cents > 0 ? ` Includes ${formatUsd(topup.credit_amount_cents)} service credits and ${formatUsd(topup.fee_cents)} card payment fee. The fee is not added to your credit balance.` : ''),
      visibility: 'hidden', stock: 1, unlimited_stock: false, force_create_new_plan: true,
      three_ds_level: 'mandate_challenge',
      payment_method_configuration: { enabled: ['card'], disabled: [], include_platform_defaults: false } },
    metadata: { invoice_reference: topup.invoice_reference, integration: 'iunlockmobile-credit-v1' },
    payment_method_configuration: { enabled: ['card'], disabled: [], include_platform_defaults: false },
    redirect_url: `${publicOrigin()}/user/invoice/${topup.invoice_reference}`,
  }, { idempotencyKey: `whop-topup-${topup.invoice_reference}` })
  if (!checkout.purchase_url || !/^ch_[A-Za-z0-9]+$/.test(checkout.id)
    || checkout.account_id !== config.accountId || checkout.plan?.plan_type !== 'one_time'
    || checkout.plan.currency !== 'usd' || Math.round(checkout.plan.initial_price * 100) !== subtotalCents) {
    throw new WhopPaymentError('The payment provider returned an unexpected checkout. Please contact support.', 502)
  }
  const url = safeWhopCheckoutUrl(checkout.purchase_url, config.mode)
  db().prepare(`UPDATE whop_topups SET checkout_id = ?, plan_id = ?, checkout_url = ?
    WHERE invoice_reference = ? AND checkout_id IS NULL`).run(checkout.id, checkout.plan.id, url, topup.invoice_reference)
  return getWhopTopup(topup.invoice_reference, userId)!
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new WhopPaymentError('Invalid webhook payload.')
  return value as Record<string, unknown>
}

/** Verify bytes, timestamp, account and version before persisting a minimal inbox record. */
export function enqueueWhopEvent(raw: string, headers: Record<string, string>): 'queued' | 'duplicate' | 'ignored' {
  const config = whopConfiguration()
  if (!config) throw new WhopPaymentError('Whop webhook is not configured.', 503)
  const event = record(unwrapWebhook(raw, { headers, key: config.secret }))
  // Dashboard-created v1 webhooks have no date pin and use company_id.
  // Only the payment ID is consumed here; settlement always retrieves the
  // authoritative payment through our date-pinned API client.
  const dashboardEnvelope = event.api_version_date == null
  const accountId = dashboardEnvelope ? event.company_id : event.account_id
  if (event.id !== headers['webhook-id'] || typeof event.id !== 'string' || event.id.length > 200
    || accountId !== config.accountId || event.api_version !== 'v1'
    || (!dashboardEnvelope && event.api_version_date !== WHOP_API_VERSION)
    || [event.account_id, event.company_id].some(value => value !== undefined && value !== config.accountId)) {
    throw new WhopPaymentError('Webhook account or version mismatch.')
  }
  if (!WHOP_EVENTS.includes(event.type as typeof WHOP_EVENTS[number])) return 'ignored'
  const data = record(event.data)
  // Refund and dispute events embed payment.id; dispute alerts use payment_id.
  const nestedPayment = data.payment && typeof data.payment === 'object' && !Array.isArray(data.payment)
    ? data.payment as Record<string, unknown> : null
  const paymentId = String(event.type).startsWith('payment.') ? data.id : data.payment_id ?? nestedPayment?.id
  if (typeof paymentId !== 'string' || !/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new WhopPaymentError('Invalid payment reference.')
  const result = db().prepare(`INSERT OR IGNORE INTO whop_webhook_events (event_id, event_type, payment_id, account_id)
    VALUES (?, ?, ?, ?)`).run(event.id, String(event.type), paymentId, config.accountId)
  return result.changes ? 'queued' : 'duplicate'
}

function cents(value: Whop.Money | null | undefined, nullable = false): number {
  if (value == null && nullable) return 0
  if (!value || value.currency !== 'usd' || value.decimals !== 2 || typeof value.amount !== 'string') throw new WhopPaymentError('Unexpected payment currency or amount.')
  const result = parseUsd(value.amount)
  if (result === null || !Number.isSafeInteger(result)) throw new WhopPaymentError('Invalid payment amount.')
  return result
}

/** Only an authenticated server-to-server retrieve may reach this settlement path. */
function settlePayment(payment: Whop.Payment, config: Configuration): string {
  if (payment.account_id !== config.accountId) throw new WhopPaymentError('Wrong receiving account.')
  const ref = payment.metadata?.invoice_reference
  if (typeof ref !== 'string' || !/^[a-f0-9]{32}$/.test(ref)) return 'unmatched'
  return db().transaction(() => {
    const topup = db().prepare(`${TOPUP_SELECT} WHERE w.invoice_reference = ?`).get(ref) as WhopTopup | undefined
    if (!topup) return 'unmatched'
    if (!topup.checkout_id) throw new WhopPaymentError('Checkout is still being saved.', 503)
    if (topup.environment !== config.mode || topup.account_id !== payment.account_id
      || payment.product_id !== topup.product_id || payment.plan_id !== topup.plan_id
      || payment.checkout_configuration_id !== topup.checkout_id || payment.metadata?.integration !== 'iunlockmobile-credit-v1') {
      throw new WhopPaymentError('Payment does not match the stored invoice.')
    }
    const updated = Date.parse(payment.updated_at)
    if (!Number.isFinite(updated)) throw new WhopPaymentError('Invalid provider timestamp.')
    if (topup.payment_id === payment.id && topup.processor_updated_at && updated < Date.parse(topup.processor_updated_at)) return 'stale'
    // Failed/unfinished attempts may not have an amount or payment method yet.
    // They must not bind an invoice or overwrite an already settled payment.
    if (payment.status !== 'paid' && !payment.paid_at && !['refunded', 'auto_refunded'].includes(payment.substatus)) {
      if (topup.payment_id || topup.credited || topup.review_reason) return 'ignored'
      const failed = ['failed', 'blocked', 'canceled', 'uncollectible'].includes(payment.substatus)
      db().prepare("UPDATE whop_topups SET last_checked_at = datetime('now') WHERE invoice_reference = ?").run(ref)
      db().prepare("UPDATE invoices SET status = ?, note = ?, updated_at = datetime('now') WHERE reference = ?")
        .run(failed ? 'failed' : 'pending', failed ? 'The card payment did not complete. You can retry checkout.' : null, ref)
      return failed ? 'failed' : 'pending'
    }
    // A second genuine charge for one invoice requires a refund/review, never a second credit.
    if (topup.payment_id && topup.payment_id !== payment.id) {
      db().prepare("UPDATE whop_topups SET review_reason = 'multiple_payments' WHERE invoice_reference = ?").run(ref)
      db().prepare("UPDATE invoices SET status = 'review', note = 'Multiple card payments need review.' WHERE reference = ?").run(ref)
      return 'review'
    }
    const total = cents(payment.total)
    const subtotal = cents(payment.subtotal)
    const tax = cents(payment.tax_amount, true)
    const refund = cents(payment.refunded_amount, true)
    const taxRefund = cents(payment.tax_refunded_amount, true)
    const amount = topup.credit_amount_cents
    const expectedSubtotal = amount + topup.fee_cents
    if (payment.currency !== 'usd' || subtotal !== expectedSubtotal || total < expectedSubtotal
      || (tax > 0 && payment.tax_behavior !== 'exclusive') || total - tax !== expectedSubtotal
      || refund > total || taxRefund > tax || taxRefund > refund || refund - taxRefund > expectedSubtotal
      || payment.promo_code_id || payment.payment_method_type !== 'card'
      || !['one_time', 'subscription_create'].includes(payment.billing_reason ?? '')) {
      db().prepare("UPDATE whop_topups SET review_reason = 'payment_amount_mismatch' WHERE invoice_reference = ?").run(ref)
      db().prepare("UPDATE invoices SET status = 'review', note = 'Card payment amount or method needs review.' WHERE reference = ?").run(ref)
      return 'review'
    }
    const disputeResolved = ['dispute_won', 'dispute_warning_closed', 'resolution_won'].includes(payment.substatus)
    const disputed = (/dispute|resolution/.test(payment.substatus) || Boolean(payment.dispute_alerted_at)) && !disputeResolved
    // Tax and card fees were never credited. Allocate a partial pretax refund
    // proportionally between credit and the invoice's stored fee. Fee-free
    // invoices retain their original dollar-for-dollar reversal behavior.
    const fullyRefunded = refund >= total || ['refunded', 'auto_refunded'].includes(payment.substatus)
    const targetReversed = fullyRefunded ? amount : Math.min(amount, Math.round((refund - taxRefund) * amount / expectedSubtotal))
    const successful = payment.status === 'paid' && ['succeeded', 'partially_refunded', 'dispute_won', 'dispute_warning_closed', 'resolution_won'].includes(payment.substatus)
    let credited = topup.credited
    if (!credited && successful && !fullyRefunded && !disputed) {
      credit(topup.user_id, amount, 'topup', 'invoice', ref)
      if (config.mode === 'live' && targetReversed === 0) upgradeResellerAfterTopup(topup.user_id, amount, ref)
      credited = 1
    }
    let reversed = topup.reversed_cents
    if (credited && targetReversed > reversed) {
      const available = getBalance(topup.user_id).availableCents
      const debit = Math.min(available, targetReversed - reversed)
      if (debit > 0) {
        credit(topup.user_id, -debit, 'adjustment', 'whop_refund', `${payment.id}:${reversed + debit}`)
        reversed += debit
      }
    }
    const due = credited ? Math.max(0, targetReversed - reversed) : 0
    const persistentReview = ['multiple_payments', 'payment_amount_mismatch'].includes(topup.review_reason ?? '') ? topup.review_reason : null
    const review = persistentReview ?? (disputed ? 'dispute' : due > 0 ? 'refund_balance_shortfall' : null)
    const status = review ? 'review' : fullyRefunded ? 'refunded' : credited ? 'success' : ['void', 'uncollectible'].includes(payment.status) ? 'failed' : 'pending'
    db().prepare(`UPDATE whop_topups SET payment_id = ?, credited = ?, reversed_cents = ?, reversal_due_cents = ?,
      review_reason = ?, processor_updated_at = ?, last_checked_at = datetime('now') WHERE invoice_reference = ?`)
      .run(payment.status === 'paid' || credited || fullyRefunded ? payment.id : null, credited, reversed, due, review, payment.updated_at, ref)
    db().prepare(`UPDATE invoices SET status = ?, payment_reference = ?, provider_charge_id = ?, tax_cents = ?,
      total_due_cents = ?, paid_at = COALESCE(paid_at, ?), credited_at = CASE WHEN ? = 1 THEN COALESCE(credited_at, datetime('now')) ELSE credited_at END,
      note = ?, updated_at = datetime('now') WHERE reference = ?`)
      .run(status, payment.id, payment.id, tax, total, payment.paid_at, credited,
        review ? 'Card payment requires support review.' : reversed > 0 ? 'Refunded credit has been removed from the account.' : null, ref)
    return status
  }).immediate()
}

/** Durable retries survive process restarts; multiple workers claim with a lease. */
export async function processWhopEvents(limit = 10): Promise<{ processed: number; errors: number }> {
  const config = whopConfiguration()
  const stats = { processed: 0, errors: 0 }
  if (!config) return stats // Keep handling refunds even when checkout is disabled.
  for (let index = 0; index < Math.min(20, Math.max(1, limit)); index++) {
    const job = db().transaction(() => {
      const row = db().prepare(`SELECT event_id, payment_id, attempts FROM whop_webhook_events
        WHERE state = 'pending' AND (next_attempt_at IS NULL OR next_attempt_at <= datetime('now'))
        AND (locked_until IS NULL OR locked_until < datetime('now')) ORDER BY received_at LIMIT 1`)
        .get() as { event_id: string; payment_id: string; attempts: number } | undefined
      if (row) db().prepare("UPDATE whop_webhook_events SET locked_until = datetime('now', '+60 seconds'), attempts = attempts + 1 WHERE event_id = ?").run(row.event_id)
      return row
    }).immediate()
    if (!job) break
    try {
      const payment = await client(config).payments.retrieve({ id: job.payment_id })
      if (payment.id !== job.payment_id) throw new WhopPaymentError('Payment identity mismatch.')
      const outcome = payment.metadata?.integration === 'iunlockmobile-guest-v1'
        ? (await import('./guest-checkout')).settleGuestPayment(payment)
        : settlePayment(payment, config)
      db().prepare(`UPDATE whop_webhook_events SET state = ?, processed_at = datetime('now'), locked_until = NULL, last_error = NULL
        WHERE event_id = ?`).run(outcome === 'unmatched' ? 'unmatched' : 'processed', job.event_id)
      stats.processed++
    } catch (error) {
      logPaymentFailure('whop.webhook.verify', error)
      // Never persist provider bodies, cardholder data, API keys or raw request headers.
      db().prepare(`UPDATE whop_webhook_events SET locked_until = NULL, next_attempt_at = datetime('now', '+1 minute'),
        last_error = 'Verification pending; check provider configuration and invoice identity.' WHERE event_id = ?`).run(job.event_id)
      stats.errors++
    }
  }
  return stats
}

/** Recheck settled payments independently of webhooks, including refund shortfalls. */
export async function reconcileWhopPayments(limit = 5): Promise<{ checked: number; errors: number }> {
  const config = whopConfiguration()
  const stats = { checked: 0, errors: 0 }
  if (!config) return stats
  const rows = db().prepare(`SELECT invoice_reference, payment_id FROM whop_topups
    WHERE account_id = ? AND environment = ? AND payment_id IS NOT NULL
    AND (last_checked_at IS NULL OR last_checked_at <= datetime('now', '-15 minutes'))
    ORDER BY COALESCE(last_checked_at, created_at) LIMIT ?`)
    .all(config.accountId, config.mode, Math.min(20, Math.max(1, limit))) as { invoice_reference: string; payment_id: string }[]
  for (const row of rows) {
    // Advance even on errors so a broken record cannot starve the rest of the queue.
    db().prepare("UPDATE whop_topups SET last_checked_at = datetime('now') WHERE invoice_reference = ?").run(row.invoice_reference)
    try {
      const payment = await client(config).payments.retrieve({ id: row.payment_id })
      if (payment.id !== row.payment_id) throw new WhopPaymentError('Payment identity mismatch.')
      settlePayment(payment, config)
      stats.checked++
    } catch (error) { logPaymentFailure('whop.reconcile.verify', error); stats.errors++ }
  }
  return stats
}

export function whopReviewSummary() {
  return db().prepare(`SELECT
    (SELECT COUNT(*) FROM whop_topups WHERE review_reason IS NOT NULL) AS reviews,
    (SELECT COUNT(*) FROM whop_webhook_events WHERE state = 'unmatched') AS unmatched,
    (SELECT COUNT(*) FROM whop_webhook_events WHERE state = 'pending' AND attempts >= 3) AS retries`)
    .get() as { reviews: number; unmatched: number; retries: number }
}
