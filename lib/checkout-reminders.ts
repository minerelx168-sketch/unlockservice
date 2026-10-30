import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Whop } from '@whop/sdk'
import { db } from './db'
import { emailDeliveryConfigured, MarketingEmailError, sendMarketingEmail } from './account-security'
import { guestCheckoutTotal, guestOrderPath, getGuestCheckout } from './guest-checkout'
import { client, safeWhopCheckoutUrl, whopCheckoutEnabled, whopConfiguration } from './whop'
import { decryptPaidReportImei } from './paid-report-imei'

export const CHECKOUT_REMINDER_DELAY_MS = 5 * 60_000
export const CHECKOUT_REMINDER_EXPIRY_MS = 23 * 60 * 60_000
const MAX_PROVIDER_PAGES = 3
const RETRY_429_MS = 5 * 60_000
const MAX_429_ATTEMPTS = 3
const REFERENCE = /^[a-f0-9]{32}$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
type Kind = 'guest' | 'topup'
type Config = NonNullable<ReturnType<typeof whopConfiguration>>
type UserRow = { id: number; email: string; status: string; banned_at: string | null; email_verified_at: string | null; account_type: string }
type QueueRow = { kind: Kind; reference: string; user_id: number; recipient_hash: string; token_hash: string; dedupe_hash: string | null; lease_token: string; attempts: number; idempotency_key: string }
type Expected = { reference: string; accountId: string; productId: string; environment: string; checkoutId: string; planId: string; integration: string; amountCents: number }

function secret(): string | null {
  const value = process.env.IUNLOCKMOBILE_CHECKOUT_REMINDERS_SECRET?.trim()
  return value && value.length >= 32 ? value : null
}
function validOrigin(): string | null {
  try {
    const url = new URL(process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN?.trim() ?? '')
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && url.pathname === '/' && !url.search && !url.hash ? url.origin : null
  } catch { return null }
}
export function checkoutReminderConfigured(): boolean {
  return process.env.IUNLOCKMOBILE_CHECKOUT_REMINDERS_ENABLED === '1'
    && Boolean(process.env.IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS?.trim())
    && Boolean(secret()) && Boolean(validOrigin()) && emailDeliveryConfigured() && whopCheckoutEnabled()
}
function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}
function hmac(value: string): string { return createHmac('sha256', secret()!).update(value).digest('hex') }
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex') }
function recipientHash(email: string): string { return hmac(`recipient:v1:${email}`) }
function tokenForRecipient(recipient: string): string { return `v1.${recipient}.${hmac(`unsubscribe:v1:${recipient}`)}` }
function sqliteTime(value: string): number { return Date.parse(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`) }
function setting(key: string): string | null { return (db().prepare('SELECT value FROM checkout_reminder_settings WHERE key=?').get(key) as { value: string } | undefined)?.value ?? null }
function ownerRow(userId: number): UserRow | undefined { return db().prepare('SELECT id,email,status,banned_at,email_verified_at,account_type FROM users WHERE id=?').get(userId) as UserRow | undefined }
function validOwner(userId: number, email: string): boolean {
  const user = ownerRow(userId)
  return Boolean(user && ['customer', 'reseller'].includes(user.account_type) && user.status === 'active' && !user.banned_at && user.email_verified_at && user.email.toLowerCase() === email)
}
function suppressionExists(recipient: string): boolean { return Boolean(db().prepare('SELECT 1 FROM checkout_reminder_suppressions WHERE recipient_hash=? AND suppressed_at IS NOT NULL').get(recipient)) }
function hasAccountReview(userId: number): boolean {
  return Boolean(db().prepare('SELECT 1 FROM whop_topups WHERE user_id=? AND review_reason IS NOT NULL LIMIT 1').get(userId)
    || db().prepare('SELECT 1 FROM guest_checkouts WHERE customer_user_id=? AND wallet_review_reason IS NOT NULL LIMIT 1').get(userId))
}
function emailForQueue(kind: Kind, reference: string): string {
  if (kind === 'guest') return String((db().prepare('SELECT email FROM guest_checkouts WHERE reference=?').get(reference) as { email: string } | undefined)?.email ?? '').toLowerCase()
  return String((db().prepare('SELECT u.email FROM invoices i JOIN users u ON u.id=i.user_id WHERE i.reference=?').get(reference) as { email: string } | undefined)?.email ?? '').toLowerCase()
}
function localPaymentStillOpen(kind: Kind, reference: string, userId: number): boolean {
  if (hasAccountReview(userId)) return false
  if (kind === 'guest') {
    const row = getGuestCheckout(reference)
    return Boolean(row && row.payment_method === 'card' && row.state === 'pending'
      && (row.customer_user_id === null || row.customer_user_id === userId)
      && !row.review_reason && !row.wallet_review_reason && !row.payment_id && !row.paid_at
      && !row.refund_requested_at && row.checkout_id && row.plan_id && row.checkout_url)
  }
  const row = db().prepare(`SELECT i.status,i.gateway,i.payment_reference,i.paid_at,w.payment_id,w.review_reason,w.credited,w.reversed_cents,w.reversal_due_cents,w.checkout_id,w.plan_id,w.checkout_url
    FROM invoices i JOIN whop_topups w ON w.invoice_reference=i.reference WHERE i.reference=? AND i.user_id=? AND w.user_id=?`).get(reference, userId, userId) as
    { status: string; gateway: string; payment_reference: string | null; paid_at: string | null; payment_id: string | null; review_reason: string | null; credited: number; reversed_cents: number; reversal_due_cents: number; checkout_id: string | null; plan_id: string | null; checkout_url: string | null } | undefined
  return Boolean(row && row.gateway === 'whop_card' && row.status === 'pending' && !row.payment_reference && !row.paid_at && !row.payment_id && !row.review_reason
    && !row.credited && !row.reversed_cents && !row.reversal_due_cents && row.checkout_id && row.plan_id && row.checkout_url)
}

/** Opaque signed recipient-level capability; contains no clear email address. */
export function checkoutReminderUnsubscribeToken(email: string): string {
  const normalized = normalizeEmail(email)
  return normalized && secret() ? tokenForRecipient(recipientHash(normalized)) : ''
}
export function unsubscribeCheckoutReminders(token: string): boolean {
  const match = /^v1\.([a-f0-9]{64})\.([a-f0-9]{64})$/.exec(token)
  if (!secret() || !match) return false
  const expected = hmac(`unsubscribe:v1:${match[1]}`)
  if (!timingSafeEqual(Buffer.from(match[2], 'hex'), Buffer.from(expected, 'hex'))) return false
  db().transaction(() => {
    db().prepare(`INSERT INTO checkout_reminder_suppressions(recipient_hash,token_hash,suppressed_at) VALUES(?,?,datetime('now'))
      ON CONFLICT(recipient_hash) DO UPDATE SET token_hash=excluded.token_hash,suppressed_at=excluded.suppressed_at`).run(match[1], sha256(token))
    db().prepare(`UPDATE checkout_payment_reminders SET suppressed=1,unresolved=0,unresolved_reason='recipient_unsubscribed',lease_token=NULL,lease_until=0
      WHERE recipient_hash=? AND send_accepted_at IS NULL`).run(match[1])
  }).immediate()
  return true
}

/** Only call after a separately checked optional opt-in on an authenticated owned bill. */
export function requestCheckoutReminderOptIn(kind: Kind, reference: string, email: string, userId: number): boolean {
  if (!checkoutReminderConfigured() || !REFERENCE.test(reference) || !Number.isSafeInteger(userId) || userId <= 0) return false
  const normalized = normalizeEmail(email)
  if (!normalized || !validOwner(userId, normalized) || hasAccountReview(userId)) return false
  const recipient = recipientHash(normalized)
  if (suppressionExists(recipient)) return false
  try {
    return db().transaction(() => {
      const now = Date.now()
      const cutoverValue = setting('migration_cutover_at_ms')
      if (cutoverValue === null) return false
      const cutover = Number(cutoverValue)
      let createdAt: string
      let dedupe: string
      if (kind === 'guest') {
        const row = getGuestCheckout(reference)
        if (!row || row.email.toLowerCase() !== normalized || !localPaymentStillOpen(kind, reference, userId)) return false
        const identifier = decryptPaidReportImei(row.imei_encrypted)
        if (!identifier) return false
        createdAt = row.created_at
        dedupe = hmac(`dedupe:v1:guest:${normalized}:${row.product_code}:${identifier}`)
      } else {
        const row = db().prepare('SELECT created_at FROM invoices WHERE reference=? AND user_id=?').get(reference, userId) as { created_at: string } | undefined
        if (!row || !localPaymentStillOpen(kind, reference, userId)) return false
        createdAt = row.created_at
        dedupe = hmac(`dedupe:v1:topup:${normalized}:${reference}`)
      }
      const created = sqliteTime(createdAt)
      if (!Number.isFinite(cutover) || !Number.isFinite(created) || created < cutover || created > now || now >= created + CHECKOUT_REMINDER_EXPIRY_MS) return false
      if (db().prepare('SELECT 1 FROM checkout_payment_reminders WHERE dedupe_hash=? AND expires_at>? LIMIT 1').get(dedupe, now)) return false
      const token = checkoutReminderUnsubscribeToken(normalized)
      return db().prepare(`INSERT OR IGNORE INTO checkout_payment_reminders
        (kind,reference,user_id,consent_at,recipient_hash,token_hash,dedupe_hash,due_at,expires_at,next_attempt_at,idempotency_key)
        VALUES(?,?,?,datetime('now'),?,?,?,?,?,?,?)`).run(kind, reference, userId, recipient, sha256(token), dedupe,
        created + CHECKOUT_REMINDER_DELAY_MS, created + CHECKOUT_REMINDER_EXPIRY_MS, created + CHECKOUT_REMINDER_DELAY_MS,
        `checkout-reminder/${kind}/${reference}`).changes === 1
    }).immediate()
  } catch { return false }
}

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!)) }
function statusUrl(kind: Kind, reference: string): string { return kind === 'guest' ? `${validOrigin()}${guestOrderPath(reference)}` : `${validOrigin()}/user/invoice/${reference}` }
function reminderEmail(row: QueueRow, email: string, title: string, amountCents: number) {
  const status = statusUrl(row.kind, row.reference)
  const unsubscribe = `${validOrigin()}/api/checkout/reminders/unsubscribe?token=${encodeURIComponent(checkoutReminderUnsubscribeToken(email))}`
  const postal = process.env.IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS!.trim()
  const amount = `$${(amountCents / 100).toFixed(2)} USD`
  const text = `iUnlockMobile\n${title}\nReference: ${row.reference}\nSaved card quote: ${amount}\n\nYour payment request is still open. Open the private status page to continue your payment. If you have already paid, check the status instead of paying again. Whop shows any payment-provider charges before you confirm.\n\nContinue or check payment: ${status}\n\nThis is the single marketing reminder you opted into for this bill. We will not send another reminder.\nUnsubscribe: ${unsubscribe}\n\niUnlockMobile\n${postal}`
  const html = `<p><strong>${escapeHtml(title)}</strong><br>Reference: ${escapeHtml(row.reference)}<br>Saved card quote: ${escapeHtml(amount)}</p><p>Open your private status page to continue payment. Already paid? Check the status instead of paying again. Whop shows any payment-provider charges before you confirm.</p><p><a href="${escapeHtml(status)}">Continue or check secure payment</a></p><p>This is the single marketing reminder you opted into for this bill. We will not send another reminder.</p><p><a href="${escapeHtml(unsubscribe)}">Unsubscribe from payment reminders</a></p><p>iUnlockMobile<br>${escapeHtml(postal)}</p>`
  return { text, html, unsubscribe }
}
function paymentMatches(payment: Whop.Payment, config: Config, expected: Expected): boolean {
  return payment.account_id === expected.accountId && payment.product_id === expected.productId && payment.plan_id === expected.planId
    && payment.checkout_configuration_id === expected.checkoutId && payment.metadata?.integration === expected.integration
    && (expected.integration === 'iunlockmobile-guest-v1' ? payment.metadata?.guest_reference === expected.reference : payment.metadata?.invoice_reference === expected.reference)
    && expected.environment === config.mode
}
async function authoritativeCardClear(config: Config, expected: Expected, deadline: number): Promise<'clear' | 'payment_present' | 'unresolved'> {
  try {
    if (Date.now() >= deadline || !/^ch_[A-Za-z0-9]+$/.test(expected.checkoutId) || !/^plan_[A-Za-z0-9]+$/.test(expected.planId)) return 'unresolved'
    const checkout = await client(config).checkoutConfigurations.retrieve({ id: expected.checkoutId })
    const meta = checkout.metadata
    if (checkout.id !== expected.checkoutId || checkout.account_id !== expected.accountId || checkout.mode !== 'payment'
      || checkout.plan?.id !== expected.planId || checkout.plan.plan_type !== 'one_time' || checkout.plan.currency !== 'usd'
      || !Number.isFinite(checkout.plan.initial_price) || Math.round(checkout.plan.initial_price * 100) !== expected.amountCents
      || checkout.plan.renewal_price !== 0 || checkout.plan.visibility === 'archived'
      || meta?.integration !== expected.integration
      || (expected.integration === 'iunlockmobile-guest-v1' ? meta?.guest_reference !== expected.reference : meta?.invoice_reference !== expected.reference)
      || !checkout.purchase_url) return 'unresolved'
    safeWhopCheckoutUrl(checkout.purchase_url, config.mode)
    if (Date.now() >= deadline) return 'unresolved'
    let page = await client(config).payments.list({ mode: 'account_sales', account_id: config.accountId, plan_id: expected.planId, first: 10 })
    for (let pageNumber = 0; pageNumber < MAX_PROVIDER_PAGES; pageNumber++) {
      if (!Array.isArray(page.data)) return 'unresolved'
      // Never discard mismatched records and interpret the remaining empty set as unpaid.
      if (page.data.some(payment => !paymentMatches(payment, config, expected))) return 'unresolved'
      if (page.data.length) return 'payment_present'
      if (!page.hasNextPage()) return 'clear'
      if (pageNumber + 1 >= MAX_PROVIDER_PAGES || Date.now() >= deadline) return 'unresolved'
      page = await page.getNextPage()
    }
    return 'unresolved'
  } catch { return 'unresolved' }
}
function markUnresolved(row: QueueRow, reason: string, suppressed = false) {
  db().prepare(`UPDATE checkout_payment_reminders SET unresolved=?,suppressed=?,unresolved_reason=?,lease_token=NULL,lease_until=0,next_attempt_at=0
    WHERE kind=? AND reference=? AND lease_token=?`).run(suppressed ? 0 : 1, suppressed ? 1 : 0, reason, row.kind, row.reference, row.lease_token)
}
function finalSendEligible(row: QueueRow, now: number): boolean {
  if (!checkoutReminderConfigured() || suppressionExists(row.recipient_hash)) return false
  const fresh = db().prepare(`SELECT user_id,recipient_hash,token_hash FROM checkout_payment_reminders WHERE kind=? AND reference=? AND lease_token=?
    AND send_accepted_at IS NULL AND suppressed=0 AND unresolved=0 AND due_at<=? AND expires_at>? AND lease_until>?`).get(row.kind, row.reference, row.lease_token, now, now, Date.now()) as
    { user_id: number; recipient_hash: string; token_hash: string } | undefined
  const email = emailForQueue(row.kind, row.reference)
  return Boolean(fresh && fresh.user_id === row.user_id && validOwner(row.user_id, email) && localPaymentStillOpen(row.kind, row.reference, row.user_id)
    && recipientHash(email) === fresh.recipient_hash && fresh.recipient_hash === row.recipient_hash && sha256(checkoutReminderUnsubscribeToken(email)) === fresh.token_hash)
}
function claimDue(candidate: Omit<QueueRow, 'lease_token'>, now: number): QueueRow | null {
  const leaseToken = randomBytes(16).toString('hex')
  return db().transaction(() => {
    if (suppressionExists(candidate.recipient_hash)) return null
    if (!db().prepare(`UPDATE checkout_payment_reminders SET lease_token=?,lease_until=?,attempts=attempts+1 WHERE kind=? AND reference=?
      AND send_accepted_at IS NULL AND unresolved=0 AND suppressed=0 AND due_at<=? AND expires_at>? AND next_attempt_at<=? AND lease_until<=?`)
      .run(leaseToken, now + 120_000, candidate.kind, candidate.reference, now, now, now, now).changes) return null
    const row = db().prepare('SELECT kind,reference,user_id,recipient_hash,token_hash,dedupe_hash,lease_token,attempts,idempotency_key FROM checkout_payment_reminders WHERE kind=? AND reference=?').get(candidate.kind, candidate.reference) as QueueRow
    if (!finalSendEligible(row, now)) { markUnresolved(row, 'local_payment_or_owner_changed', true); return null }
    return row
  }).immediate()
}
async function deliver(row: QueueRow, now: number, deadline: number): Promise<'sent' | 'skip' | 'unresolved'> {
  const config = whopConfiguration()
  if (!config) { markUnresolved(row, 'checkout_configuration_unavailable'); return 'unresolved' }
  let expected: Expected
  let title: string
  let amount: number
  if (row.kind === 'guest') {
    const current = getGuestCheckout(row.reference)
    if (!current) { markUnresolved(row, 'bill_missing', true); return 'skip' }
    amount = guestCheckoutTotal(current)
    title = current.product_name
    expected = { reference: current.reference, accountId: current.account_id, productId: current.product_id, environment: current.environment,
      checkoutId: current.checkout_id!, planId: current.plan_id!, integration: 'iunlockmobile-guest-v1', amountCents: amount }
  } else {
    const current = db().prepare(`SELECT i.reference,i.total_due_cents,i.credit_amount_cents,i.fee_cents,w.account_id,w.product_id,w.environment,w.checkout_id,w.plan_id
      FROM invoices i JOIN whop_topups w ON w.invoice_reference=i.reference WHERE i.reference=? AND i.user_id=? AND w.user_id=?`).get(row.reference, row.user_id, row.user_id) as
      { reference: string; total_due_cents: number; credit_amount_cents: number; fee_cents: number; account_id: string; product_id: string; environment: string; checkout_id: string; plan_id: string } | undefined
    if (!current) { markUnresolved(row, 'bill_missing', true); return 'skip' }
    amount = current.total_due_cents
    title = 'Account credit top-up'
    expected = { reference: current.reference, accountId: current.account_id, productId: current.product_id, environment: current.environment,
      checkoutId: current.checkout_id, planId: current.plan_id, integration: 'iunlockmobile-credit-v1', amountCents: current.credit_amount_cents + current.fee_cents }
  }
  if (expected.accountId !== config.accountId || expected.productId !== config.productId || expected.environment !== config.mode) { markUnresolved(row, 'checkout_configuration_mismatch'); return 'unresolved' }
  const verification = await authoritativeCardClear(config, expected, deadline)
  if (verification !== 'clear') { markUnresolved(row, verification === 'payment_present' ? 'provider_payment_present' : 'provider_read_failed_or_ambiguous', verification === 'payment_present'); return verification === 'payment_present' ? 'skip' : 'unresolved' }
  // Re-read owner, suppression, local payment and the exact lease after every asynchronous read.
  if (!finalSendEligible(row, Math.max(now, Date.now()))) { markUnresolved(row, 'final_payment_owner_or_suppression_changed', true); return 'skip' }
  const email = emailForQueue(row.kind, row.reference)
  const mail = reminderEmail(row, email, title, amount)
  try {
    const receipt = await sendMarketingEmail(email, 'Your iUnlockMobile payment is waiting', mail.html, mail.text, { idempotencyKey: row.idempotency_key, unsubscribeUrl: mail.unsubscribe })
    db().prepare(`UPDATE checkout_payment_reminders SET send_accepted_at=COALESCE(send_accepted_at,datetime('now')),send_provider_id=?,lease_token=NULL,lease_until=0,next_attempt_at=0,unresolved=0
      WHERE kind=? AND reference=? AND idempotency_key=?`).run(receipt.providerMessageId, row.kind, row.reference, row.idempotency_key)
    return 'sent'
  } catch (error) {
    if (error instanceof MarketingEmailError && error.status === 429 && !error.uncertain && row.attempts < MAX_429_ATTEMPTS) {
      db().prepare(`UPDATE checkout_payment_reminders SET next_attempt_at=?,lease_token=NULL,lease_until=0,unresolved_reason='provider_rate_limited'
        WHERE kind=? AND reference=? AND lease_token=?`).run(Date.now() + RETRY_429_MS, row.kind, row.reference, row.lease_token)
    } else markUnresolved(row, error instanceof MarketingEmailError && error.uncertain ? 'delivery_ambiguous' : 'delivery_failed')
    return 'unresolved'
  }
}
export type ReminderStats = { enabled: boolean; claimed: number; sent: number; skipped: number; unresolved: number }
export async function sendCheckoutReminders(now = Date.now(), limit = 5): Promise<ReminderStats> {
  const stats = { enabled: checkoutReminderConfigured(), claimed: 0, sent: 0, skipped: 0, unresolved: 0 }
  if (!stats.enabled) return stats
  const bounded = Number.isFinite(limit) ? Math.max(1, Math.min(5, Math.trunc(limit))) : 1
  const rows = db().prepare(`SELECT kind,reference,user_id,recipient_hash,token_hash,dedupe_hash,attempts,idempotency_key FROM checkout_payment_reminders
    WHERE send_accepted_at IS NULL AND unresolved=0 AND suppressed=0 AND due_at<=? AND expires_at>? AND next_attempt_at<=? AND lease_until<=? ORDER BY due_at LIMIT ?`)
    .all(now, now, now, now, bounded) as Array<Omit<QueueRow, 'lease_token'>>
  const deadline = Date.now() + 30_000
  for (const candidate of rows) {
    if (Date.now() >= deadline) break
    const row = claimDue(candidate, Math.max(now, Date.now()))
    if (!row) continue
    stats.claimed++
    const result = await deliver(row, now, deadline).catch(() => { markUnresolved(row, 'worker_exception'); return 'unresolved' as const })
    if (result === 'sent') stats.sent++
    else if (result === 'skip') stats.skipped++
    else stats.unresolved++
  }
  return stats
}

/** No crypto marketing sends until a validated authoritative chain adapter proves unpaid state. */
export function cryptoReminderSkipReason(): 'requires_authoritative_crypto_verification' { return 'requires_authoritative_crypto_verification' }
