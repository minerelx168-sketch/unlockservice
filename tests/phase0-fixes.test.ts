import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after } from 'node:test'

const dir = mkdtempSync(join(tmpdir(), 'phase0-fixes-'))
Object.assign(process.env, { IUNLOCKMOBILE_DB: join(dir, 'test.db'), INTERNAL_IPS: '27.130.36.101' })
after(() => rmSync(dir, { recursive: true, force: true }))
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('unknown margin sends value 0, never the sale amount', async () => {
  const { marginCents } = await import('../lib/service-margins')
  assert.deepEqual(marginCents(null, 499), { valueCents: 0, known: false })
  assert.deepEqual(marginCents('424242', 499), { valueCents: 0, known: false })
})

test('INTERNAL_IPS matches the address Caddy forwards (X-Forwarded-For) and X-Real-IP once set', async () => {
  const { clientIp, isInternalIp } = await import('../lib/ga4')
  assert.equal(isInternalIp(clientIp(new Headers({ 'x-forwarded-for': '27.130.36.101' }))), true)
  assert.equal(isInternalIp(clientIp(new Headers({ 'x-real-ip': '27.130.36.101', 'x-forwarded-for': '8.8.8.8' }))), true)
  assert.equal(isInternalIp(clientIp(new Headers({ 'x-forwarded-for': '8.8.8.8' }))), false)
  assert.match(read('deploy/Caddyfile'), /header_up X-Real-IP \{remote_host\}/)
  assert.match(read('lib/checkout-context-request.ts'), /clientIp\(await headers\(\)\)/)
  assert.match(read('app/layout.tsx'), /!isInternalIp\(clientIp\(requestHeaders\)\)/)
})

test('failed, refunded, disputed, sandbox and zero-amount payments are recorded as skipped with a reason', async () => {
  const { db } = await import('../lib/db')
  const { recordUnsentPayments } = await import('../lib/ga4')
  const user = Number(db().prepare("INSERT INTO users(username,email,password_hash) VALUES('c','c@example.test','x')").run().lastInsertRowid)
  const invoice = (ref: string, status: string, cents = 100, env: string | null = 'live', reversed = 0, review: string | null = null) => {
    db().prepare("INSERT INTO invoices(reference,user_id,gateway,credit_amount_cents,total_due_cents,status,credited_at,updated_at) VALUES(?,?,'whop_card',?,?,?,datetime('now'),datetime('now'))").run(ref, user, cents, cents, status)
    if (env) db().prepare("INSERT INTO whop_topups(invoice_reference,user_id,request_key,account_id,product_id,environment,reversed_cents,review_reason) VALUES(?,?,?,'b','p',?,?,?)").run(ref, user, ref, env, reversed, review)
  }
  invoice('a'.repeat(32), 'failed'); invoice('b'.repeat(32), 'refunded'); invoice('c'.repeat(32), 'success', 100, 'sandbox')
  invoice('d'.repeat(32), 'review', 100, 'live', 0, 'dispute'); invoice('e'.repeat(32), 'success', 100, 'live')
  invoice('f'.repeat(32), 'review', 100, 'live', 0, 'payment_amount_mismatch')
  const guest = (ref: string, state: string, review: string | null, env = 'live') => db().prepare(`INSERT INTO guest_checkouts(reference,request_key,email,product_code,product_name,imei_encrypted,price_cents,fee_cents,account_id,product_id,environment,state,review_reason,paid_at)
    VALUES(?,?,'g@example.test','UNLOCK_718','x','e',499,25,'b','p',?,?,?,datetime('now'))`).run(ref, ref, env, state, review)
  guest('1'.repeat(32), 'refunded', null); guest('2'.repeat(32), 'paid', 'dispute'); guest('3'.repeat(32), 'paid', null, 'sandbox'); guest('4'.repeat(32), 'paid', null)
  recordUnsentPayments('2000-01-01 00:00:00')
  const rows = Object.fromEntries((db().prepare('SELECT transaction_id,reason FROM ga4_events_sent').all() as { transaction_id: string; reason: string }[]).map((r) => [r.transaction_id, r.reason]))
  assert.deepEqual(rows, {
    [`topup-${'a'.repeat(32)}`]: 'payment_failed', [`topup-${'b'.repeat(32)}`]: 'refunded', [`topup-${'c'.repeat(32)}`]: 'test_environment',
    [`topup-${'d'.repeat(32)}`]: 'chargeback', [`guest-${'1'.repeat(32)}`]: 'refunded', [`guest-${'2'.repeat(32)}`]: 'chargeback', [`guest-${'3'.repeat(32)}`]: 'test_environment',
  }, 'eligible payments and undecided reviews are left for the senders')
})

test('credit that never came from a real payment is test credit', async () => {
  const { db } = await import('../lib/db')
  const { fundedByTestCredit } = await import('../lib/ga4')
  const { credit } = await import('../lib/credits')
  const gifted = Number(db().prepare("INSERT INTO users(username,email,password_hash) VALUES('gift','gift@example.test','x')").run().lastInsertRowid)
  credit(gifted, 1000, 'adjustment', 'admin_adjustment', 'gift-1')
  const charge = Number(db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,-499,'charge','paid_imei_report','1',501)").run(gifted).lastInsertRowid)
  assert.equal(fundedByTestCredit(gifted, charge, 499), true)
  const paying = Number(db().prepare("INSERT INTO users(username,email,password_hash) VALUES('pay','pay@example.test','x')").run().lastInsertRowid)
  db().prepare("INSERT INTO invoices(reference,user_id,gateway,credit_amount_cents,total_due_cents,status) VALUES(?,?,'bsc_usdt',1000,1000,'success')").run('9'.repeat(32), paying)
  credit(paying, 1000, 'topup', 'invoice', '9'.repeat(32))
  const real = Number(db().prepare("INSERT INTO credit_ledger(user_id,amount_cents,type,ref_type,ref_id,balance_after_cents) VALUES(?,-499,'charge','paid_imei_report','2',501)").run(paying).lastInsertRowid)
  assert.equal(fundedByTestCredit(paying, real, 499), false)
  assert.match(read('lib/purchase-analytics.ts'), /'test_credit'/)
})

test('payment_completed leaves right after the Whop webhook, and the poll timer reads the web env too', () => {
  assert.match(read('app/api/webhooks/whop/route.ts'), /await deliverPaymentAnalytics\(5\)/)
  const poll = read('deploy/unlockservice-poll.service')
  assert.ok(poll.indexOf('EnvironmentFile=-/etc/iunlockmobile.env') >= 0 && poll.indexOf('EnvironmentFile=-/etc/iunlockmobile.env') < poll.indexOf('EnvironmentFile=/etc/unlockservice.env'))
})
