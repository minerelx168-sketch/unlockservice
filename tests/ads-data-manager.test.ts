import assert from 'node:assert/strict'
import test, { after, before, beforeEach } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'ads-sender-'))
process.env.IUNLOCKMOBILE_DB = join(dir, 'test.db')
let db: typeof import('../lib/db')['db']
let stageAdsPurchase: typeof import('../lib/ads-conversion-outbox')['stageAdsPurchase']
let revokeCheckoutContext: typeof import('../lib/ga4')['revokeCheckoutContext']
let deliverAdsConversions: typeof import('../lib/ads-data-manager')['deliverAdsConversions']
let reconcileAdsConversions: typeof import('../lib/ads-data-manager')['reconcileAdsConversions']
before(async () => {
  ;({ db } = await import('../lib/db'))
  ;({ stageAdsPurchase } = await import('../lib/ads-conversion-outbox'))
  ;({ revokeCheckoutContext } = await import('../lib/ga4'))
  ;({ deliverAdsConversions, reconcileAdsConversions } = await import('../lib/ads-data-manager'))
})
let sequence = 0
let payloads: Record<string, unknown>[] = []
const transport = {
  token: async () => 'test-token',
  fetch: (async (_url, init) => {
    payloads.push(JSON.parse(String(init?.body)))
    return Response.json({ requestId: 'request-test' })
  }) as typeof fetch
}
beforeEach(() => {
  db().prepare('DELETE FROM ads_conversion_delivery').run()
  db().prepare('DELETE FROM ads_conversion_outbox').run()
  payloads = []
  Object.assign(process.env, {
    ADS_DATA_MANAGER_MODE: 'live', ADS_DATA_MANAGER_ACCOUNT_ID: '2980233695',
    ADS_DATA_MANAGER_CONVERSION_ID: '7892563655', ADS_DATA_MANAGER_PROJECT_ID: 'iunlockmobile-data-manager',
    ADS_DATA_MANAGER_START_AT: new Date(Date.now() - 86400000).toISOString(), IUNLOCKMOBILE_PUBLIC_ORIGIN: 'https://iunlockmobile.com'
  })
})
after(() => rmSync(dir, { recursive: true, force: true }))
function fixture() {
  const key = 'ads-test-' + ++sequence
  const user = Number(db().prepare("INSERT INTO users(username,email,password_hash,account_type) VALUES(?,?,'unused','customer')").run(key, key + '@example.test').lastInsertRowid)
  const id = Number(db().prepare(`INSERT INTO orders(user_id,kind,imei,delivery_email,status,delivery,price_cents,eta_hours,idempotency_key)
    VALUES(?,'carrier_unlock','test','test@example.test','delivered','remote',800,1,?)`).run(user, key).lastInsertRowid)
  db().prepare("INSERT INTO invoices(reference,user_id,gateway,credit_amount_cents,total_due_cents,status) VALUES(?,?,'bsc_usdt',1000,1000,'success')").run(key, user)
  db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,1000,'topup','invoice',?,1000)").run(user, key)
  db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,-800,'charge','order',?,200)").run(user, String(id))
  db().prepare("INSERT INTO ga4_checkout_context(kind,reference,user_id,consent,gclid) VALUES('order',?,?,'granted','real-fixture-click')").run(key, user)
  const paidAt = (db().prepare("SELECT created_at FROM credit_ledger WHERE user_id=? AND type='charge'").get(user) as { created_at: string }).created_at
  const transactionId = 'unlock-' + id
  stageAdsPurchase({ transactionId, eventName: 'purchase', kind: 'order', paidAt, contextReference: key }, { events: [{ name: 'purchase', params: { value: 8, currency: 'USD', gross_margin: 6 } }] })
  return { key, user, id, transactionId }
}
function delivery(id: string) { return db().prepare('SELECT * FROM ads_conversion_delivery WHERE transaction_id=?').get(id) as { state: string; reason: string; needs_review: string; destination: string } }
function refund(row: ReturnType<typeof fixture>) {
  db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,800,'refund','order',?,1000)").run(row.user, String(row.id))
}

test('concurrent workers upload once, with stable ID, charged revenue and only allowlisted data', async () => {
  const row = fixture()
  await Promise.all([deliverAdsConversions(10, transport), deliverAdsConversions(10, transport)])
  assert.equal(payloads.length, 1)
  const body = payloads[0] as { validateOnly: boolean; events: { transactionId: string; conversionValue: number }[] }
  assert.equal(body.validateOnly, false)
  assert.equal(body.events[0].transactionId, row.transactionId)
  assert.equal(body.events[0].conversionValue, 8)
  assert.ok(!JSON.stringify(body).includes('@example.test'))
  assert.ok(!JSON.stringify(body).includes('gross_margin'))
  assert.equal(delivery(row.transactionId).state, 'accepted')
  await deliverAdsConversions(10, transport)
  assert.equal(payloads.length, 1)
})

test('refund, unknown consent, owner mismatch, review, changed amount and non-live supplier block export', async () => {
  const refunded = fixture(); refund(refunded)
  const denied = fixture(); db().prepare("UPDATE ga4_checkout_context SET consent='unknown' WHERE reference=?").run(denied.key)
  const wrongOwner = fixture(); db().prepare('UPDATE ga4_checkout_context SET user_id=? WHERE reference=?').run(refunded.user, wrongOwner.key)
  const review = fixture(); db().prepare("UPDATE orders SET status='manual_review' WHERE id=?").run(review.id)
  const amount = fixture(); db().prepare('UPDATE orders SET price_cents=900 WHERE id=?').run(amount.id)
  const mock = fixture(); db().prepare("UPDATE orders SET provider_mode='mock' WHERE id=?").run(mock.id)
  const result = await deliverAdsConversions(10, transport)
  assert.equal(result.suppressed, 6); assert.equal(payloads.length, 0)
})

test('withdrawal while obtaining token is re-read before any upload', async () => {
  const row = fixture()
  await deliverAdsConversions(10, { ...transport, token: async () => { revokeCheckoutContext(row.user); return 'test-token' } })
  assert.equal(payloads.length, 0)
})

test('validated data is not marked sent; consent and refund are rechecked for live promotion', async () => {
  const row = fixture()
  process.env.ADS_DATA_MANAGER_MODE = 'validate'
  assert.equal((await deliverAdsConversions(10, transport)).validated, 1)
  assert.equal(payloads[0].validateOnly, true)
  assert.equal(delivery(row.transactionId).state, 'validated')
  refund(row)
  process.env.ADS_DATA_MANAGER_MODE = 'live'
  assert.equal((await deliverAdsConversions(10, transport)).suppressed, 1)
  assert.equal(payloads.length, 1)
})

test('transport uncertainty and expired sending lease never auto-replay', async () => {
  const row = fixture()
  assert.equal((await deliverAdsConversions(10, { ...transport, fetch: async () => { throw new Error('timeout') } })).uncertain, 1)
  await deliverAdsConversions(10, transport)
  assert.equal(payloads.length, 0)
  db().prepare("UPDATE ads_conversion_delivery SET state='sending',lease_until=1 WHERE transaction_id=?").run(row.transactionId)
  await deliverAdsConversions(10, transport)
  assert.equal(delivery(row.transactionId).state, 'uncertain')
  assert.equal(payloads.length, 0)
})

test('explicit rate limit retries with backoff; retry rechecks a subsequent refund', async () => {
  const row = fixture()
  assert.equal((await deliverAdsConversions(10, { ...transport, fetch: async () => Response.json({ error: { status: 'RESOURCE_EXHAUSTED' } }, { status: 429 }) })).retry, 1)
  await deliverAdsConversions(10, transport); assert.equal(payloads.length, 0)
  refund(row)
  db().prepare('UPDATE ads_conversion_delivery SET next_at=0').run()
  assert.equal((await deliverAdsConversions(10, transport)).suppressed, 1)
})

test('Google acceptance is reconciled, and a later refund is flagged for adjustment review', async () => {
  const row = fixture(); await deliverAdsConversions(10, transport)
  const statusTransport = { ...transport, fetch: (async () => Response.json({ requestStatusPerDestination: [{
    destination: { operatingAccount: { accountId: '2980233695' }, productDestinationId: '7892563655' }, requestStatus: 'SUCCESS'
  }] })) as typeof fetch }
  assert.equal((await reconcileAdsConversions(20, statusTransport)).delivered, 1)
  assert.equal(delivery(row.transactionId).state, 'delivered')
  refund(row); db().prepare('UPDATE ads_conversion_delivery SET checked_at=0').run()
  assert.equal((await reconcileAdsConversions(20, statusTransport)).needsReview, 1)
  assert.equal(delivery(row.transactionId).needs_review, 'refunded')
  assert.equal(payloads.length, 1)
})

test('processing failure persists sanitized diagnostics and does not reupload', async () => {
  const row = fixture(); await deliverAdsConversions(10, transport)
  await reconcileAdsConversions(20, { ...transport, fetch: async () => Response.json({ requestStatusPerDestination: [{
    destination: { operatingAccount: { accountId: '2980233695' }, productDestinationId: '7892563655' }, requestStatus: 'FAILED',
    errorInfo: { errorCounts: [{ reason: 'PROCESSING_ERROR_REASON_INVALID_GCLID' }] }
  }] }) })
  assert.equal(delivery(row.transactionId).state, 'rejected')
  assert.match(delivery(row.transactionId).reason, /INVALID_GCLID/)
  await deliverAdsConversions(10, transport); assert.equal(payloads.length, 1)
})

test('rollout cutoff blocks old rows; missing config makes no authentication or API calls', async () => {
  fixture(); process.env.ADS_DATA_MANAGER_START_AT = new Date(Date.now() + 86400000).toISOString()
  assert.equal((await deliverAdsConversions(10, transport)).suppressed, 1)
  delete process.env.ADS_DATA_MANAGER_ACCOUNT_ID
  const result = await deliverAdsConversions(10, { ...transport, token: async () => { throw new Error('must not authenticate') } })
  assert.equal(result.disabled, true)
  assert.equal(result.authFailed, false)
})

test('destination changes cannot resend a previously accepted transaction', async () => {
  fixture(); await deliverAdsConversions(10, transport)
  process.env.ADS_DATA_MANAGER_CONVERSION_ID = '9999999999'
  await deliverAdsConversions(10, transport)
  assert.equal(payloads.length, 1)
})

test('guest payment is checked against completed report, real charge and refunds', async () => {
  const source = fixture()
  db().prepare('DELETE FROM ads_conversion_outbox').run()
  db().prepare("INSERT OR IGNORE INTO paid_report_products(code,slug,name,summary,price_cents) VALUES('ADS_TEST','ads-test','Test','Test',800)").run()
  const report = Number(db().prepare(`INSERT INTO paid_report_orders(user_id,product_code,product_name,imei_fingerprint,masked_imei,status,price_cents)
    VALUES(?,'ADS_TEST','Test','test','test','completed',800)`).run(source.user).lastInsertRowid)
  db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,-800,'charge','paid_imei_report',?,0)").run(source.user, String(report))
  const reference = 'guest-' + source.key
  db().prepare(`INSERT INTO guest_checkouts(reference,request_key,email,product_code,product_name,imei_encrypted,price_cents,fee_cents,
    account_id,product_id,environment,payment_id,state,user_id,report_id,paid_at)
    VALUES(?,?,'test@example.test','ADS_TEST','Test','test',800,0,'test','test','live','payment-test','completed',?,?,datetime('now'))`)
    .run(reference, reference, source.user, report)
  db().prepare("INSERT INTO ga4_checkout_context(kind,reference,consent,gclid) VALUES('guest',?,'granted','guest-fixture-click')").run(reference)
  const paidAt = (db().prepare('SELECT paid_at FROM guest_checkouts WHERE reference=?').get(reference) as { paid_at: string }).paid_at
  stageAdsPurchase({ transactionId: 'guest-' + reference, eventName: 'purchase', kind: 'guest', paidAt, contextReference: reference }, { events: [{ name: 'purchase', params: { value: 8, currency: 'USD' } }] })
  process.env.ADS_DATA_MANAGER_MODE = 'validate'
  assert.equal((await deliverAdsConversions(10, transport)).validated, 1)
  db().prepare("UPDATE guest_checkouts SET review_reason='dispute' WHERE reference=?").run(reference)
  process.env.ADS_DATA_MANAGER_MODE = 'live'
  assert.equal((await deliverAdsConversions(10, transport)).suppressed, 1)
})

test('OCI staging works with GA4 disabled, and does not stage top-ups or unpaid orders', async () => {
  const row = fixture()
  db().prepare('DELETE FROM ads_conversion_outbox').run()
  process.env.GA4_SERVER_PAYMENTS_ENABLED = '0'
  delete process.env.GA4_MP_API_SECRET
  const { stageCompletedAdsPurchases } = await import('../lib/ads-purchase-staging')
  // Other test fixtures remain in this DB; this one must be included exactly once.
  stageCompletedAdsPurchases(Date.now() - 86400000, 500)
  assert.ok(db().prepare('SELECT 1 FROM ads_conversion_outbox WHERE transaction_id=?').get(row.transactionId))
  const first = (db().prepare('SELECT count(*) AS n FROM ads_conversion_outbox').get() as {n:number}).n
  stageCompletedAdsPurchases(Date.now() - 86400000, 500)
  assert.equal((db().prepare('SELECT count(*) AS n FROM ads_conversion_outbox').get() as {n:number}).n, first)
  assert.equal(db().prepare("SELECT 1 FROM ads_conversion_outbox WHERE kind='topup'").get(), undefined)
  const unpaid = fixture()
  db().prepare('DELETE FROM ads_conversion_outbox WHERE transaction_id=?').run(unpaid.transactionId)
  db().prepare("UPDATE orders SET status='processing' WHERE id=?").run(unpaid.id)
  stageCompletedAdsPurchases(Date.now() - 86400000, 500)
  assert.equal(db().prepare('SELECT 1 FROM ads_conversion_outbox WHERE transaction_id=?').get(unpaid.transactionId), undefined)
})
