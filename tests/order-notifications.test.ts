import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before, beforeEach } from 'node:test'

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-notifications-'))
process.env.IUNLOCKMOBILE_DB = join(workDir, 'notifications.db')
process.env.IUNLOCKMOBILE_REQUIRE_EMAIL_VERIFICATION = '0'

let database: typeof import('../lib/db')
let notifications: typeof import('../lib/order-notifications')
let customerId: number
const originalFetch = globalThis.fetch

before(async () => {
  database = await import('../lib/db')
  notifications = await import('../lib/order-notifications')
  customerId = Number(database.db().prepare(`
    INSERT INTO users (username, email, password_hash)
    VALUES ('notification-test', 'notification@example.test', 'test-only-not-a-password')
  `).run().lastInsertRowid)
})

beforeEach(() => {
  database.db().prepare('DELETE FROM order_notifications').run()
  process.env.RESEND_API_KEY = 'test-only-resend-key'
  process.env.IUNLOCKMOBILE_EMAIL_FROM = 'iUnlockMobile <sender@example.test>'
  process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN = 'https://app.example.test'
  globalThis.fetch = async () => { throw new Error('Email delivery must be mocked.') }
})

after(() => {
  globalThis.fetch = originalFetch
  database.db().close()
  rmSync(workDir, { recursive: true, force: true })
})

function enqueue(resourceId = 1, event: 'success' | 'rejected' = 'success') {
  database.db().transaction(() => {
    notifications.enqueueOrderNotification('order', resourceId, customerId, event)
  }).immediate()
}

function currentRow() {
  return database.db().prepare('SELECT * FROM order_notifications ORDER BY id LIMIT 1').get() as {
    attempts: number; available_at: number; lease_token: string | null;
    lease_until: number; sent_at: string | null; last_error: string | null
  } | undefined
}

function response() {
  return new Response(JSON.stringify({ id: 'email-test-1' }), { status: 200 })
}

function deferred() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

test('settlement and notification roll back together, and duplicate events enqueue once', () => {
  assert.throws(() => notifications.enqueueOrderNotification('order', 1, customerId, 'success'), /inside a database transaction/)
  assert.throws(() => database.db().transaction(() => {
    notifications.enqueueOrderNotification('order', 1, customerId, 'success')
    throw new Error('Settlement failed')
  }).immediate(), /Settlement failed/)
  assert.equal(currentRow(), undefined)
  enqueue()
  enqueue()
  const count = database.db().prepare('SELECT COUNT(*) AS count FROM order_notifications').get() as { count: number }
  assert.equal(count.count, 1)
})

test('delivery runs outside settlement transactions and sends one safe account notification', async () => {
  enqueue()
  let calls = 0
  globalThis.fetch = async (url, init) => {
    calls += 1
    assert.equal(database.db().inTransaction, false)
    assert.equal(url, 'https://api.resend.com/emails')
    assert.ok(init?.signal instanceof AbortSignal)
    assert.equal(new Headers(init?.headers).get('Idempotency-Key'), 'settlement/order/1/success')
    const payload = JSON.parse(String(init?.body)) as { to: string[]; html: string; text: string }
    assert.deepEqual(payload.to, ['notification@example.test'])
    assert.match(payload.html, /https:\/\/app\.example\.test\/user\/orders\/1/)
    assert.doesNotMatch(payload.text, /490154203237518/)
    return response()
  }
  assert.deepEqual(await notifications.deliverOrderNotifications(), { claimed: 1, sent: 1, failed: 0, leaseLost: 0 })
  assert.ok(currentRow()?.sent_at)
  assert.equal(currentRow()?.lease_token, null)
  assert.deepEqual(await notifications.deliverOrderNotifications(), { claimed: 0, sent: 0, failed: 0, leaseLost: 0 })
  assert.equal(calls, 1)
})

test('missing email configuration leaves the notification queued for retry', async () => {
  enqueue(2, 'rejected')
  delete process.env.RESEND_API_KEY
  const started = Date.now()
  assert.deepEqual(await notifications.deliverOrderNotifications(), { claimed: 1, sent: 0, failed: 1, leaseLost: 0 })
  const row = currentRow()!
  assert.equal(row.sent_at, null)
  assert.equal(row.last_error, 'delivery_unconfigured')
  assert.equal(row.attempts, 1)
  assert.ok(row.available_at >= started + 30_000)
})

test('ambiguous transport failure retries with the same idempotency key and capped backoff', async () => {
  enqueue(3, 'rejected')
  const keys: Array<string | null> = []
  globalThis.fetch = async (_url, init) => {
    keys.push(new Headers(init?.headers).get('Idempotency-Key'))
    throw new Error('socket timed out after provider accepted email for notification@example.test')
  }
  assert.equal((await notifications.deliverOrderNotifications()).failed, 1)
  assert.equal(currentRow()?.last_error, 'email_delivery_failed')
  assert.equal(currentRow()?.sent_at, null)
  assert.equal((await notifications.deliverOrderNotifications()).claimed, 0)
  database.db().prepare('UPDATE order_notifications SET available_at = 0, attempts = 100').run()
  const started = Date.now()
  assert.equal((await notifications.deliverOrderNotifications()).failed, 1)
  assert.ok(currentRow()!.available_at >= started + 3_600_000)
  assert.ok(currentRow()!.available_at <= Date.now() + 3_600_000)
  database.db().prepare('UPDATE order_notifications SET available_at = 0').run()
  globalThis.fetch = async (_url, init) => {
    keys.push(new Headers(init?.headers).get('Idempotency-Key'))
    const payload = JSON.parse(String(init?.body)) as { text: string }
    assert.match(payload.text, /reserved credit has been returned/)
    return response()
  }
  assert.equal((await notifications.deliverOrderNotifications()).sent, 1)
  assert.equal(new Set(keys).size, 1)
  assert.equal(keys.length, 3)
  assert.equal(currentRow()?.last_error, null)
})

test('overlapping workers cannot send an actively leased notification twice', async () => {
  enqueue()
  const gate = deferred()
  let calls = 0
  globalThis.fetch = async () => { calls += 1; await gate.promise; return response() }
  const first = notifications.deliverOrderNotifications()
  try {
    assert.equal((await notifications.deliverOrderNotifications()).claimed, 0)
    assert.equal(calls, 1)
  } finally {
    gate.release()
  }
  assert.equal((await first).sent, 1)
})

test('an expired worker cannot acknowledge or clear a replacement lease', async () => {
  enqueue()
  const firstGate = deferred()
  const secondGate = deferred()
  let calls = 0
  globalThis.fetch = async () => {
    calls += 1
    await (calls === 1 ? firstGate.promise : secondGate.promise)
    return response()
  }
  const first = notifications.deliverOrderNotifications()
  const firstToken = currentRow()?.lease_token
  database.db().prepare('UPDATE order_notifications SET lease_until = 0').run()
  const second = notifications.deliverOrderNotifications()
  const replacementToken = currentRow()?.lease_token
  try {
    assert.notEqual(replacementToken, firstToken)
    firstGate.release()
    assert.equal((await first).leaseLost, 1)
    assert.equal(currentRow()?.sent_at, null)
    assert.equal(currentRow()?.lease_token, replacementToken)
  } finally {
    firstGate.release()
    secondGate.release()
  }
  assert.equal((await second).sent, 1)
})

test('the batch limit bounds sends and report notices link to the authenticated report page', async () => {
  database.db().transaction(() => {
    notifications.enqueueOrderNotification('paid_imei_report', 1, customerId, 'success')
    notifications.enqueueOrderNotification('paid_imei_report', 2, customerId, 'success')
  }).immediate()
  globalThis.fetch = async (_url, init) => {
    const payload = JSON.parse(String(init?.body)) as { html: string }
    assert.match(payload.html, /https:\/\/app\.example\.test\/user\/reports\/1/)
    return response()
  }
  assert.equal((await notifications.deliverOrderNotifications(1)).sent, 1)
  const unsent = database.db().prepare('SELECT COUNT(*) AS count FROM order_notifications WHERE sent_at IS NULL').get() as { count: number }
  assert.equal(unsent.count, 1)
})
