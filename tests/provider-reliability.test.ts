import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-reliability-'))
process.env.IUNLOCKMOBILE_DB = join(workDir, 'reliability.db')
process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'dhru'
process.env.IUNLOCKMOBILE_PROVIDER_URL = 'https://provider.example.test/api'
process.env.IUNLOCKMOBILE_PROVIDER_API_KEY = 'test-only-key'
process.env.IUNLOCKMOBILE_PROVIDER_USERNAME = 'test-user'
process.env.IUNLOCKMOBILE_MAINTENANCE = '0'
process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP = JSON.stringify({ 'carrier:103': { id: '901', mode: 'dhru' } })
process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({ 'check:basic': { id: '900', mode: 'dhru' } })

let database: typeof import('../lib/db')
let credits: typeof import('../lib/credits')
let orders: typeof import('../lib/orders')
let checks: typeof import('../lib/imei-checks')
let reports: typeof import('../lib/paid-reports')
let leases: typeof import('../lib/provider-poll-lease')
let catalog: typeof import('../lib/public-provider-catalog')
const originalFetch = globalThis.fetch

before(async () => {
  database = await import('../lib/db')
  credits = await import('../lib/credits')
  orders = await import('../lib/orders')
  checks = await import('../lib/imei-checks')
  reports = await import('../lib/paid-reports')
  leases = await import('../lib/provider-poll-lease')
  catalog = await import('../lib/public-provider-catalog')
  globalThis.fetch = async () => { throw new Error('Every provider call must be mocked in this test.') }
})

after(() => {
  globalThis.fetch = originalFetch
  database.db().close()
  rmSync(workDir, { recursive: true, force: true })
})

function customer(name: string) {
  const inserted = database.db().prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
  ).run(name, `${name}@example.test`, 'test-only-not-a-password')
  const id = Number(inserted.lastInsertRowid)
  credits.credit(id, 10_000, 'topup', 'test', name)
  return id
}

function dueOrder(id: number) {
  database.db().prepare(`
    UPDATE orders SET provider_ready_at = datetime('now', '-1 minute'),
      provider_last_polled_at = datetime('now', '-1 minute') WHERE id = ?
  `).run(id)
}

function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

function completeResponse() {
  return new Response(JSON.stringify({ SUCCESS: [{ STATUS: 'SUCCESS', REPLY: 'Brand: Apple\nModel: iPhone 15' }] }))
}

test('a poll lease excludes overlapping claims and an expired owner cannot release its replacement', () => {
  const release = leases.claimProviderPoll('order', 900001)
  assert.equal(typeof release, 'function')
  assert.equal(leases.claimProviderPoll('order', 900001), null)
  database.db().prepare("UPDATE provider_poll_leases SET expires_at = 0 WHERE resource_type = 'order' AND resource_id = ?").run(900001)
  const replacement = leases.claimProviderPoll('order', 900001)
  assert.equal(typeof replacement, 'function')
  release!()
  assert.equal(leases.claimProviderPoll('order', 900001), null)
  replacement!()
  const next = leases.claimProviderPoll('order', 900001)
  assert.equal(typeof next, 'function')
  next!()
})

test('concurrent order polls make one provider call and a transient failure keeps credit held until delivery', async () => {
  const userId = customer('reliable-order')
  globalThis.fetch = async () => new Response(JSON.stringify({ SUCCESS: [{ REFERENCEID: 'order-1' }] }))
  const placed = await orders.submitOrder(userId, {
    kind: 'carrier_unlock', brandId: 1, carrierId: 103,
    imei: '490154203237518', email: 'reliable-order@example.test', idempotencyKey: 'reliable-order-1',
  })
  dueOrder(placed.orderId)
  const heldBalance = credits.getBalance(userId)
  const gate = deferred()
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    await gate.promise
    return new Response('temporarily unavailable', { status: 503 })
  }
  const first = orders.pollOrder(userId, placed.orderId)
  try {
    const duplicate = await orders.pollOrder(userId, placed.orderId)
    assert.equal(duplicate.status, 'processing')
    assert.equal(calls, 1)
  } finally {
    gate.release()
  }
  assert.equal((await first).status, 'processing')
  assert.deepEqual(credits.getBalance(userId), heldBalance)

  dueOrder(placed.orderId)
  globalThis.fetch = async () => { calls += 1; return completeResponse() }
  assert.equal((await orders.pollOrder(userId, placed.orderId)).status, 'delivered')
  assert.equal(calls, 2)
  assert.equal(credits.getBalance(userId).heldCents, 0)
  assert.equal(credits.getBalance(userId).creditCents, 10_000 - placed.priceCents)
  assert.equal(credits.creditIntegrity().mismatches, 0)
})

test('free-check status polling excludes duplicates and recovers from rate limiting', async () => {
  const userId = customer('reliable-check')
  const startingBalance = credits.getBalance(userId)
  globalThis.fetch = async () => new Response(JSON.stringify({ SUCCESS: [{ REFERENCEID: 'check-1' }] }))
  const placed = await checks.createImeiCheck(userId, { imei: '490154203237518', idempotencyKey: 'reliable-check-1' })
  assert.equal(placed.status, 'processing')
  const gate = deferred()
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    await gate.promise
    return new Response('rate limited', { status: 429 })
  }
  const first = checks.pollImeiCheck(userId, placed.id)
  try {
    assert.equal((await checks.pollImeiCheck(userId, placed.id)).status, 'processing')
    assert.equal(calls, 1)
  } finally {
    gate.release()
  }
  assert.equal((await first).status, 'processing')
  database.db().prepare("UPDATE imei_checks SET provider_last_polled_at = datetime('now', '-1 minute') WHERE id = ?").run(placed.id)
  globalThis.fetch = async () => { calls += 1; return completeResponse() }
  assert.equal((await checks.pollImeiCheck(userId, placed.id)).status, 'completed')
  assert.equal(calls, 2)
  assert.deepEqual(credits.getBalance(userId), startingBalance)
})

test('legacy asynchronous paid reports deduplicate polls and settle one hold', async () => {
  const userId = customer('reliable-report')
  // Approved new paid reports are synchronous; this is an existing DHRU row.
  const inserted = database.db().prepare(`
    INSERT INTO paid_report_orders
      (user_id, product_code, product_name, imei_fingerprint, masked_imei, status,
       price_cents, source, provider_order_id, provider_name, provider_mode)
    VALUES (?, 'APPLE_BASIC', 'Apple Basic', 'test-fingerprint', '***********7518',
      'processing', 5, 'website', 'paid-1', 'dhru', 'dhru')
  `).run(userId)
  const id = Number(inserted.lastInsertRowid)
  credits.hold(userId, 5, 'paid_imei_report', String(id))
  const gate = deferred()
  let calls = 0
  globalThis.fetch = async () => { calls += 1; await gate.promise; return completeResponse() }
  const first = reports.pollPaidReport(userId, id)
  try {
    assert.equal((await reports.pollPaidReport(userId, id)).order.status, 'processing')
    assert.equal(calls, 1)
  } finally {
    gate.release()
  }
  assert.equal((await first).order.status, 'completed')
  assert.equal(credits.getBalance(userId).creditCents, 9_995)
  assert.equal(credits.getBalance(userId).heldCents, 0)
  assert.equal(credits.creditIntegrity().mismatches, 0)
})

test('pollers re-read eligibility after claiming when another process updated the row', async () => {
  const userId = customer('stale-poll-snapshot')
  globalThis.fetch = async () => new Response(JSON.stringify({ SUCCESS: [{ REFERENCEID: 'stale-poll' }] }))
  const order = await orders.submitOrder(userId, {
    kind: 'carrier_unlock', brandId: 1, carrierId: 103,
    imei: '490154203237518', email: 'stale@example.test', idempotencyKey: 'stale-order',
  })
  dueOrder(order.orderId)
  const check = await checks.createImeiCheck(userId, { imei: '490154203237518', idempotencyKey: 'stale-check' })
  const inserted = database.db().prepare(`
    INSERT INTO paid_report_orders
      (user_id, product_code, product_name, imei_fingerprint, masked_imei, status,
       price_cents, source, provider_order_id, provider_name, provider_mode)
    VALUES (?, 'APPLE_BASIC', 'Apple Basic', 'stale-fingerprint', '***********7518',
      'processing', 5, 'website', 'stale-paid', 'dhru', 'dhru')
  `).run(userId)
  const paidId = Number(inserted.lastInsertRowid)
  credits.hold(userId, 5, 'paid_imei_report', String(paidId))
  const balanceBefore = credits.getBalance(userId)
  let calls = 0
  globalThis.fetch = async () => { calls += 1; return completeResponse() }
  const cases = [
    { resource: 'order', table: 'orders', id: order.orderId, poll: () => orders.pollOrder(userId, order.orderId) },
    { resource: 'imei_check', table: 'imei_checks', id: check.id, poll: () => checks.pollImeiCheck(userId, check.id) },
    { resource: 'paid_imei_report', table: 'paid_report_orders', id: paidId, poll: () => reports.pollPaidReport(userId, paidId) },
  ]
  for (const entry of cases) {
    // Deterministically interleave a completed poll between snapshot and claim.
    database.db().exec(`CREATE TEMP TRIGGER concurrent_poll BEFORE INSERT ON provider_poll_leases
      WHEN NEW.resource_type = '${entry.resource}' AND NEW.resource_id = ${entry.id}
      BEGIN UPDATE ${entry.table} SET provider_last_polled_at = datetime('now') WHERE id = ${entry.id}; END`)
    try {
      await entry.poll()
      assert.equal(calls, 0, `${entry.resource} must observe the newer debounce timestamp`)
    } finally {
      database.db().exec('DROP TRIGGER concurrent_poll')
    }
  }
  assert.deepEqual(credits.getBalance(userId), balanceBefore)
})

test('public availability follows operational gates, current prices and omits supplier-only fields', () => {
  const find = () => catalog.listPublicProviderProducts('imei_check').find((product) => product.productCode === 'APPLE_BASIC')!
  assert.equal(find().status, 'coming_soon', 'no approved mapping must not advertise an orderable report')
  process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({ 'check:apple_basic': { id: '214', mode: 'sync' } })
  database.db().prepare("UPDATE paid_report_products SET is_active = 1, price_cents = 17 WHERE code = 'APPLE_BASIC'").run()
  const available = find()
  assert.equal(available.status, 'available')
  assert.equal(available.priceCents, 17)
  assert.equal('providerCostMicros' in available, false)
  assert.equal('serviceId' in available, false)
  process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'disabled'
  assert.equal(find().status, 'coming_soon')
  process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
  database.db().prepare("UPDATE paid_report_products SET is_active = 0 WHERE code = 'APPLE_BASIC'").run()
  assert.equal(find().status, 'coming_soon')
  assert.equal(catalog.listPublicProviderProducts('unlock').every((product) => product.status === 'coming_soon'), true)
})
