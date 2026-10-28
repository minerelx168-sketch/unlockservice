import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
const folder = mkdtempSync(join(tmpdir(), 'apple-free-'))
Object.assign(process.env, { IUNLOCKMOBILE_DB: join(folder, 'test.db'), IUNLOCKMOBILE_PROVIDER_MODE: 'enabled', IUNLOCKMOBILE_PROVIDER_NAME: 'unlock-service', IUNLOCKMOBILE_PROVIDER_URL: 'https://provider.example.test', IUNLOCKMOBILE_PROVIDER_API_KEY: 'test-only', IUNLOCKMOBILE_IMEI_SERVICE_MAP: JSON.stringify({ 'check:apple_free': { id: '214', mode: 'sync' } }) })
const originalFetch = globalThis.fetch
let calls = 0, fail = false
const imei = '490154203237518'
after(() => { globalThis.fetch = originalFetch; rmSync(folder, { recursive: true, force: true }) })
test('Apple Free Check uses ID 214, enforces 3 daily attempts atomically for customers and admins and never charges credit', async () => {
  const { db } = await import('../lib/db')
  const { createImeiCheck, freeAppleQuota } = await import('../lib/imei-checks')
  const { listStorefrontProviderProducts } = await import('../lib/public-provider-catalog')
  const { getPaidReportProduct } = await import('../lib/paid-reports')
  const user = Number(db().prepare("INSERT INTO users(username,email,password_hash,status,account_type,email_verified_at) VALUES ('free-test','free@example.test','test','active','customer',datetime('now'))").run().lastInsertRowid)
  globalThis.fetch = async (_input, init) => {
    calls++
    const body = new URLSearchParams(String(init?.body))
    assert.equal(body.get('service'), '214'); assert.equal(body.get('imei'), imei)
    if (fail) throw new Error('Uncertain provider timeout')
    return Response.json({ success: true, response: 'Model: iPhone 15\niCloud Status: Clean\nReplaced Device: No\nExtra Provider Field: Actual value', object: { Model: 'iPhone 15', 'iCloud Status': 'Clean', 'Replaced Device': 'No', 'Extra Provider Field': 'Actual value' } })
  }
  await assert.rejects(createImeiCheck(user, { imei: `${imei}0` }), /valid/)
  assert.equal(freeAppleQuota(user).remaining, 3)
  const key = randomUUID(), first = await createImeiCheck(user, { imei, idempotencyKey: key })
  assert.equal(first.status, 'completed'); assert.equal(first.checkType, 'apple_free')
  assert.equal(calls, 1); assert.equal(freeAppleQuota(user).remaining, 2)
  assert.match(first.providerCode ?? '', /Replaced Device: No/)
  assert.match(first.providerCode ?? '', /Extra Provider Field: Actual value/)
  assert.equal(first.result?._providerCodeEncrypted, undefined)
  const stored = db().prepare('SELECT result_json FROM imei_checks WHERE id=?').get(first.id) as { result_json: string }
  assert.doesNotMatch(stored.result_json, /Extra Provider Field|Actual value/)
  assert.equal((await createImeiCheck(user, { imei, idempotencyKey: key })).id, first.id)
  assert.equal(calls, 1)
  await assert.rejects(createImeiCheck(user, { imei: '356938035643809', idempotencyKey: key }), /another check/)
  const results = await Promise.allSettled(Array.from({ length: 6 }, () => createImeiCheck(user, { imei, idempotencyKey: randomUUID() })))
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 2)
  assert.equal(calls, 3); assert.equal(freeAppleQuota(user).remaining, 0)
  assert.deepEqual(db().prepare('SELECT count(*) AS n FROM credit_ledger').get(), { n: 0 })
  assert.deepEqual(db().prepare('SELECT count(*) AS n FROM invoices').get(), { n: 0 })
  assert.deepEqual(db().prepare('SELECT count(*) AS n FROM paid_report_orders').get(), { n: 0 })
  assert.equal(listStorefrontProviderProducts('imei_check').some(product => product.productCode === 'APPLE_BASIC'), false)
  assert.equal(getPaidReportProduct('APPLE_BASIC')?.providerReady ?? false, false)
  db().prepare("UPDATE imei_checks SET created_at=datetime('now','-1 day') WHERE user_id=?").run(user)
  assert.equal(freeAppleQuota(user).remaining, 3)
  fail = true
  const timeoutKey = randomUUID(), uncertain = await createImeiCheck(user, { imei, idempotencyKey: timeoutKey })
  assert.equal(uncertain.status, 'unavailable'); assert.equal(freeAppleQuota(user).remaining, 2)
  await createImeiCheck(user, { imei, idempotencyKey: timeoutKey }); assert.equal(calls, 4)
  db().prepare('UPDATE users SET email_verified_at=NULL WHERE id=?').run(user)
  await assert.rejects(createImeiCheck(user, { imei }), /active verified account/)
  assert.equal(calls, 4)

  // The owner uses an admin account: grant the same verified-account allowance,
  // without changing roles, bypassing caps, or creating paid transactions.
  fail = false
  const admin = Number(db().prepare("INSERT INTO users(username,email,password_hash,status,account_type,email_verified_at,credit_cents) VALUES ('free-admin','admin-free@example.test','test','active','admin',datetime('now'),1234)").run().lastInsertRowid)
  const adminStartCalls = calls
  const adminKey = randomUUID()
  const adminFirst = await createImeiCheck(admin, { imei, idempotencyKey: adminKey })
  assert.equal(adminFirst.status, 'completed')
  assert.equal(freeAppleQuota(admin).remaining, 2)
  assert.equal((await createImeiCheck(admin, { imei, idempotencyKey: adminKey })).id, adminFirst.id)
  assert.equal(calls, adminStartCalls + 1)
  const adminAttempts = await Promise.allSettled(Array.from({ length: 6 }, () => createImeiCheck(admin, { imei, idempotencyKey: randomUUID() })))
  assert.equal(adminAttempts.filter(result => result.status === 'fulfilled').length, 2)
  assert.equal(freeAppleQuota(admin).remaining, 0)
  assert.equal(calls, adminStartCalls + 3)
  await assert.rejects(createImeiCheck(admin, { imei, idempotencyKey: randomUUID() }), /3 free checks/)
  assert.equal(calls, adminStartCalls + 3)
  assert.deepEqual(db().prepare('SELECT account_type,credit_cents,held_cents FROM users WHERE id=?').get(admin), { account_type: 'admin', credit_cents: 1234, held_cents: 0 })

  // Unverified, paused, banned and unsupported accounts still cannot call the provider.
  for (const [index, state] of [
    { type: 'admin', status: 'active', verified: null, banned: null },
    { type: 'admin', status: 'paused', verified: '2026-01-01T00:00:00Z', banned: null },
    { type: 'admin', status: 'active', verified: '2026-01-01T00:00:00Z', banned: '2026-01-01T00:00:00Z' },
    { type: 'unsupported', status: 'active', verified: '2026-01-01T00:00:00Z', banned: null },
  ].entries()) {
    const denied = Number(db().prepare('INSERT INTO users(username,email,password_hash,status,account_type,email_verified_at,banned_at) VALUES (?,?,?,?,?,?,?)')
      .run('free-denied-' + index, 'denied-' + index + '@example.test', 'test', state.status, state.type, state.verified, state.banned).lastInsertRowid)
    await assert.rejects(createImeiCheck(denied, { imei }), /active verified account/)
    assert.equal(freeAppleQuota(denied).used, 0)
  }
  assert.equal(calls, adminStartCalls + 3)
  assert.deepEqual(db().prepare('SELECT count(*) AS n FROM credit_ledger').get(), { n: 0 })
  assert.deepEqual(db().prepare('SELECT count(*) AS n FROM invoices').get(), { n: 0 })
  assert.deepEqual(db().prepare('SELECT count(*) AS n FROM paid_report_orders').get(), { n: 0 })
  db().close()
})
