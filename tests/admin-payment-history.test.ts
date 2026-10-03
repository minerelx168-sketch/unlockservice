import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'

const directory = mkdtempSync(join(tmpdir(), 'iunlockmobile-admin-payments-'))
process.env.IUNLOCKMOBILE_DB = join(directory, 'payments.db')
after(() => rmSync(directory, { recursive: true, force: true }))

let database: ReturnType<typeof import('../lib/db').db>
let history: typeof import('../lib/admin-payment-history')

before(async () => {
  const { db } = await import('../lib/db')
  history = await import('../lib/admin-payment-history')
  database = db()
  database.prepare("INSERT INTO users (username,email,password_hash) VALUES ('samplecustomer','sample@example.test','unused-test-hash')").run()
  const userId = (database.prepare('SELECT id FROM users WHERE username = ?').get('samplecustomer') as { id: number }).id
  const insert = database.prepare(
  `INSERT INTO invoices (reference,user_id,gateway,credit_amount_cents,total_due_cents,status,
                         payment_route_id,payment_network_id,payment_asset_code,paid_at,credited_at,created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
)
  for (let i = 1; i <= 32; i++) {
    insert.run(
    i.toString(16).padStart(32, '0'), userId, 'usdt-trc20', i === 1 ? 250 : 150,
    i === 1 ? 250 : 150, i === 1 ? 'success' : 'pending',
    'usdt-trc20', 'tron-mainnet', 'USDT',
    i === 1 ? '2026-10-03T01:00:00.000Z' : null,
    i === 1 ? '2026-10-03T01:00:00.000Z' : null,
    `2026-10-03 01:${String(i).padStart(2, '0')}:00`,
    )
  }
  database.prepare(
    `INSERT INTO invoice_verifications
     (invoice_reference,chain_id,token_contract,token_decimals,destination_address,tx_hash,status)
   VALUES (?,?,?,?,?,?,?)`,
  ).run('00000000000000000000000000000002', 1, 'test-contract', 6, 'test-address', 'test-tx-hash', 'submitted')
})

test('admin payment history is bounded, sorted, and joined with verification state without raw transaction identifiers', () => {
  const first = history.listAdminPaymentHistory()
  assert.equal(history.ADMIN_PAYMENT_PAGE_SIZE, 25)
  assert.equal(first.total, 32)
  assert.equal(first.pageCount, 2)
  assert.equal(first.rows.length, 25)
  assert.equal(first.rows[0].reference, '00000000000000000000000000000020')
  assert.equal(first.rows[0].username, 'samplecustomer')
  assert.equal(Object.hasOwn(first.rows[0], 'tx_hash'), false)
  assert.equal(Object.hasOwn(first.rows[0], 'payment_destination_address'), false)
  const second = history.listAdminPaymentHistory({ page: 999999 })
  assert.equal(second.page, 2)
  assert.equal(second.rows.length, 7)
})

test('filters and exact reference search report payment status without changing data', () => {
  assert.equal(history.listAdminPaymentHistory({ filter: 'open' }).total, 31)
  assert.equal(history.listAdminPaymentHistory({ filter: 'success' }).total, 1)
  assert.equal(history.listAdminPaymentHistory({ filter: 'closed' }).total, 0)
  const verified = history.listAdminPaymentHistory({ reference: '00000000000000000000000000000001' })
  assert.equal(verified.total, 1)
  assert.equal(verified.rows[0].status, 'success')
  assert.ok(verified.rows[0].credited_at)
  const checking = history.listAdminPaymentHistory({ reference: '00000000000000000000000000000002' })
  assert.equal(checking.rows[0].verification_status, 'submitted')
  const invalid = history.listAdminPaymentHistory({ reference: "' OR 1=1 --" })
  assert.equal(invalid.invalidReference, true)
  assert.equal(invalid.rows.length, 0)
  assert.equal(invalid.total, 0)
  assert.deepEqual(history.adminPaymentSummary(), { requests: 32, open: 31, verified: 1, creditedCents: 250 })
  assert.equal((database.prepare('SELECT COUNT(*) AS total FROM invoices').get() as { total: number }).total, 32)
})
