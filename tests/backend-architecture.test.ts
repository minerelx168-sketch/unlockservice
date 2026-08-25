import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'
import Database from 'better-sqlite3'

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-backend-'))
const databasePath = join(workDir, 'legacy.db')

process.env.IUNLOCKMOBILE_DB = databasePath
process.env.IUNLOCKMOBILE_USDT_BEP20_ADDRESS = '0x1111111111111111111111111111111111111111'
delete process.env.IUNLOCKMOBILE_REQUIRE_EMAIL_VERIFICATION

const legacy = new Database(databasePath)
legacy.exec(`
  CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    credit_cents INTEGER NOT NULL DEFAULT 0,
    held_cents INTEGER NOT NULL DEFAULT 0,
    account_type TEXT NOT NULL DEFAULT 'customer',
    membership_tier TEXT NOT NULL DEFAULT 'Newbie',
    parent_reseller_id INTEGER REFERENCES users(id),
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE invoices (
    reference TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    gateway TEXT NOT NULL,
    credit_amount_cents INTEGER NOT NULL,
    fee_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_due_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    payment_reference TEXT,
    note TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE credit_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    amount_cents INTEGER NOT NULL,
    type TEXT NOT NULL,
    ref_type TEXT,
    ref_id TEXT,
    balance_after_cents INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
legacy
  .prepare(
    `INSERT INTO users
       (username, email, password_hash, credit_cents, held_cents)
     VALUES ('legacy', 'legacy@example.test', 'scrypt$00$00', 10000, 2000)`,
  )
  .run()
legacy
  .prepare(
    `INSERT INTO users
       (username, email, password_hash, credit_cents, held_cents)
     VALUES ('legacy-no-ledger', 'legacy-no-ledger@example.test', 'scrypt$00$00', 777, 0)`,
  )
  .run()
legacy
  .prepare(
    `INSERT INTO credit_ledger
       (user_id, amount_cents, type, ref_type, ref_id, balance_after_cents)
     VALUES
       (1, 10000, 'topup', 'seed', 'legacy', 10000),
       (1, -2000, 'hold', 'order', 'legacy-order', 8000)`,
  )
  .run()
legacy
  .prepare(
    `INSERT INTO invoices
       (reference, user_id, gateway, credit_amount_cents, total_due_cents, status)
     VALUES ('legacy-invoice', 1, 'crypto_networks', 5000, 5100, 'pending')`,
  )
  .run()
legacy.close()

let auth: typeof import('../lib/auth')
let credits: typeof import('../lib/credits')
let payments: typeof import('../lib/payments')
let database: typeof import('../lib/db')

before(async () => {
  auth = await import('../lib/auth')
  credits = await import('../lib/credits')
  payments = await import('../lib/payments')
  database = await import('../lib/db')
})

after(() => {
  rmSync(workDir, { recursive: true, force: true })
})

test('additive migration preserves legacy user, invoice and escrow balance', () => {
  const connection = database.db()
  const legacyUser = auth.getUser(1)
  assert.equal(legacyUser?.email_verified_at !== null, true)

  const balance = credits.getBalance(1)
  assert.deepEqual(balance, { creditCents: 10000, heldCents: 2000, availableCents: 8000 })

  const ledger = credits.listLedger(1)
  assert.equal(ledger.find((row) => row.type === 'hold')?.affects_balance, 0)
  assert.equal(payments.getInvoice('legacy-invoice', 1)?.status, 'pending')
  assert.deepEqual(credits.getBalance(2), { creditCents: 777, heldCents: 0, availableCents: 777 })
  const openingEntry = connection
    .prepare(
      `SELECT amount_cents, type FROM credit_ledger
        WHERE user_id = 2 AND ref_type = 'migration' AND ref_id = 'imeihub-backend-v1-2'`,
    )
    .get() as { amount_cents: number; type: string }
  assert.deepEqual({ amount: openingEntry.amount_cents, type: openingEntry.type }, { amount: 777, type: 'adjustment' })
  const migration = connection
    .prepare("SELECT COUNT(*) AS count FROM schema_migrations WHERE version = '2026-08-imeihub-backend-v1'")
    .get() as { count: number }
  assert.equal(migration.count, 1)
})

test('registration creates a verified account when verification is disabled', async () => {
  const result = await auth.register('alice', 'Alice@Example.test', 'correct-horse-battery-staple')
  assert.equal(result.verificationRequired, false)
  assert.equal(result.user.email, 'alice@example.test')
  assert.ok(result.user.email_verified_at)

  const signedIn = auth.authenticate('alice@example.test', 'correct-horse-battery-staple')
  assert.equal(signedIn.id, result.user.id)
  assert.throws(() => auth.authenticate('alice@example.test', 'wrong-password'), auth.AuthError)
})

test('top-up settlement is idempotent and appends one balance-affecting ledger row', async () => {
  const user = auth.authenticate('alice', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'manual-usdt-bep20', 2500)
  payments.submitPaymentReference(invoice.reference, user.id, 'TX_REFERENCE_123456', 'integration test')

  const first = payments.settleTopUp(invoice.reference, 'provider-charge-1')
  const second = payments.settleTopUp(invoice.reference, 'provider-charge-1')
  assert.equal(first.creditedNow, true)
  assert.equal(second.creditedNow, false)
  assert.equal(credits.getBalance(user.id).creditCents, 2500)

  const count = database
    .db()
    .prepare(
      `SELECT COUNT(*) AS count FROM credit_ledger
        WHERE user_id = ? AND ref_type = 'topup_order' AND ref_id = ? AND type = 'topup'`,
    )
    .get(user.id, invoice.reference) as { count: number }
  assert.equal(count.count, 1)
})

test('escrow reserve, release and charge preserve owned-credit invariants', () => {
  const user = auth.authenticate('alice', 'correct-horse-battery-staple')

  const held = credits.hold(user.id, 1000, 'order', 'order-a')
  assert.deepEqual(held, { creditCents: 2500, heldCents: 1000, availableCents: 1500 })
  const released = credits.refund(user.id, 1000, 'order', 'order-a')
  assert.deepEqual(released, { creditCents: 2500, heldCents: 0, availableCents: 2500 })

  credits.hold(user.id, 1200, 'order', 'order-b')
  const charged = credits.charge(user.id, 1200, 'order', 'order-b')
  assert.deepEqual(charged, { creditCents: 1300, heldCents: 0, availableCents: 1300 })
  assert.deepEqual(credits.creditIntegrity(), { users: 3, mismatches: 0, invalidHolds: 0 })
})
