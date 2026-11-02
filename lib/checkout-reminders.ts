import { createHmac, createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import type { Whop } from '@whop/sdk'
import { db } from './db'
import { emailDeliveryConfigured, MarketingEmailError, sendMarketingEmail } from './account-security'
import { guestCheckoutTotal, guestOrderPath, getGuestCheckout } from './guest-checkout'
import { client, safeWhopCheckoutUrl, whopCheckoutEnabled, whopConfiguration } from './whop'
import { codedInvoiceExpired } from './payment-codes'
import { paymentRouteConfiguration } from './payment-config'
import { decryptPaidReportImei } from './paid-report-imei'

export const CHECKOUT_REMINDER_DELAY_MS = 5 * 60_000
export const CHECKOUT_REMINDER_EXPIRY_MS = 23 * 60 * 60_000
const MAX_PROVIDER_PAGES = 3
const RETRY_429_MS = 5 * 60_000
const MAX_429_ATTEMPTS = 3
const LEASE_MS = 120_000
const CRYPTO_WATCHER_FRESH_MS = 5 * 60_000
const REFERENCE = /^[a-f0-9]{32}$/
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const OPEN_SOURCE = /^[a-z][a-z0-9_.:-]{1,63}$/

export type CheckoutReminderKind = 'guest' | 'topup'
type Config = NonNullable<ReturnType<typeof whopConfiguration>>
type UserRow = { id: number; email: string; status: string; banned_at: string | null; email_verified_at: string | null; account_type: string }
type QueueRow = {
  kind: CheckoutReminderKind; reference: string; user_id: number; recipient_hash: string; token_hash: string
  dedupe_hash: string | null; lease_token: string; attempts: number; idempotency_key: string
  opened_at_ms: number; destination_url: string; open_source: string | null; amount_cents: number
}
type ExpectedCard = {
  reference: string; accountId: string; productId: string; environment: string; checkoutId: string; planId: string
  integration: string; amountCents: number; storedCheckoutUrl: string
}
type CryptoCheck = { kind: CheckoutReminderKind; reference: string; invoiceReference: string; routeId: string; createdAt: string }

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

/** Marketing remains closed until the operator supplies a real postal address. */
export function checkoutReminderConfigured(): boolean {
  return process.env.IUNLOCKMOBILE_CHECKOUT_REMINDERS_ENABLED === '1'
    && Boolean(process.env.IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS?.trim())
    && Boolean(secret()) && Boolean(validOrigin()) && emailDeliveryConfigured()
}
function normalizeEmail(value: string): string | null {
  const email = value.trim().toLowerCase()
  return email.length <= 254 && EMAIL.test(email) ? email : null
}
function hmac(value: string): string { return createHmac('sha256', secret()!).update(value).digest('hex') }
function sha256(value: string): string { return createHash('sha256').update(value).digest('hex') }
function recipientHash(email: string): string { return hmac(`recipient:v1:${email}`) }
function tokenForRecipient(recipient: string): string { return `v1.${recipient}.${hmac(`unsubscribe:v1:${recipient}`)}` }
function sqliteTime(value: string): number {
  return Date.parse(value.includes('T') || /z$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`)
}
function setting(key: string): string | null {
  return (db().prepare('SELECT value FROM checkout_reminder_settings WHERE key=?').get(key) as { value: string } | undefined)?.value ?? null
}
function ownerRow(userId: number): UserRow | undefined {
  return db().prepare('SELECT id,email,status,banned_at,email_verified_at,account_type FROM users WHERE id=?').get(userId) as UserRow | undefined
}
function validOwner(userId: number, email: string): boolean {
  const user = ownerRow(userId)
  return Boolean(user && ['customer', 'reseller'].includes(user.account_type) && user.status === 'active'
    && !user.banned_at && user.email_verified_at && user.email.toLowerCase() === email)
}
function suppressionExists(recipient: string): boolean {
  return Boolean(db().prepare('SELECT 1 FROM checkout_reminder_suppressions WHERE recipient_hash=? AND suppressed_at IS NOT NULL').get(recipient))
}
function hasAccountReview(userId: number): boolean {
  return Boolean(db().prepare('SELECT 1 FROM whop_topups WHERE user_id=? AND review_reason IS NOT NULL LIMIT 1').get(userId)
    || db().prepare('SELECT 1 FROM guest_checkouts WHERE customer_user_id=? AND wallet_review_reason IS NOT NULL LIMIT 1').get(userId))
}
function emailForQueue(kind: CheckoutReminderKind, reference: string): string {
  if (kind === 'guest') return String((db().prepare('SELECT email FROM guest_checkouts WHERE reference=?').get(reference) as { email: string } | undefined)?.email ?? '').toLowerCase()
  return String((db().prepare('SELECT u.email FROM invoices i JOIN users u ON u.id=i.user_id WHERE i.reference=?').get(reference) as { email: string } | undefined)?.email ?? '').toLowerCase()
}
function guestCryptoPath(reference: string): string {
  return guestOrderPath(reference).replace('/checkout/result/', '/checkout/crypto/')
}

/**
 * Local state is a necessary guard, never proof that a crypto transfer did not
 * happen. The sender additionally performs a fresh watcher scan immediately
 * before a crypto send and fails closed on any unavailable/ambiguous result.
 */
function localPaymentStillOpen(kind: CheckoutReminderKind, reference: string, userId: number): boolean {
  if (hasAccountReview(userId)) return false
  if (kind === 'guest') {
    const row = getGuestCheckout(reference)
    if (!row || row.state !== 'pending' || row.review_reason || row.wallet_review_reason || row.payment_id || row.paid_at
      || row.refund_requested_at || row.customer_user_id !== null && row.customer_user_id !== userId) return false
    if (row.payment_method === 'card') {
      return Boolean(row.checkout_id && row.plan_id && row.checkout_url)
    }
    if (row.payment_method !== 'crypto' || !row.crypto_invoice_reference || row.customer_user_id !== userId) return false
    const invoice = db().prepare(`SELECT i.status,i.payment_reference,i.paid_at,i.payment_route_id
      FROM invoices i WHERE i.reference=? AND i.user_id=?`).get(row.crypto_invoice_reference, row.user_id) as
      { status: string; payment_reference: string | null; paid_at: string | null; payment_route_id: string | null } | undefined
    if (!invoice || invoice.status !== 'pending' || invoice.payment_reference || invoice.paid_at || !invoice.payment_route_id) return false
    return !db().prepare('SELECT 1 FROM invoice_verifications WHERE invoice_reference=? LIMIT 1').get(row.crypto_invoice_reference)
  }
  const row = db().prepare(`SELECT i.status,i.gateway,i.payment_reference,i.paid_at,i.payment_route_id,w.payment_id,w.review_reason,w.credited,w.reversed_cents,w.reversal_due_cents,w.checkout_id,w.plan_id,w.checkout_url
    FROM invoices i LEFT JOIN whop_topups w ON w.invoice_reference=i.reference
    WHERE i.reference=? AND i.user_id=? AND (w.user_id=? OR w.user_id IS NULL)`).get(reference, userId, userId) as
    { status: string; gateway: string; payment_reference: string | null; paid_at: string | null; payment_route_id: string | null; payment_id: string | null; review_reason: string | null; credited: number; reversed_cents: number; reversal_due_cents: number; checkout_id: string | null; plan_id: string | null; checkout_url: string | null } | undefined
  if (!row || row.status !== 'pending' || row.payment_reference || row.paid_at || row.payment_id || row.review_reason
    || row.credited || row.reversed_cents || row.reversal_due_cents) return false
  if (row.gateway === 'whop_card') return Boolean(row.checkout_id && row.plan_id && row.checkout_url)
  if (!row.payment_route_id) return false
  return !db().prepare('SELECT 1 FROM invoice_verifications WHERE invoice_reference=? LIMIT 1').get(reference)
}

function destinationFor(kind: CheckoutReminderKind, reference: string, userId: number): string | null {
  const origin = validOrigin()
  if (!origin) return null
  if (kind === 'guest') {
    const row = getGuestCheckout(reference)
    if (!row || (row.customer_user_id !== null && row.customer_user_id !== userId)) return null
    if (row.payment_method === 'crypto') return `${origin}${guestCryptoPath(reference)}`
    if (!row.checkout_url) return null
    try { return safeWhopCheckoutUrl(row.checkout_url, row.environment as 'live' | 'sandbox') } catch { return null }
  }
  const row = db().prepare(`SELECT i.gateway,w.environment,w.checkout_url FROM invoices i
    LEFT JOIN whop_topups w ON w.invoice_reference=i.reference WHERE i.reference=? AND i.user_id=?`).get(reference, userId) as
    { gateway: string; environment: string | null; checkout_url: string | null } | undefined
  if (!row) return null
  if (row.gateway !== 'whop_card') return `${origin}/user/invoice/${reference}`
  if (!row.checkout_url || (row.environment !== 'live' && row.environment !== 'sandbox')) return null
  try { return safeWhopCheckoutUrl(row.checkout_url, row.environment) } catch { return null }
}
function amountFor(kind: CheckoutReminderKind, reference: string, userId: number): number | null {
  if (kind === 'guest') {
    const row = getGuestCheckout(reference)
    return row && (row.customer_user_id === null || row.customer_user_id === userId) ? guestCheckoutTotal(row) : null
  }
  const row = db().prepare('SELECT total_due_cents FROM invoices WHERE reference=? AND user_id=?').get(reference, userId) as { total_due_cents: number } | undefined
  return row?.total_due_cents ?? null
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

/**
 * Creates only a dormant, consented sidecar. The five-minute clock does not
 * start here: it starts once recordCheckoutReminderOpened observes the actual
 * payment page navigation.
 */
export function requestCheckoutReminderOptIn(kind: CheckoutReminderKind, reference: string, email: string, userId: number): boolean {
  if (!checkoutReminderConfigured() || !['guest', 'topup'].includes(kind) || !REFERENCE.test(reference) || !Number.isSafeInteger(userId) || userId <= 0) return false
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
        // Anonymous/unverified guest crypto orders do not have a marketing owner.
        if (row.payment_method === 'crypto' && row.customer_user_id !== userId) return false
        const identifier = decryptPaidReportImei(row.imei_encrypted)
        if (!identifier) return false
        createdAt = row.created_at
        dedupe = hmac(`dedupe:v2:guest:${normalized}:${row.product_code}:${identifier}:${row.payment_method}`)
      } else {
        const row = db().prepare('SELECT created_at FROM invoices WHERE reference=? AND user_id=?').get(reference, userId) as { created_at: string } | undefined
        if (!row || !localPaymentStillOpen(kind, reference, userId)) return false
        createdAt = row.created_at
        dedupe = hmac(`dedupe:v2:topup:${normalized}:${reference}`)
      }
      const created = sqliteTime(createdAt)
      if (!Number.isFinite(cutover) || !Number.isFinite(created) || created < cutover || created > now || now >= created + CHECKOUT_REMINDER_EXPIRY_MS) return false
      if (db().prepare('SELECT 1 FROM checkout_payment_reminders WHERE dedupe_hash=? LIMIT 1').get(dedupe)) return false
      const token = checkoutReminderUnsubscribeToken(normalized)
      return db().prepare(`INSERT OR IGNORE INTO checkout_payment_reminders
        (kind,reference,user_id,consent_at,recipient_hash,token_hash,dedupe_hash,due_at,expires_at,next_attempt_at,opened_at_ms,destination_url,open_source,idempotency_key)
        VALUES(?,?,?,datetime('now'),?,?,?,?,?,?,NULL,NULL,NULL,?)`).run(kind, reference, userId, recipient, sha256(token), dedupe,
        0, 0, 0, `checkout-reminder/${kind}/${reference}`).changes === 1
    }).immediate()
  } catch { return false }
}

/**
 * Record the first client navigation to the persisted payment page. This is
 * idempotent and never resets an existing clock, so retries/back-forward cache
 * cannot postpone a reminder or create a second send.
 */
export function recordCheckoutReminderOpened(kind: CheckoutReminderKind, reference: string, userId: number, source = 'client_open'): boolean {
  if (!checkoutReminderConfigured() || !REFERENCE.test(reference) || !Number.isSafeInteger(userId) || userId <= 0 || !OPEN_SOURCE.test(source)) return false
  const normalized = emailForQueue(kind, reference)
  if (!normalized || !validOwner(userId, normalized) || suppressionExists(recipientHash(normalized))) return false
  try {
    return db().transaction(() => {
      const row = db().prepare(`SELECT opened_at_ms FROM checkout_payment_reminders
        WHERE kind=? AND reference=? AND user_id=? AND send_accepted_at IS NULL AND suppressed=0 AND unresolved=0`).get(kind, reference, userId) as { opened_at_ms: number | null } | undefined
      if (!row) return false
      if (row.opened_at_ms !== null) return true
      if (!localPaymentStillOpen(kind, reference, userId)) return false
      const destination = destinationFor(kind, reference, userId)
      const amount = amountFor(kind, reference, userId)
      if (!destination || amount === null) return false
      const createdRow = kind === 'guest'
        ? db().prepare('SELECT created_at FROM guest_checkouts WHERE reference=?').get(reference) as { created_at: string } | undefined
        : db().prepare('SELECT created_at FROM invoices WHERE reference=? AND user_id=?').get(reference, userId) as { created_at: string } | undefined
      const created = createdRow ? sqliteTime(createdRow.created_at) : NaN
      const cutover = Number(setting('migration_cutover_at_ms'))
      const now = Date.now()
      if (!Number.isFinite(created) || !Number.isFinite(cutover) || created < cutover || created > now
        || now >= created + CHECKOUT_REMINDER_EXPIRY_MS) return false
      const changes = db().prepare(`UPDATE checkout_payment_reminders SET opened_at_ms=?,due_at=?,expires_at=?,next_attempt_at=?,destination_url=?,open_source=?,amount_cents=?
        WHERE kind=? AND reference=? AND user_id=? AND opened_at_ms IS NULL AND send_accepted_at IS NULL AND suppressed=0 AND unresolved=0`)
        .run(now, now + CHECKOUT_REMINDER_DELAY_MS, Math.min(now + CHECKOUT_REMINDER_EXPIRY_MS, created + CHECKOUT_REMINDER_EXPIRY_MS), now + CHECKOUT_REMINDER_DELAY_MS, destination, source, amount, kind, reference, userId).changes
      return changes === 1
    }).immediate()
  } catch { return false }
}

function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]!)) }
function paymentMatches(payment: Whop.Payment, config: Config, expected: ExpectedCard): boolean {
  return payment.account_id === expected.accountId && payment.product_id === expected.productId && payment.plan_id === expected.planId
    && payment.checkout_configuration_id === expected.checkoutId && payment.metadata?.integration === expected.integration
    && (expected.integration === 'iunlockmobile-guest-v1' ? payment.metadata?.guest_reference === expected.reference : payment.metadata?.invoice_reference === expected.reference)
    && expected.environment === config.mode
}
async function authoritativeCardClear(config: Config, expected: ExpectedCard, deadline: number): Promise<'clear' | 'payment_present' | 'unresolved'> {
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
    const providerUrl = safeWhopCheckoutUrl(checkout.purchase_url, config.mode)
    if (providerUrl !== expected.storedCheckoutUrl) return 'unresolved'
    if (Date.now() >= deadline) return 'unresolved'
    let page = await client(config).payments.list({ mode: 'account_sales', account_id: config.accountId, plan_id: expected.planId, first: 10 })
    for (let pageNumber = 0; pageNumber < MAX_PROVIDER_PAGES; pageNumber++) {
      if (!Array.isArray(page.data)) return 'unresolved'
      if (page.data.some(payment => !paymentMatches(payment, config, expected))) return 'unresolved'
      if (page.data.length) return 'payment_present'
      if (!page.hasNextPage()) return 'clear'
      if (pageNumber + 1 >= MAX_PROVIDER_PAGES || Date.now() >= deadline) return 'unresolved'
      page = await page.getNextPage()
    }
    return 'unresolved'
  } catch { return 'unresolved' }
}

function cryptoCheck(kind: CheckoutReminderKind, reference: string, userId: number): CryptoCheck | null {
  const row = kind === 'guest'
    ? db().prepare(`SELECT g.reference AS checkout_reference,g.crypto_invoice_reference AS invoice_reference,i.payment_route_id,i.created_at FROM guest_checkouts g JOIN invoices i ON i.reference=g.crypto_invoice_reference
      WHERE g.reference=? AND g.customer_user_id=? AND g.payment_method='crypto'`).get(reference, userId) as { checkout_reference: string; invoice_reference: string; payment_route_id: string | null; created_at: string } | undefined
    : db().prepare(`SELECT i.reference AS checkout_reference,i.reference AS invoice_reference,i.payment_route_id,i.created_at FROM invoices i WHERE i.reference=? AND i.user_id=? AND i.gateway!='whop_card'`).get(reference, userId) as { checkout_reference: string; invoice_reference: string; payment_route_id: string | null; created_at: string } | undefined
  if (!row?.checkout_reference || !row.invoice_reference || !row.payment_route_id) return null
  return { kind, reference: row.checkout_reference, invoiceReference: row.invoice_reference, routeId: row.payment_route_id, createdAt: row.created_at }
}

/**
 * Reminder delivery never invokes the watcher: its scan records unmatched
 * transfers, advances cursors, attaches invoices, and can settle financial
 * state. Use only persisted watcher health/progress and transfer evidence
 * already recorded by the normal payment poll; stale or incomplete evidence
 * fails closed instead of sending a crypto reminder.
 */
async function authoritativeCryptoClear(check: CryptoCheck, userId: number, deadline: number): Promise<'clear' | 'payment_present' | 'unresolved'> {
  try {
    const invoice = db().prepare(`SELECT status,payment_amount_e4,created_at FROM invoices WHERE reference=?`).get(check.invoiceReference) as
      { status: string; payment_amount_e4: number | null; created_at: string } | undefined
    if (Date.now() >= deadline || !invoice || codedInvoiceExpired(invoice)) return 'unresolved'
    const route = paymentRouteConfiguration(check.routeId)
    if (!route?.enabled || !route.providerReady || process.env.IUNLOCKMOBILE_PAYMENT_WATCHER !== '1' || Date.now() >= deadline) return 'unresolved'
    const cursor = db().prepare(`SELECT last_block,last_time_ms,last_scan_at,last_ok_at,last_error,lease_until
      FROM payment_watch_cursors WHERE route_id=?`).get(route.id) as {
        last_block: number | null; last_time_ms: number | null; last_scan_at: string | null; last_ok_at: string | null
        last_error: string | null; lease_until: string | null
      } | undefined
    const createdAt = sqliteTime(check.createdAt)
    const lastScanAt = cursor?.last_scan_at ? sqliteTime(cursor.last_scan_at) : NaN
    const lastOkAt = cursor?.last_ok_at ? sqliteTime(cursor.last_ok_at) : NaN
    const leaseUntil = cursor?.lease_until ? sqliteTime(cursor.lease_until) : 0
    const now = Date.now()
    if (!cursor || cursor.last_error || (cursor.last_block === null && cursor.last_time_ms === null)
      || !Number.isFinite(createdAt) || !Number.isFinite(lastScanAt) || !Number.isFinite(lastOkAt)
      || lastScanAt < createdAt || lastOkAt < createdAt || now - lastOkAt > CRYPTO_WATCHER_FRESH_MS
      || leaseUntil > now) return 'unresolved'
    if (!localPaymentStillOpen(check.kind, check.reference, userId)) return 'payment_present'
    // The watcher may have observed a transfer that could not be attached to
    // this invoice (wrong code, multiple logs, or another request). Such a
    // transfer is still evidence that the unpaid assertion is ambiguous.
    const transfer = db().prepare(`SELECT 1 FROM chain_transfers
      WHERE route_id=? AND status!='dismissed' AND julianday(block_time)>=julianday(?) LIMIT 1`).get(check.routeId, check.createdAt)
    if (transfer) return 'payment_present'
    return 'clear'
  } catch { return 'unresolved' }
}

function markUnresolved(row: QueueRow, reason: string, suppressed = false) {
  db().prepare(`UPDATE checkout_payment_reminders SET unresolved=?,suppressed=?,unresolved_reason=?,lease_token=NULL,lease_until=0,next_attempt_at=0
    WHERE kind=? AND reference=? AND lease_token=?`).run(suppressed ? 0 : 1, suppressed ? 1 : 0, reason, row.kind, row.reference, row.lease_token)
}
function finalSendEligible(row: QueueRow, now: number): boolean {
  if (!checkoutReminderConfigured() || suppressionExists(row.recipient_hash)) return false
  const fresh = db().prepare(`SELECT user_id,recipient_hash,token_hash,opened_at_ms,destination_url,amount_cents FROM checkout_payment_reminders WHERE kind=? AND reference=? AND lease_token=?
    AND send_accepted_at IS NULL AND suppressed=0 AND unresolved=0 AND opened_at_ms IS NOT NULL AND destination_url IS NOT NULL AND amount_cents IS NOT NULL AND due_at<=? AND expires_at>? AND lease_until>?`).get(row.kind, row.reference, row.lease_token, now, now, Date.now()) as
    { user_id: number; recipient_hash: string; token_hash: string; opened_at_ms: number; destination_url: string; amount_cents: number } | undefined
  const email = emailForQueue(row.kind, row.reference)
  return Boolean(fresh && fresh.user_id === row.user_id && validOwner(row.user_id, email) && localPaymentStillOpen(row.kind, row.reference, row.user_id)
    && recipientHash(email) === fresh.recipient_hash && fresh.recipient_hash === row.recipient_hash && sha256(checkoutReminderUnsubscribeToken(email)) === fresh.token_hash
    && fresh.opened_at_ms === row.opened_at_ms && fresh.destination_url === row.destination_url && fresh.amount_cents === row.amount_cents)
}
function claimDue(candidate: Omit<QueueRow, 'lease_token'>, now: number): QueueRow | null {
  const leaseToken = randomBytes(16).toString('hex')
  return db().transaction(() => {
    if (suppressionExists(candidate.recipient_hash)) return null
    if (!db().prepare(`UPDATE checkout_payment_reminders SET lease_token=?,lease_until=?,attempts=attempts+1 WHERE kind=? AND reference=?
      AND send_accepted_at IS NULL AND unresolved=0 AND suppressed=0 AND opened_at_ms IS NOT NULL AND destination_url IS NOT NULL
      AND due_at<=? AND expires_at>? AND next_attempt_at<=? AND lease_until<=?`)
      .run(leaseToken, now + LEASE_MS, candidate.kind, candidate.reference, now, now, now, now).changes) return null
    const row = db().prepare('SELECT kind,reference,user_id,recipient_hash,token_hash,dedupe_hash,lease_token,attempts,idempotency_key,opened_at_ms,destination_url,open_source,amount_cents FROM checkout_payment_reminders WHERE kind=? AND reference=?').get(candidate.kind, candidate.reference) as QueueRow
    if (!finalSendEligible(row, now)) { markUnresolved(row, 'local_payment_or_owner_changed', true); return null }
    return row
  }).immediate()
}

function reminderEmail(row: QueueRow, email: string, title: string, amountCents: number, paymentMethod: 'card' | 'crypto') {
  const destination = row.destination_url
  const unsubscribe = `${validOrigin()}/api/checkout/reminders/unsubscribe?token=${encodeURIComponent(checkoutReminderUnsubscribeToken(email))}`
  const postal = process.env.IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS!.trim()
  const amount = `$${(amountCents / 100).toFixed(2)} USD`
  const pageLabel = paymentMethod === 'card' ? 'secure Whop checkout' : 'secure crypto payment page'
  const text = `iUnlockMobile\n${title}\nReference: ${row.reference}\nPayment amount: ${amount}\n\nYour payment request is still open. Return to the same ${pageLabel} to continue. If you have already paid, check the status instead of paying again.\n\nContinue payment: ${destination}\n\nThis is the single payment reminder for this bill. We will not send another reminder. Questions: support@iunlockmobile.com\nUnsubscribe: ${unsubscribe}\n\niUnlockMobile\n${postal}`
  const html = `<p><strong>${escapeHtml(title)}</strong><br>Reference: ${escapeHtml(row.reference)}<br>Payment amount: ${escapeHtml(amount)}</p><p>Your payment request is still open. Return to the same ${escapeHtml(pageLabel)} to continue. If you have already paid, check the status instead of paying again.</p><p><a href="${escapeHtml(destination)}">Continue payment</a></p><p>This is the single payment reminder for this bill. We will not send another reminder. Questions: <a href="mailto:support@iunlockmobile.com">support@iunlockmobile.com</a></p><p><a href="${escapeHtml(unsubscribe)}">Unsubscribe from payment reminders</a></p><p>iUnlockMobile<br>${escapeHtml(postal)}</p>`
  return { text, html, unsubscribe }
}

async function deliver(row: QueueRow, now: number, deadline: number): Promise<'sent' | 'skip' | 'unresolved'> {
  let paymentMethod: 'card' | 'crypto'
  let title: string
  let amount: number
  let expected: ExpectedCard | null = null
  if (row.kind === 'guest') {
    const current = getGuestCheckout(row.reference)
    if (!current) { markUnresolved(row, 'bill_missing', true); return 'skip' }
    paymentMethod = current.payment_method
    amount = guestCheckoutTotal(current)
    title = current.product_name
    if (paymentMethod === 'card') {
      if (!current.checkout_id || !current.plan_id || !current.checkout_url) { markUnresolved(row, 'checkout_missing'); return 'unresolved' }
      expected = { reference: current.reference, accountId: current.account_id, productId: current.product_id, environment: current.environment,
        checkoutId: current.checkout_id, planId: current.plan_id, integration: 'iunlockmobile-guest-v1', amountCents: amount, storedCheckoutUrl: current.checkout_url }
    }
  } else {
    const current = db().prepare(`SELECT i.reference,i.gateway,i.total_due_cents,i.credit_amount_cents,i.fee_cents,i.payment_route_id,i.created_at,w.account_id,w.product_id,w.environment,w.checkout_id,w.plan_id,w.checkout_url
      FROM invoices i LEFT JOIN whop_topups w ON w.invoice_reference=i.reference WHERE i.reference=? AND i.user_id=? AND (w.user_id=? OR w.user_id IS NULL)`).get(row.reference, row.user_id, row.user_id) as
      { reference: string; gateway: string; total_due_cents: number; credit_amount_cents: number; fee_cents: number; payment_route_id: string | null; created_at: string; account_id: string | null; product_id: string | null; environment: string | null; checkout_id: string | null; plan_id: string | null; checkout_url: string | null } | undefined
    if (!current) { markUnresolved(row, 'bill_missing', true); return 'skip' }
    paymentMethod = current.gateway === 'whop_card' ? 'card' : 'crypto'
    amount = current.total_due_cents
    title = paymentMethod === 'card' ? 'Account credit top-up' : 'Account crypto payment'
    if (paymentMethod === 'card') {
      if (!current.account_id || !current.product_id || !current.environment || !current.checkout_id || !current.plan_id || !current.checkout_url) { markUnresolved(row, 'checkout_missing'); return 'unresolved' }
      expected = { reference: current.reference, accountId: current.account_id, productId: current.product_id, environment: current.environment,
        checkoutId: current.checkout_id, planId: current.plan_id, integration: 'iunlockmobile-credit-v1', amountCents: current.credit_amount_cents + current.fee_cents, storedCheckoutUrl: current.checkout_url }
    }
  }
  const currentDestination = destinationFor(row.kind, row.reference, row.user_id)
  const currentAmount = amountFor(row.kind, row.reference, row.user_id)
  if (!currentDestination || currentDestination !== row.destination_url || currentAmount === null || currentAmount !== row.amount_cents) { markUnresolved(row, 'payment_page_changed_or_expired_or_repriced'); return 'unresolved' }
  if (!finalSendEligible(row, Math.max(now, Date.now()))) { markUnresolved(row, 'final_payment_owner_or_suppression_changed', true); return 'skip' }
  if (expected) {
    const config = whopConfiguration()
    if (!config || !whopCheckoutEnabled() || expected.accountId !== config.accountId || expected.productId !== config.productId || expected.environment !== config.mode) { markUnresolved(row, 'checkout_configuration_mismatch'); return 'unresolved' }
    const verification = await authoritativeCardClear(config, expected, deadline)
    if (verification !== 'clear') { markUnresolved(row, verification === 'payment_present' ? 'provider_payment_present' : 'provider_read_failed_or_ambiguous', verification === 'payment_present'); return verification === 'payment_present' ? 'skip' : 'unresolved' }
  } else {
    const check = cryptoCheck(row.kind, row.reference, row.user_id)
    if (!check) { markUnresolved(row, 'crypto_invoice_unavailable'); return 'unresolved' }
    const verification = await authoritativeCryptoClear(check, row.user_id, deadline)
    if (verification !== 'clear') { markUnresolved(row, verification === 'payment_present' ? 'crypto_payment_present' : 'crypto_chain_read_failed_or_ambiguous', verification === 'payment_present'); return verification === 'payment_present' ? 'skip' : 'unresolved' }
  }
  // Re-read owner, suppression, local payment, page and exact lease after every asynchronous read.
  if (!finalSendEligible(row, Math.max(now, Date.now()))) { markUnresolved(row, 'final_payment_owner_or_suppression_changed', true); return 'skip' }
  const email = emailForQueue(row.kind, row.reference)
  const mail = reminderEmail(row, email, title, amount, paymentMethod)
  try {
    const receipt = await sendMarketingEmail(email, 'Your iUnlockMobile payment is waiting', mail.html, mail.text, {
      idempotencyKey: row.idempotency_key,
      unsubscribeUrl: mail.unsubscribe,
      replyTo: 'support@iunlockmobile.com',
    })
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
  const rows = db().prepare(`SELECT kind,reference,user_id,recipient_hash,token_hash,dedupe_hash,attempts,idempotency_key,opened_at_ms,destination_url,open_source,amount_cents
    FROM checkout_payment_reminders WHERE send_accepted_at IS NULL AND unresolved=0 AND suppressed=0 AND opened_at_ms IS NOT NULL AND destination_url IS NOT NULL AND amount_cents IS NOT NULL
      AND due_at<=? AND expires_at>? AND next_attempt_at<=? AND lease_until<=? ORDER BY due_at LIMIT ?`)
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

/** Retained for diagnostics: crypto sends require the existing authoritative watcher. */
export function cryptoReminderSkipReason(): 'requires_authoritative_crypto_verification' { return 'requires_authoritative_crypto_verification' }
