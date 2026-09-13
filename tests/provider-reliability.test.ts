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
process.env.IUNLOCKMOBILE_PROVIDER_DHRU_URL = 'https://provider.example.test/api/index.php'
process.env.IUNLOCKMOBILE_PROVIDER_DHRU_KEY = 'test-only-dhru-key'
process.env.IUNLOCKMOBILE_PROVIDER_DHRU_USERNAME = 'test-user'
process.env.IUNLOCKMOBILE_MAINTENANCE = '0'
process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP = JSON.stringify({ 'carrier:103': { id: '901', mode: 'dhru' } })
process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({ 'check:basic': { id: '900', mode: 'dhru' } })

let database: typeof import('../lib/db')
let credits: typeof import('../lib/credits')
let orders: typeof import('../lib/orders')
let checks: typeof import('../lib/imei-checks')
let reports: typeof import('../lib/paid-reports')
let providerJobs: typeof import('../lib/provider-jobs')
let leases: typeof import('../lib/provider-poll-lease')
let imeiPrivacy: typeof import('../lib/imei-privacy')
let catalog: typeof import('../lib/public-provider-catalog')
const originalFetch = globalThis.fetch

before(async () => {
  database = await import('../lib/db')
  credits = await import('../lib/credits')
  orders = await import('../lib/orders')
  checks = await import('../lib/imei-checks')
  reports = await import('../lib/paid-reports')
  providerJobs = await import('../lib/provider-jobs')
  leases = await import('../lib/provider-poll-lease')
  imeiPrivacy = await import('../lib/imei-privacy')
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
  return new Response(JSON.stringify({ SUCCESS: [{ STATUS: 4, CODE: 'Brand: Apple\nModel: iPhone 15' }] }))
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
  // A processing paid service may be settled by the shared DHRU poller.
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

test('legacy paid reports backfill full IMEI only when completed Code matches the request fingerprint', async () => {
  const userId = customer('legacy-imei-backfill')
  const imei = '490154203237518'
  const inserted = database.db().prepare(`
    INSERT INTO paid_report_orders
      (user_id, product_code, product_name, imei_fingerprint, masked_imei, status,
       price_cents, source, provider_order_id, provider_name, provider_mode)
    VALUES (?, 'APPLE_BASIC', 'Apple Basic', ?, '49·········7518',
      'processing', 5, 'website', 'legacy-imei-ref', 'dhru', 'dhru')
  `).run(userId, imeiPrivacy.fingerprintImei(imei))
  const id = Number(inserted.lastInsertRowid)
  credits.hold(userId, 5, 'paid_imei_report', String(id))
  globalThis.fetch = async () => new Response(JSON.stringify({
    SUCCESS: [{ STATUS: 4, CODE: `Model: Test Device\nIMEI: ${imei}\nStatus: Clean` }],
  }))

  const settled = await reports.pollPaidReport(userId, id)
  assert.equal(settled.order.status, 'completed')
  assert.equal(settled.order.imei, imei)
  const stored = database.db().prepare('SELECT imei_encrypted FROM paid_report_orders WHERE id = ?').get(id) as { imei_encrypted: string }
  assert.equal(Boolean(stored.imei_encrypted), true)
  assert.equal(stored.imei_encrypted.includes(imei), false)
})

test('the bounded batch worker polls every timer cycle even after many attempts and settles without re-placement', async () => {
  const userId = customer('paid-worker')
  const inserted = database.db().prepare(`
    INSERT INTO paid_report_orders
      (user_id, product_code, product_name, imei_fingerprint, masked_imei, status,
       price_cents, source, provider_order_id, provider_name, provider_mode,
       provider_attempts, provider_last_polled_at)
    VALUES (?, 'APPLE_BASIC', 'Apple Basic', 'worker-fingerprint', '***********7518',
      'processing', 5, 'website', 'paid-worker-1', 'dhru', 'dhru',
      99, datetime('now', '-2 minutes'))
  `).run(userId)
  const id = Number(inserted.lastInsertRowid)
  credits.hold(userId, 5, 'paid_imei_report', String(id))
  let calls = 0
  globalThis.fetch = async () => { calls += 1; return completeResponse() }
  const summary = await providerJobs.pollProviderJobs(1)
  assert.equal(calls, 1)
  assert.equal(summary.reportsSeen, 1)
  assert.equal(summary.completed, 1)
  assert.equal(summary.errors, 0)
  assert.equal(reports.getPaidReport(userId, id)?.status, 'completed')
  assert.equal(credits.getBalance(userId).creditCents, 9_995)
  assert.equal(credits.getBalance(userId).heldCents, 0)
  assert.equal(credits.creditIntegrity().mismatches, 0)
})

test('an approved PHP check product places once and settles its hold immediately', async () => {
  const userId = customer('strict-php-10')
  const savedMap = process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP
  const savedName = process.env.IUNLOCKMOBILE_PROVIDER_NAME
  process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'unlock-service'
  process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({
    'product:apple_icloud_status': { id: '10', mode: 'sync' },
  })
  let calls = 0
  globalThis.fetch = async (_input, init) => {
    calls += 1
    const body = new URLSearchParams(String(init?.body))
    assert.equal(body.get('service'), '10')
    assert.equal(body.get('imei'), '490154203237518')
    return new Response(JSON.stringify({
      status: true,
      response: 'Find My iPhone: ON',
      object: [{ 'Find My iPhone': 'ON', IMEI: '490154203237518' }],
    }))
  }
  try {
    const before = credits.getBalance(userId)
    const created = await reports.createPaidReport(userId, {
      productCode: 'APPLE_ICLOUD_STATUS',
      imei: '490154203237518',
      idempotencyKey: 'strict-php-10-once',
    })
    assert.equal(created.order.status, 'completed')
    assert.equal(created.order.priceCents, 1)
    assert.equal(calls, 1)
    assert.equal(credits.getBalance(userId).creditCents, before.creditCents - 1)
    assert.equal(credits.getBalance(userId).heldCents, before.heldCents)
    const replay = await reports.createPaidReport(userId, {
      productCode: 'APPLE_ICLOUD_STATUS',
      imei: '490154203237518',
      idempotencyKey: 'strict-php-10-once',
    })
    assert.equal(replay.order.id, created.order.id)
    assert.equal(calls, 1)
    const stored = JSON.stringify(reports.getPaidReport(userId, created.order.id)?.report)
    assert.match(stored, /ON/)
    assert.equal(stored.includes('490154203237518'), false)
    assert.equal(credits.creditIntegrity().mismatches, 0)
  } finally {
    if (savedMap === undefined) delete process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP
    else process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = savedMap
    if (savedName === undefined) delete process.env.IUNLOCKMOBILE_PROVIDER_NAME
    else process.env.IUNLOCKMOBILE_PROVIDER_NAME = savedName
  }
})

test('an approved DHRU unlock product holds, places once and settles through the batch worker', async () => {
  const userId = customer('strict-unlock-346')
  const savedMap = process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP
  process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({
    'product:unlock_346': { id: '346', mode: 'dhru' },
  })
  let placements = 0
  let polls = 0
  globalThis.fetch = async (_input, init) => {
    const body = new URLSearchParams(String(init?.body))
    const parameters = body.get('parameters') ?? ''
    if (body.get('action') === 'placeimeiorder') {
      placements += 1
      assert.match(parameters, /<ID>346<\/ID>/)
      return new Response(JSON.stringify({ SUCCESS: [{ REFERENCEID: 'strict-unlock-ref' }] }))
    }
    polls += 1
    assert.equal(body.get('action'), 'getimeiorder')
    assert.match(parameters, /<ID>strict-unlock-ref<\/ID>/)
    return new Response(JSON.stringify({ SUCCESS: [{ STATUS: 4, CODE: 'Status: Unlocked\nCarrier: AT&T' }] }))
  }
  try {
    const before = credits.getBalance(userId)
    const created = await reports.createPaidReport(userId, {
      productCode: 'UNLOCK_346',
      imei: '490154203237518',
      idempotencyKey: 'strict-unlock-346-once',
    })
    assert.equal(created.order.status, 'processing')
    assert.equal(created.order.productCode, 'UNLOCK_346')
    assert.equal(created.order.imei, '490154203237518')
    assert.equal(created.order.priceCents, 15)
    assert.equal(placements, 1)
    assert.equal(credits.getBalance(userId).heldCents, before.heldCents + 15)

    const replay = await reports.createPaidReport(userId, {
      productCode: 'UNLOCK_346',
      imei: '490154203237518',
      idempotencyKey: 'strict-unlock-346-once',
    })
    assert.equal(replay.order.id, created.order.id)
    assert.equal(replay.order.imei, '490154203237518')
    assert.equal(placements, 1)

    database.db().prepare("UPDATE paid_report_orders SET provider_last_polled_at = datetime('now', '-3 minutes') WHERE id = ?").run(created.order.id)
    const summary = await providerJobs.pollProviderJobs(1)
    assert.equal(polls, 1)
    assert.equal(summary.reportsSeen, 1)
    assert.equal(summary.completed, 1)
    assert.equal(reports.getPaidReport(userId, created.order.id)?.status, 'completed')
    assert.equal(credits.getBalance(userId).creditCents, before.creditCents - 15)
    assert.equal(credits.getBalance(userId).heldCents, before.heldCents)
    const stored = JSON.stringify(reports.getPaidReport(userId, created.order.id)?.report)
    assert.match(stored, /Unlocked/)
    assert.equal(stored.includes('490154203237518'), false)
    assert.equal(credits.creditIntegrity().mismatches, 0)
  } finally {
    if (savedMap === undefined) delete process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP
    else process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = savedMap
  }
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
  process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({
    'check:apple_basic': { id: '214', mode: 'sync' },
    'product:unlock_346': { id: '346', mode: 'dhru' },
  })
  database.db().prepare("UPDATE paid_report_products SET is_active = 1, price_cents = 17 WHERE code = 'APPLE_BASIC'").run()
  const findUnlock = () => catalog.listPublicProviderProducts('unlock').find((product) => product.productCode === 'UNLOCK_346')!
  const available = find()
  assert.equal(available.status, 'available')
  assert.equal(findUnlock().status, 'available')
  assert.equal(available.priceCents, 17)
  assert.equal('providerCostMicros' in available, false)
  assert.equal('serviceId' in available, false)
  process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'disabled'
  assert.equal(find().status, 'coming_soon')
  assert.equal(findUnlock().status, 'coming_soon')
  process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
  database.db().prepare("UPDATE paid_report_products SET is_active = 0 WHERE code = 'APPLE_BASIC'").run()
  assert.equal(find().status, 'coming_soon')
  assert.equal(findUnlock().status, 'available')
})
