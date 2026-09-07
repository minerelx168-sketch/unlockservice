import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import test, { after, before } from 'node:test'

const directory = mkdtempSync(join(tmpdir(), 'unlock-placement-'))
process.env.IUNLOCKMOBILE_DB = join(directory, 'orders.db')
process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'dhru'
process.env.IUNLOCKMOBILE_PROVIDER_URL = 'https://provider.example.test/api'
process.env.IUNLOCKMOBILE_PROVIDER_API_KEY = 'test-only-key'
process.env.IUNLOCKMOBILE_PROVIDER_USERNAME = 'test-user'
process.env.IUNLOCKMOBILE_PROVIDER_TIMEOUT_MS = '2000'
process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP = JSON.stringify({ 'carrier:103': { id: '901', mode: 'dhru' } })
process.env.IUNLOCKMOBILE_MAINTENANCE = '0'
let database: typeof import('../lib/db')
let credits: typeof import('../lib/credits')
let orders: typeof import('../lib/orders')
let price: number
const originalFetch = globalThis.fetch
const execute = promisify(execFile)

before(async () => {
  database = await import('../lib/db')
  credits = await import('../lib/credits')
  orders = await import('../lib/orders')
  database.db().exec('CREATE TABLE dispatch_probe (request_key TEXT NOT NULL)')
  price = database.getCarrier(103)!.price_cents
})
after(() => {
  globalThis.fetch = originalFetch
  database.db().close()
  rmSync(directory, { force: true, recursive: true })
})

function customer(name: string, balance: number) {
  const userId = Number(database.db().prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(name, `${name}@example.test`, 'not-a-password').lastInsertRowid)
  if (balance) credits.credit(userId, balance, 'topup', 'test', name)
  return userId
}
function input(key: string) {
  return { kind: 'carrier_unlock' as const, brandId: 1, carrierId: 103,
    imei: '490154203237518', email: 'atomic@example.test', idempotencyKey: key }
}
async function worker(user: number, key: string) {
  const { stdout } = await execute(process.execPath,
    ['--import', 'tsx', 'tests/fixtures/order-placement-worker.ts', String(user), key],
    { cwd: process.cwd(), env: process.env, timeout: 20_000 })
  return JSON.parse(stdout) as { id?: number; status?: string; code?: string }
}

test('independent processes cannot overspend one available balance', async () => {
  const user = customer('concurrent-balance', price)
  const results = await Promise.all([worker(user, 'parallel-order-a'), worker(user, 'parallel-order-b')])
  assert.equal(results.filter(row => row.status === 'processing').length, 1)
  assert.equal(results.filter(row => row.code === 'insufficient_credit').length, 1)
  assert.equal((database.db().prepare('SELECT COUNT(*) AS count FROM orders WHERE user_id = ?').get(user) as { count: number }).count, 1)
  assert.deepEqual(credits.getBalance(user), { creditCents: price, heldCents: price, availableCents: 0 })
})

test('independent identical submissions create one order and call provider once', async () => {
  const user = customer('concurrent-idempotency', price * 2)
  const [first, second] = await Promise.all([worker(user, 'shared-request-key'), worker(user, 'shared-request-key')])
  assert.ok(first.id)
  assert.equal(second.id, first.id)
  assert.equal((database.db().prepare('SELECT COUNT(*) AS count FROM dispatch_probe WHERE request_key = ?')
    .get('shared-request-key') as { count: number }).count, 1)
  assert.equal(credits.getBalance(user).heldCents, price)
})

test('provider deadline retains reservation and replays without a second submission', async () => {
  const user = customer('uncertain-placement', price)
  let calls = 0
  globalThis.fetch = async (_input, init) => {
    calls += 1
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
  }
  const order = await orders.submitOrder(user, input('timeout-request-1'))
  assert.equal(order.status, 'processing')
  assert.equal(orders.getOrder(order.orderId, user)?.provider_error_code, 'timeout')
  assert.equal(credits.getBalance(user).heldCents, price)
  process.env.IUNLOCKMOBILE_MAINTENANCE = '1'
  try {
    assert.equal((await orders.submitOrder(user, input('timeout-request-1'))).orderId, order.orderId)
    await assert.rejects(orders.submitOrder(user, { ...input('timeout-request-1'), imei: '354909000000095' }),
      (error: unknown) => error instanceof orders.OrderError && error.code === 'idempotency_conflict')
    assert.equal(calls, 1)
  } finally { process.env.IUNLOCKMOBILE_MAINTENANCE = '0' }
})

test('malformed/HTTP errors stay uncertain; explicit business rejection refunds once', async () => {
  const user = customer('provider-error-contract', price * 6)
  for (const [key, response] of [
    ['malformed-order', new Response('not JSON')],
    ['unauthorized-order', new Response('no auth', { status: 401 })],
    ['empty-error-array', new Response('{"ERROR":[]}')],
    ['empty-error-object', new Response('{"ERROR":{}}')],
  ] as const) {
    globalThis.fetch = async () => response
    assert.equal((await orders.submitOrder(user, input(key))).status, 'processing')
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ ERROR: [{ MESSAGE: 'Rejected' }] }))
  const rejected = await orders.submitOrder(user, input('business-refusal'))
  assert.equal(rejected.status, 'unavailable')
  assert.equal(credits.getBalance(user).heldCents, price * 4)
  assert.equal((await orders.submitOrder(user, input('business-refusal'))).status, 'unavailable')
  assert.equal(credits.creditIntegrity().mismatches, 0)
})

test('ledger settlement cannot consume another reservation or reverse a final effect', () => {
  const user = customer('reservation-binding', 1000)
  const other = customer('other-owner', 1000)
  credits.hold(user, 100, 'test-order', 'binding-one')
  credits.hold(user, 200, 'test-order', 'binding-two')
  assert.throws(() => credits.charge(other, 100, 'test-order', 'binding-one'), /original credit reservation/)
  assert.throws(() => credits.refund(user, 200, 'test-order', 'binding-one'), /original credit reservation/)
  credits.charge(user, 100, 'test-order', 'binding-one')
  assert.throws(() => credits.refund(user, 100, 'test-order', 'binding-one'), /opposite outcome/)
  assert.equal(credits.getBalance(user).heldCents, 200)
  credits.refund(user, 200, 'test-order', 'binding-two')
  assert.throws(() => credits.charge(user, 200, 'test-order', 'binding-two'), /opposite outcome/)
  assert.equal(credits.creditIntegrity().invalidHolds, 0)
})

test('polling configuration drift and code-less success cannot release or charge a reservation', async () => {
  const user = customer('code-required-order', price)
  globalThis.fetch = async () => new Response('{"SUCCESS":[{"REFERENCEID":"code-order-1"}]}')
  const order = await orders.submitOrder(user, { ...input('code-required-key'), brandId: 2 })
  assert.equal(orders.getOrder(order.orderId, user)?.delivery, 'code')
  const due = () => database.db().prepare(`UPDATE orders SET provider_ready_at = datetime('now', '-1 minute'),
    provider_last_polled_at = datetime('now', '-1 minute') WHERE id = ?`).run(order.orderId)
  const savedMap = process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP
  const savedUser = process.env.IUNLOCKMOBILE_PROVIDER_USERNAME
  try {
    globalThis.fetch = async () => { throw new Error('Configuration failures must not reach transport') }
    delete process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP
    due()
    assert.equal((await orders.pollOrder(user, order.orderId)).status, 'processing')
    process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP = savedMap
    delete process.env.IUNLOCKMOBILE_PROVIDER_USERNAME
    due()
    assert.equal((await orders.pollOrder(user, order.orderId)).status, 'processing')
    assert.equal(credits.getBalance(user).heldCents, price)
  } finally {
    process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP = savedMap
    process.env.IUNLOCKMOBILE_PROVIDER_USERNAME = savedUser
  }
  globalThis.fetch = async () => new Response('{"SUCCESS":[{"STATUS":"SUCCESS","REPLY":"Model: Galaxy S24"}]}')
  due()
  assert.equal((await orders.pollOrder(user, order.orderId)).status, 'processing')
  assert.equal(orders.getOrder(order.orderId, user)?.provider_error_code, 'result_incomplete')
  assert.equal(credits.getBalance(user).heldCents, price)
  globalThis.fetch = async () => new Response('{"SUCCESS":[{"STATUS":"SUCCESS","REPLY":"Unlock Code: 12345678"}]}')
  due()
  assert.equal((await orders.pollOrder(user, order.orderId)).status, 'delivered')
  assert.equal(credits.getBalance(user).creditCents, 0)
})

test('a pending poll returns the current refund and balance if a webhook settles while it waits', async () => {
  const user = customer('webhook-poll-race', price)
  globalThis.fetch = async () => new Response('{"SUCCESS":[{"REFERENCEID":"race-order-1"}]}')
  const order = await orders.submitOrder(user, input('webhook-poll-key'))
  database.db().prepare("UPDATE orders SET provider_ready_at = datetime('now', '-1 minute') WHERE id = ?").run(order.orderId)
  let release!: () => void
  const waiting = new Promise<void>(resolve => { release = resolve })
  globalThis.fetch = async () => { await waiting; return new Response('{"SUCCESS":[{"STATUS":"pending"}]}') }
  const polling = orders.pollOrder(user, order.orderId)
  assert.equal(orders.settleOrderWebhook(order.orderId, 'race-order-1', { status: 'rejected' }).status, 'unavailable')
  release()
  const response = await polling
  assert.equal(response.status, 'unavailable')
  assert.equal(response.credit.balanceCents, price)
  assert.equal(credits.getBalance(user).heldCents, 0)
})
