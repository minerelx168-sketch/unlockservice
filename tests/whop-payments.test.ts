import assert from 'node:assert/strict'
import { createHmac, randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before, beforeEach } from 'node:test'

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-whop-'))
process.env.IUNLOCKMOBILE_DB = join(workDir, 'whop.db')
process.env.IUNLOCKMOBILE_WHOP_ENABLED = '1'
process.env.WHOP_MODE = 'live'
process.env.WHOP_ACCOUNT_ID = 'biz_test'
process.env.WHOP_PRODUCT_ID = 'prod_test'
process.env.WHOP_API_KEY = 'test-only-api-key'
process.env.WHOP_WEBHOOK_SECRET = 'ws_test_only_literal_secret'
process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN = 'https://iunlockmobile.com'

let database: typeof import('../lib/db')
let credits: typeof import('../lib/credits')
let whop: typeof import('../lib/whop')
type Topup = import('../lib/whop').WhopTopup
const originalFetch = globalThis.fetch
const remotePayments = new Map<string, Record<string, unknown>>()
const checkoutCalls: { key: string; body: Record<string, unknown> }[] = []
let checkoutError = false
let counter = 0

before(async () => {
  database = await import('../lib/db')
  credits = await import('../lib/credits')
  whop = await import('../lib/whop')
  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    assert.equal(url.origin, 'https://api.whop.com')
    const headers = new Headers(init?.headers)
    assert.equal(headers.get('authorization'), 'Bearer test-only-api-key')
    assert.equal(headers.get('api-version-date'), whop.WHOP_API_VERSION)
    if (url.pathname === '/api/v1/checkout_configurations' && init?.method === 'POST') {
      const body = JSON.parse(String(init.body))
      const key = headers.get('idempotency-key')!
      checkoutCalls.push({ key, body })
      if (checkoutError) return Response.json({ message: 'Test unavailable' }, { status: 503 })
      const suffix = key.replace('whop-topup-', '')
      return Response.json({ id: `ch_${suffix}`, account_id: 'biz_test',
        purchase_url: `https://whop.com/checkout/plan_${suffix}/`,
        plan: { ...body.plan, id: `plan_${suffix}` } })
    }
    const payment = remotePayments.get(url.pathname.split('/').at(-1)!)
    assert.equal(init?.method, 'GET')
    assert.ok(url.pathname.startsWith('/api/v1/payments/'))
    return payment ? Response.json(payment) : Response.json({ message: 'Test missing' }, { status: 404 })
  }
})
beforeEach(() => {
  database.db().exec('DELETE FROM whop_webhook_events')
  checkoutError = false
  checkoutCalls.length = 0
  process.env.IUNLOCKMOBILE_WHOP_ENABLED = '1'
})
after(() => {
  globalThis.fetch = originalFetch
  database.db().close()
  rmSync(workDir, { recursive: true, force: true })
})

function customer() {
  const name = `whop${++counter}`
  return Number(database.db().prepare(`INSERT INTO users (username, email, password_hash, email_verified_at)
    VALUES (?, ?, 'test-not-a-password', datetime('now'))`).run(name, `${name}@example.test`).lastInsertRowid)
}
const money = (amount: string) => ({ amount, currency: 'usd', decimals: 2 })
function payment(topup: Topup, overrides: Record<string, unknown> = {}): Record<string, unknown> & { id: string } {
  return { id: `pay_${++counter}`, account_id: 'biz_test', product_id: 'prod_test', plan_id: topup.plan_id,
    checkout_configuration_id: topup.checkout_id, currency: 'usd',
    metadata: { invoice_reference: topup.invoice_reference, integration: 'iunlockmobile-credit-v1' },
    status: 'paid', substatus: 'succeeded', subtotal: money('10.00'), total: money('10.00'),
    tax_amount: null, tax_refunded_amount: null, tax_behavior: null, refunded_amount: money('0.00'),
    payment_method_type: 'card', billing_reason: 'one_time', promo_code_id: null, dispute_alerted_at: null,
    paid_at: '2026-10-17T00:00:00Z', updated_at: '2026-10-17T00:00:00Z', ...overrides }
}
function signed(type: string, data: unknown, extra: Record<string, unknown> = {}, timestamp = Math.floor(Date.now() / 1000)) {
  const id = `evt_${++counter}`
  const raw = JSON.stringify({ id, account_id: 'biz_test', api_version: 'v1', api_version_date: whop.WHOP_API_VERSION, type, data, ...extra })
  const sig = createHmac('sha256', process.env.WHOP_WEBHOOK_SECRET!).update(`${id}.${timestamp}.${raw}`).digest('base64')
  return { raw, headers: { 'webhook-id': id, 'webhook-timestamp': String(timestamp), 'webhook-signature': `v1,${sig}` } }
}
function queue(p: ReturnType<typeof payment>, type = 'payment.succeeded') {
  remotePayments.set(p.id, p)
  const event = signed(type, type.startsWith('payment.') ? { id: p.id } : { payment: { id: p.id } })
  assert.equal(whop.enqueueWhopEvent(event.raw, event.headers), 'queued')
  return event
}
async function settle(p: ReturnType<typeof payment>, type = 'payment.succeeded') {
  queue(p, type)
  assert.deepEqual(await whop.processWhopEvents(), { processed: 1, errors: 0 })
}
async function topup() {
  return whop.createWhopCheckout(customer(), 1000, randomUUID())
}

test('checkout is server-priced, card-only, one-time, owner scoped and idempotent', async () => {
  const userId = customer()
  const key = randomUUID()
  const first = await whop.createWhopCheckout(userId, 1000, key)
  assert.equal((await whop.createWhopCheckout(userId, 1000, key)).checkout_id, first.checkout_id)
  assert.equal(checkoutCalls.length, 1)
  assert.equal(whop.getWhopTopup(first.invoice_reference, customer()), undefined)
  assert.equal(credits.getBalance(userId).creditCents, 0)
  const legacyPayments = await import('../lib/payments')
  assert.throws(() => legacyPayments.approveInvoice(first.invoice_reference, userId), /verified with Whop/)
  const body = checkoutCalls[0].body
  const plan = body.plan as Record<string, unknown>
  assert.equal(plan.initial_price, 10)
  assert.equal(plan.plan_type, 'one_time')
  assert.ok(String(plan.title).length <= 30)
  assert.equal(plan.stock, 1)
  assert.equal(plan.three_ds_level, 'mandate_challenge')
  assert.deepEqual(body.payment_method_configuration, { enabled: ['card'], disabled: [], include_platform_defaults: false })
  assert.match(String(plan.description), /iunlockmobile.com.*carrier unlocking.*iCloud.*MDM.*FRP/)
  assert.equal(body.redirect_url, `https://iunlockmobile.com/user/invoice/${first.invoice_reference}`)
  await assert.rejects(whop.createWhopCheckout(userId, 2000, key), /different payment/)
  await assert.rejects(whop.createWhopCheckout(userId, 99, randomUUID()), /amount/)
  await assert.rejects(whop.createWhopCheckout(userId, 100001, randomUUID()), /amount/)
  await assert.rejects(whop.createWhopCheckout(userId, 100.5, randomUUID()), /amount/)
  assert.throws(() => whop.safeWhopCheckoutUrl('https://whop.com.evil.test/checkout', 'live'))
})

test('a network retry reuses the invoice and the provider idempotency key', async () => {
  const userId = customer()
  const key = randomUUID()
  checkoutError = true
  await assert.rejects(whop.createWhopCheckout(userId, 1000, key))
  checkoutError = false
  await whop.createWhopCheckout(userId, 1000, key)
  assert.equal(checkoutCalls.length, 2)
  assert.equal(checkoutCalls[0].key, checkoutCalls[1].key)
  assert.deepEqual(checkoutCalls[0].body, checkoutCalls[1].body)
  assert.equal((database.db().prepare('SELECT COUNT(*) AS n FROM invoices WHERE user_id = ?').get(userId) as {n:number}).n, 1)
})

test('invalid signatures, replay, wrong accounts and versions never enter the inbox', () => {
  const event = signed('payment.succeeded', { id: 'pay_test' })
  assert.throws(() => whop.enqueueWhopEvent(`${event.raw} `, event.headers))
  assert.throws(() => whop.enqueueWhopEvent(event.raw, { ...event.headers, 'webhook-signature': 'v1,invalid' }))
  for (const bad of [signed('payment.succeeded', { id: 'pay_test' }, {}, Math.floor(Date.now() / 1000) - 400),
    signed('payment.succeeded', { id: 'pay_test' }, { account_id: 'biz_other' }),
    signed('payment.succeeded', { id: 'pay_test' }, { api_version_date: '2020-01-01' }),
    signed('payment.succeeded', { id: 'pay_test' }, { api_version: 'v5' }),
    signed('payment.succeeded', { id: 'pay_test' }, { api_version_date: null, company_id: 'biz_other' }),
    signed('payment.succeeded', { id: 'pay_test' }, { api_version_date: null }),
    signed('payment.succeeded', { id: 'pay_test' }, { api_version_date: null, company_id: 'biz_test', account_id: 'biz_other' })]) {
    assert.throws(() => whop.enqueueWhopEvent(bad.raw, bad.headers))
  }
  assert.equal((database.db().prepare('SELECT COUNT(*) AS n FROM whop_webhook_events').get() as {n:number}).n, 0)
})

test('dashboard v1 envelopes only supply IDs; authoritative retrieval decides credit', async () => {
  for (const date of [null, undefined]) {
    const row = await topup()
    const p = payment(row)
    remotePayments.set(p.id, p)
    const event = signed('payment.succeeded', { id: p.id, total: money('999.00'), status: 'failed' },
      { account_id: undefined, company_id: 'biz_test', api_version_date: date })
    assert.equal(whop.enqueueWhopEvent(event.raw, event.headers), 'queued')
    assert.equal(credits.getBalance(row.user_id).creditCents, 0)
    assert.deepEqual(await whop.processWhopEvents(), { processed: 1, errors: 0 })
    assert.equal(credits.getBalance(row.user_id).creditCents, 1000)
  }
})

test('duplicate and concurrent deliveries credit a verified payment exactly once', async () => {
  const row = await topup()
  const p = payment(row)
  const event = queue(p)
  assert.equal(whop.enqueueWhopEvent(event.raw, event.headers), 'duplicate')
  queue(p)
  await Promise.all([whop.processWhopEvents(), whop.processWhopEvents()])
  assert.equal(credits.getBalance(row.user_id).creditCents, 1000)
  assert.equal((database.db().prepare("SELECT COUNT(*) AS n FROM credit_ledger WHERE ref_type = 'invoice' AND ref_id = ?").get(row.invoice_reference) as {n:number}).n, 1)
  assert.equal(whop.getWhopTopup(row.invoice_reference, row.user_id)?.status, 'success')
})

test('a declined attempt without amounts does not block a successful retry', async () => {
  const row = await topup()
  const failed = payment(row, { status: 'open', substatus: 'failed', total: null, subtotal: null, paid_at: null, payment_method_type: null })
  await settle(failed, 'payment.failed')
  assert.equal(whop.getWhopTopup(row.invoice_reference, row.user_id)?.payment_id, null)
  assert.equal(whop.getWhopTopup(row.invoice_reference, row.user_id)?.review_reason, null)
  const paid = payment(row)
  await settle(paid)
  await settle(failed, 'payment.failed')
  assert.equal(credits.getBalance(row.user_id).creditCents, 1000)
  assert.equal(whop.getWhopTopup(row.invoice_reference, row.user_id)?.status, 'success')
})

test('wrong amount or method cannot mint credit; foreign account and checkout stay unfulfilled', async () => {
  for (const overrides of [{ total: money('9.00') }, { payment_method_type: 'crypto' }, { promo_code_id: 'promo_test' }]) {
    const row = await topup()
    await settle(payment(row, overrides))
    assert.equal(credits.getBalance(row.user_id).creditCents, 0)
    assert.equal(whop.getWhopTopup(row.invoice_reference, row.user_id)?.status, 'review')
  }
  for (const overrides of [{ account_id: 'biz_other' }, { checkout_configuration_id: 'ch_other' }]) {
    const row = await topup()
    queue(payment(row, overrides))
    assert.deepEqual(await whop.processWhopEvents(), { processed: 0, errors: 1 })
    assert.equal(credits.getBalance(row.user_id).creditCents, 0)
  }
})

test('partial refunds reverse service principal once and exclude refunded tax', async () => {
  const row = await topup()
  const p = payment(row, { total: money('10.70'), tax_amount: money('0.70'), tax_behavior: 'exclusive' })
  await settle(p)
  const partial = { ...p, substatus: 'partially_refunded', refunded_amount: money('5.35'), tax_refunded_amount: money('0.35'), updated_at: '2026-10-17T01:00:00Z' }
  await settle(partial, 'refund.updated')
  await settle(partial, 'refund.updated')
  assert.equal(credits.getBalance(row.user_id).creditCents, 500)
  // An older successful response cannot restore the removed credit.
  await settle(p)
  assert.equal(credits.getBalance(row.user_id).creditCents, 500)
  await settle({ ...partial, substatus: 'refunded', refunded_amount: money('10.70'), tax_refunded_amount: money('0.70'), updated_at: '2026-10-17T02:00:00Z' }, 'refund.updated')
  assert.equal(credits.getBalance(row.user_id).creditCents, 0)
  assert.equal(whop.getWhopTopup(row.invoice_reference, row.user_id)?.status, 'refunded')
})

test('a refund arriving before success never creates spendable credit', async () => {
  const row = await topup()
  await settle(payment(row, { substatus: 'refunded', refunded_amount: money('10.00') }), 'refund.created')
  assert.equal(credits.getBalance(row.user_id).creditCents, 0)
  assert.equal(whop.getWhopTopup(row.invoice_reference, row.user_id)?.credited, 0)
})

test('refund shortfalls preserve order holds, pause new spending and reconcile after release', async () => {
  const row = await topup()
  const p = payment(row)
  await settle(p)
  credits.hold(row.user_id, 700, 'test-order', row.invoice_reference)
  const refunded = { ...p, substatus: 'refunded', refunded_amount: money('10.00'), updated_at: '2026-10-17T01:00:00Z' }
  await settle(refunded, 'refund.updated')
  assert.deepEqual(credits.getBalance(row.user_id), { creditCents: 700, heldCents: 700, availableCents: 0 })
  assert.equal(whop.getWhopTopup(row.invoice_reference, row.user_id)?.reversal_due_cents, 700)
  assert.throws(() => credits.hold(row.user_id, 1, 'test-order', 'blocked'), credits.CreditPaymentReview)
  credits.refund(row.user_id, 700, 'test-order', row.invoice_reference)
  database.db().prepare("UPDATE whop_topups SET last_checked_at = datetime('now', '-1 hour') WHERE invoice_reference = ?").run(row.invoice_reference)
  assert.deepEqual(await whop.reconcileWhopPayments(), { checked: 1, errors: 0 })
  assert.equal(credits.getBalance(row.user_id).creditCents, 0)
  assert.equal(whop.getWhopTopup(row.invoice_reference, row.user_id)?.review_reason, null)
})

test('disputes block spending, and a verified win restores ordering without another top-up', async () => {
  const row = await topup()
  const p = payment(row)
  await settle(p)
  await settle({ ...p, substatus: 'dispute_needs_response', updated_at: '2026-10-17T01:00:00Z' }, 'dispute.created')
  assert.throws(() => credits.hold(row.user_id, 100, 'test', 'disputed'), credits.CreditPaymentReview)
  await settle({ ...p, substatus: 'dispute_won', updated_at: '2026-10-17T02:00:00Z' }, 'dispute.updated')
  assert.equal(credits.getBalance(row.user_id).creditCents, 1000)
  assert.doesNotThrow(() => credits.hold(row.user_id, 100, 'test', 'won'))
})

test('a second settled payment is flagged without doubling credit', async () => {
  const row = await topup()
  await settle(payment(row))
  await settle(payment(row))
  assert.equal(credits.getBalance(row.user_id).creditCents, 1000)
  assert.equal(whop.getWhopTopup(row.invoice_reference, row.user_id)?.review_reason, 'multiple_payments')
})

test('a settlement database failure rolls back credit and is retried durably', async () => {
  const row = await topup()
  queue(payment(row))
  database.db().exec("CREATE TEMP TRIGGER fail_whop_invoice BEFORE UPDATE ON invoices BEGIN SELECT RAISE(ABORT, 'test failure'); END")
  try {
    assert.deepEqual(await whop.processWhopEvents(), { processed: 0, errors: 1 })
    assert.equal(credits.getBalance(row.user_id).creditCents, 0)
  } finally { database.db().exec('DROP TRIGGER fail_whop_invoice') }
  database.db().exec('UPDATE whop_webhook_events SET next_attempt_at = NULL')
  assert.deepEqual(await whop.processWhopEvents(), { processed: 1, errors: 0 })
  assert.equal(credits.getBalance(row.user_id).creditCents, 1000)
})

test('disabling new checkout still processes refunds for existing payments', async () => {
  const row = await topup()
  const p = payment(row)
  await settle(p)
  process.env.IUNLOCKMOBILE_WHOP_ENABLED = '0'
  await assert.rejects(topup(), /not available/)
  await settle({ ...p, substatus: 'refunded', refunded_amount: money('10.00'), updated_at: '2026-10-17T01:00:00Z' }, 'refund.updated')
  assert.equal(credits.getBalance(row.user_id).creditCents, 0)
  assert.equal(credits.creditIntegrity().mismatches, 0)
  assert.equal(credits.creditIntegrity().invalidHolds, 0)
})
