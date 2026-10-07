import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after } from 'node:test'

const work = mkdtempSync(join(tmpdir(), 'iunlockmobile-ads-test-'))
process.env.IUNLOCKMOBILE_DB = join(work, 'ads.sqlite')
// tsx runs this repository's tests as CJS: require after setting the DB path.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { db } = require('../lib/db') as typeof import('../lib/db')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { purchaseConversion } = require('../lib/purchase-conversion') as typeof import('../lib/purchase-conversion')
const connection = db()
connection.prepare(`INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)`).run('ads-fixture', 'ads-fixture@example.test', 'synthetic')
const userId = Number((connection.prepare('SELECT id FROM users WHERE username = ?').get('ads-fixture') as { id: number }).id)
const insert = connection.prepare(`INSERT INTO credit_ledger (user_id, amount_cents, type, ref_type, ref_id, balance_after_cents, created_at)
  VALUES (?, ?, ?, ?, ?, 0, ?)`)
const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

after(() => { connection.close(); rmSync(work, { recursive: true, force: true }) })

test('only a real matching charge can generate a purchase; top-ups/holds/refunds do not', () => {
  assert.equal(purchaseConversion(userId, 'order', 101, 150), null)
  insert.run(userId, 150, 'topup', 'invoice', '101', now)
  insert.run(userId, -150, 'hold', 'order', '101', now)
  insert.run(userId, 150, 'refund', 'order', '101', now)
  assert.equal(purchaseConversion(userId, 'order', 101, 150), null)
})

test('first charged purchase has its real USD value, non-PII ID and new_customer true', () => {
  insert.run(userId, -150, 'charge', 'order', '101', now)
  assert.deepEqual(purchaseConversion(userId, 'order', 101, 150), {
    transactionId: 'unlock-101', value: 1.5, currency: 'USD', newCustomer: true,
  })
  assert.equal(purchaseConversion(userId + 1, 'order', 101, 150), null)
  assert.equal(purchaseConversion(userId, 'order', 101, 151), null)
})

test('later report uses distinct transaction ID and is a returning customer', () => {
  insert.run(userId, -625, 'charge', 'paid_imei_report', '101', now)
  assert.deepEqual(purchaseConversion(userId, 'paid_imei_report', 101, 625), {
    transactionId: 'report-101', value: 6.25, currency: 'USD', newCustomer: false,
  })
})

test('historic purchase is not backfilled when revisited and still identifies returning customers', () => {
  connection.prepare("INSERT INTO users (username,email,password_hash) VALUES ('old-ads','old-ads@example.test','synthetic')").run()
  const oldUser = Number((connection.prepare("SELECT id FROM users WHERE username='old-ads'").get() as {id:number}).id)
  insert.run(oldUser, -999, 'charge', 'order', '2', '2026-10-06 00:00:00')
  assert.equal(purchaseConversion(oldUser, 'order', 2, 999), null)
  insert.run(oldUser, -320, 'charge', 'paid_imei_report', '4', now)
  assert.equal(purchaseConversion(oldUser, 'paid_imei_report', 4, 320)?.newCustomer, false)
})

test('source protects all completion points and no sitewide purchase snippet is duplicated', () => {
  const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
  const layout = read('app/layout.tsx')
  assert.match(layout, /gtag\/js\?id=/)
  assert.doesNotMatch(layout, /NzXJCKKYj5QdEOCzmuVE/)
  const event = read('components/google-ads-purchase-conversion.tsx')
  assert.match(event, /AW-18465855968\/NzXJCKKYj5QdEOCzmuVE/)
  assert.match(event, /transaction_id: purchase.transactionId/)
  assert.match(event, /new_customer: purchase.newCustomer/)
  for (const path of ['lib/orders.ts', 'lib/paid-reports.ts', 'app/(app)/user/orders/[id]/page.tsx']) {
    assert.match(read(path), /status === '(delivered|completed)'/)
    assert.match(read(path), /purchaseConversion/)
  }
  assert.match(read('components/paid-report-console.tsx'), /data\.report!\.status === 'completed'/)
})
