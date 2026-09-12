import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-webhook-'))
const secret = 'a7'.repeat(32)
process.env.IUNLOCKMOBILE_DB = join(workDir, 'webhook.db')
process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'signed-provider'
process.env.IUNLOCKMOBILE_PROVIDER_WEBHOOK_SECRET = secret

let database: typeof import('../lib/db')
let credits: typeof import('../lib/credits')
let handle: typeof import('../lib/provider-webhook').handleProviderWebhook
let fixtureCount = 0

before(async () => {
  database = await import('../lib/db')
  credits = await import('../lib/credits')
  handle = (await import('../lib/provider-webhook')).handleProviderWebhook
})

after(() => {
  database.db().close()
  rmSync(workDir, { recursive: true, force: true })
})

function signature(body: string, timestamp: string) {
  return `sha256=${createHmac('sha256', Buffer.from(secret, 'hex')).update(`${timestamp}.${body}`).digest('hex')}`
}

function signed(body: string | Record<string, unknown>, extraHeaders: Record<string, string> = {}, at = Math.floor(Date.now() / 1_000)) {
  const raw = typeof body === 'string' ? body : JSON.stringify(body)
  const timestamp = String(at)
  return new Request('http://localhost/api/provider/webhook', {
    method: 'POST', body: raw,
    headers: {
      'content-type': 'application/json', 'x-provider-timestamp': timestamp,
      'x-provider-signature': signature(raw, timestamp), ...extraHeaders,
    },
  })
}

function event(eventId: string, providerOrderId: string, status = 'success', resourceType = 'order') {
  return { eventId, resourceType, providerOrderId, status }
}

function seed(providerOrderId: string, resourceType = 'order', provider = 'signed-provider') {
  const name = `webhook-${++fixtureCount}`
  const userId = Number(database.db().prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(name, `${name}@example.test`, 'test-only-hash').lastInsertRowid)
  credits.credit(userId, 1_000, 'topup', 'test', name)
  const inserted = resourceType === 'order'
    ? database.db().prepare(`
      INSERT INTO orders (user_id, kind, brand_id, carrier_id, imei, delivery_email,
        status, delivery, price_cents, eta_hours, provider_order_id, provider_name)
      VALUES (?, 'carrier_unlock', 1, 103, '490154203237518', ?, 'processing', 'code', 100, 1, ?, ?)
    `).run(userId, `${name}@example.test`, providerOrderId, provider)
    : database.db().prepare(`
      INSERT INTO paid_report_orders (user_id, product_code, product_name, imei_fingerprint,
        masked_imei, status, price_cents, provider_order_id, provider_name, provider_mode)
      VALUES (?, 'APPLE_BASIC', 'Apple Basic', 'test-fingerprint', '***********7518',
        'processing', 100, ?, ?, 'dhru')
    `).run(userId, providerOrderId, provider)
  const id = Number(inserted.lastInsertRowid)
  credits.hold(userId, 100, resourceType, String(id))
  return { userId, id }
}

function receiptCount(eventId: string) {
  return (database.db().prepare('SELECT COUNT(*) AS count FROM provider_webhook_receipts WHERE event_id = ?')
    .get(eventId) as { count: number }).count
}

function ledgerCount(userId: number, type: string) {
  return (database.db().prepare('SELECT COUNT(*) AS count FROM credit_ledger WHERE user_id = ? AND type = ?')
    .get(userId, type) as { count: number }).count
}

function notificationCount(userId: number) {
  return (database.db().prepare('SELECT COUNT(*) AS count FROM order_notifications WHERE user_id = ?')
    .get(userId) as { count: number }).count
}

test('signed order success charges once; exact replay and opposite terminal events do not change money', async () => {
  const fixture = seed('signed-order-success')
  const body = { ...event('order-success', 'signed-order-success'), result: { Model: 'iPhone 15' }, unlockCode: '12345678' }
  const first = await handle(signed(body))
  assert.equal(first.status, 200)
  assert.equal((await first.json()).status, 'delivered')
  assert.equal(credits.getBalance(fixture.userId).creditCents, 900)
  assert.equal(credits.getBalance(fixture.userId).heldCents, 0)
  const replay = await handle(signed(body))
  assert.equal(replay.status, 200)
  assert.equal((await replay.json()).duplicate, true)
  assert.equal(ledgerCount(fixture.userId, 'charge'), 1)
  assert.equal(receiptCount('order-success'), 1)

  assert.equal((await handle(signed({ ...body, status: 'rejected' }))).status, 409)
  const opposite = await handle(signed(event('order-success-opposite', 'signed-order-success', 'rejected')))
  assert.equal(opposite.status, 200)
  assert.equal((await opposite.json()).status, 'delivered')
  assert.equal(credits.getBalance(fixture.userId).creditCents, 900)
  assert.equal(ledgerCount(fixture.userId, 'refund'), 0)
  assert.equal(notificationCount(fixture.userId), 1)
})

test('signed rejection releases exactly one hold and subsequent success cannot debit the refund', async () => {
  const fixture = seed('signed-order-rejected')
  const body = { ...event('order-rejected', 'signed-order-rejected', 'rejected'), message: 'The carrier rejected this order.' }
  const rejected = await handle(signed(body))
  assert.equal(rejected.status, 200)
  assert.equal((await rejected.json()).status, 'unavailable')
  assert.equal((await handle(signed(body))).status, 200)
  assert.equal((await handle(signed(event('order-rejected-late-success', 'signed-order-rejected')))).status, 200)
  assert.equal(credits.getBalance(fixture.userId).availableCents, 1_000)
  assert.equal(credits.getBalance(fixture.userId).heldCents, 0)
  assert.equal(ledgerCount(fixture.userId, 'refund'), 1)
  assert.equal(ledgerCount(fixture.userId, 'charge'), 0)
})

test('paid report callbacks use the same atomic charge/refund semantics', async () => {
  const success = seed('signed-paid-success', 'paid_imei_report')
  const rejected = seed('signed-paid-rejected', 'paid_imei_report')
  const result = await handle(signed({ ...event('paid-success', 'signed-paid-success', 'success', 'paid_imei_report'), result: { Brand: 'Apple', Model: 'iPhone 15' } }))
  assert.equal(result.status, 200)
  assert.equal((await result.json()).status, 'completed')
  assert.equal((await handle(signed(event('paid-rejected', 'signed-paid-rejected', 'rejected', 'paid_imei_report')))).status, 200)
  assert.equal((await handle(signed(event('paid-success-late-reject', 'signed-paid-success', 'rejected', 'paid_imei_report')))).status, 200)
  assert.equal((await handle(signed(event('paid-rejected-late-success', 'signed-paid-rejected', 'success', 'paid_imei_report')))).status, 200)
  assert.equal(credits.getBalance(success.userId).creditCents, 900)
  assert.equal(credits.getBalance(rejected.userId).availableCents, 1_000)
  assert.equal(ledgerCount(success.userId, 'charge'), 1)
  assert.equal(ledgerCount(success.userId, 'refund'), 0)
  assert.equal(ledgerCount(rejected.userId, 'refund'), 1)
  assert.equal(notificationCount(success.userId), 0)
  assert.equal(notificationCount(rejected.userId), 0)
})

test('unknown or ambiguous provider references are retryable and do not consume receipts', async () => {
  const body = event('early-callback', 'arrives-later')
  const early = await handle(signed(body))
  assert.equal(early.status, 503)
  assert.equal(early.headers.get('retry-after'), '5')
  assert.equal(receiptCount('early-callback'), 0)
  seed('arrives-later')
  assert.equal((await handle(signed(body))).status, 200)
  assert.equal(receiptCount('early-callback'), 1)

  const other = seed('other-provider-reference', 'order', 'other-provider')
  assert.equal((await handle(signed(event('other-provider-event', 'other-provider-reference')))).status, 503)
  assert.equal(receiptCount('other-provider-event'), 0)
  assert.equal(credits.getBalance(other.userId).heldCents, 100)

  const a = seed('ambiguous-reference')
  const b = seed('ambiguous-reference')
  assert.equal((await handle(signed(event('ambiguous-event', 'ambiguous-reference')))).status, 503)
  assert.equal(receiptCount('ambiguous-event'), 0)
  assert.equal(credits.getBalance(a.userId).heldCents, 100)
  assert.equal(credits.getBalance(b.userId).heldCents, 100)
})

test('signature tampering, stale/future timestamps, and unsigned callbacks cannot settle orders', async () => {
  const fixture = seed('secure-reference')
  const body = event('secure-event', 'secure-reference')
  const timestamp = String(Math.floor(Date.now() / 1_000))
  const oldSignature = signature(JSON.stringify(body), timestamp)
  assert.equal((await handle(signed({ ...body, status: 'rejected' }, { 'x-provider-signature': oldSignature }, Number(timestamp)))).status, 401)
  assert.equal((await handle(signed(body, {}, Number(timestamp) - 301))).status, 401)
  assert.equal((await handle(signed(body, {}, Number(timestamp) + 301))).status, 401)
  assert.equal((await handle(signed(body, { 'x-provider-signature': '' }))).status, 401)
  assert.equal((await handle(signed('{malformed', { 'x-provider-signature': 'sha256=' + '00'.repeat(32) }))).status, 401)
  assert.equal(credits.getBalance(fixture.userId).heldCents, 100)
  assert.equal(receiptCount('secure-event'), 0)
})

test('signed payload validation excludes trusted-account fields, wrong types and oversized fields', async () => {
  const body = event('invalid-event', 'never-consumed')
  const invalid = [
    '{invalid', [], { ...body, userId: 1 }, { ...body, amount: 1_000_000 },
    { ...body, provider: 'other-provider' }, { ...body, status: ['success'] },
    { ...body, resourceType: ['order'] }, { ...body, result: [] },
    { ...body, eventId: 'x'.repeat(129) }, { ...body, providerOrderId: 'x'.repeat(257) },
    { ...body, message: 'x'.repeat(1_001) }, { ...body, unlockCode: 'x'.repeat(257) },
    { ...body, result: { message: 'x'.repeat(8_193) } },
    { ...body, resourceType: 'paid_imei_report', unlockCode: '1234' },
    { ...body, result: JSON.parse('{"__proto__":{"unsafe":true}}') },
  ]
  for (const value of invalid) {
    const raw = typeof value === 'string' ? value : JSON.stringify(value)
    assert.equal((await handle(signed(raw))).status, 400)
  }
  assert.equal(receiptCount('invalid-event'), 0)
  assert.equal((await handle(signed(body, { 'content-type': 'text/plain' }))).status, 415)
  assert.equal((await handle(signed(body, { 'content-encoding': 'gzip' }))).status, 415)
  assert.equal((await handle(signed(body, { 'content-length': 'garbage' }))).status, 400)
  process.env.IUNLOCKMOBILE_PROVIDER_WEBHOOK_SECRET = 'short-secret'
  try {
    assert.equal((await handle(signed(body))).status, 503)
  } finally {
    process.env.IUNLOCKMOBILE_PROVIDER_WEBHOOK_SECRET = secret
  }
})

function streamingRequest(stream: ReadableStream<Uint8Array>, extraHeaders: Record<string, string> = {}) {
  return new Request('http://localhost/api/provider/webhook', {
    method: 'POST', body: stream,
    // Required by Node's Request constructor for a streaming request body.
    duplex: 'half',
    headers: {
      'content-type': 'application/json',
      'x-provider-timestamp': String(Math.floor(Date.now() / 1_000)),
      'x-provider-signature': 'sha256=' + '00'.repeat(32), ...extraHeaders,
    },
  } as RequestInit & { duplex: 'half' })
}

test('actual-byte limits cancel both unknown-length and dishonest Content-Length streams', async () => {
  const headerCases: Record<string, string>[] = [{}, { 'content-length': '5' }, { 'content-length': '65537' }]
  for (const headers of headerCases) {
    let cancelled = false
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(33_000))
        controller.enqueue(new Uint8Array(33_000))
      },
      cancel() { cancelled = true },
    })
    const result = await handle(streamingRequest(stream, headers))
    assert.equal(result.status, 413)
    assert.equal(cancelled, true)
  }
})

test('a stalled body is cancelled after the read deadline', { timeout: 8_000 }, async () => {
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true } })
  const result = await handle(streamingRequest(stream))
  assert.equal(result.status, 408)
  assert.equal(cancelled, true)
})

test('receipt failure rolls back settlement and ledger, leaving the exact callback safe to retry', async () => {
  const fixture = seed('rollback-reference')
  const body = { ...event('rollback-event', 'rollback-reference'), unlockCode: '12345678' }
  const beforeBalance = credits.getBalance(fixture.userId)
  database.db().exec(`CREATE TEMP TRIGGER fail_webhook_receipt
    BEFORE INSERT ON provider_webhook_receipts WHEN NEW.event_id = 'rollback-event'
    BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END;`)
  try {
    const result = await handle(signed(body))
    assert.equal(result.status, 503)
    assert.deepEqual(await result.json(), { success: false, code: 'temporarily_unavailable' })
    assert.deepEqual(credits.getBalance(fixture.userId), beforeBalance)
    assert.equal(ledgerCount(fixture.userId, 'charge'), 0)
    assert.equal(notificationCount(fixture.userId), 0)
    assert.equal(receiptCount('rollback-event'), 0)
    assert.equal((database.db().prepare('SELECT status FROM orders WHERE id = ?').get(fixture.id) as { status: string }).status, 'processing')
  } finally {
    database.db().exec('DROP TRIGGER fail_webhook_receipt')
  }
  assert.equal((await handle(signed(body))).status, 200)
  assert.equal(ledgerCount(fixture.userId, 'charge'), 1)
  assert.equal(notificationCount(fixture.userId), 1)
  assert.equal(receiptCount('rollback-event'), 1)
  assert.equal(credits.creditIntegrity().mismatches, 0)
})

test('a failed rejected-report receipt rolls back the refund and still never creates email', async () => {
  const fixture = seed('refund-rollback-reference', 'paid_imei_report')
  const body = event('refund-rollback-event', 'refund-rollback-reference', 'rejected', 'paid_imei_report')
  const beforeBalance = credits.getBalance(fixture.userId)
  database.db().exec(`CREATE TEMP TRIGGER fail_refund_receipt
    BEFORE INSERT ON provider_webhook_receipts WHEN NEW.event_id = 'refund-rollback-event'
    BEGIN SELECT RAISE(ABORT, 'simulated storage failure'); END;`)
  try {
    assert.equal((await handle(signed(body))).status, 503)
    assert.deepEqual(credits.getBalance(fixture.userId), beforeBalance)
    assert.equal(ledgerCount(fixture.userId, 'refund'), 0)
    assert.equal(notificationCount(fixture.userId), 0)
    assert.equal(receiptCount('refund-rollback-event'), 0)
    assert.equal((database.db().prepare('SELECT status FROM paid_report_orders WHERE id = ?')
      .get(fixture.id) as { status: string }).status, 'processing')
  } finally {
    database.db().exec('DROP TRIGGER fail_refund_receipt')
  }
  assert.equal((await handle(signed(body))).status, 200)
  assert.equal((await handle(signed(body))).status, 200)
  assert.equal(ledgerCount(fixture.userId, 'refund'), 1)
  assert.equal(notificationCount(fixture.userId), 0)
  assert.equal(credits.getBalance(fixture.userId).availableCents, 1_000)
  assert.equal(credits.creditIntegrity().mismatches, 0)
})
