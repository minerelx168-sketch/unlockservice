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
  CREATE TABLE topup_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    credit_amount_cents INTEGER NOT NULL,
    fee_cents INTEGER NOT NULL DEFAULT 0,
    tax_cents INTEGER NOT NULL DEFAULT 0,
    total_due_cents INTEGER NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    status TEXT NOT NULL DEFAULT 'pending',
    provider TEXT NOT NULL,
    provider_charge_id TEXT,
    provider_payment_intent TEXT,
    idempotency_key TEXT NOT NULL UNIQUE,
    payment_reference TEXT,
    note TEXT,
    paid_at TEXT,
    credited_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`)
legacy
  .prepare(
    `INSERT INTO users (username, email, password_hash, credit_cents, held_cents)
     VALUES ('legacy', 'legacy@example.test', 'scrypt$00$00', 10000, 2000)`,
  )
  .run()
legacy
  .prepare(
    `INSERT INTO users (username, email, password_hash, credit_cents, held_cents)
     VALUES ('legacy-no-ledger', 'legacy-no-ledger@example.test', 'scrypt$00$00', 777, 0)`,
  )
  .run()
legacy
  .prepare(
    `INSERT INTO credit_ledger
       (user_id, amount_cents, type, ref_type, ref_id, balance_after_cents)
     VALUES
       (1, 10000, 'topup', 'invoice', 'legacy-paid', 10000),
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
legacy
  .prepare(
    `INSERT INTO topup_orders
       (public_id, user_id, credit_amount_cents, total_due_cents, status,
        provider, idempotency_key)
     VALUES ('imeihub-topup', 1, 3000, 3000, 'review',
             'crypto_networks', 'imeihub-key')`,
  )
  .run()
legacy.close()

let auth: typeof import('../lib/auth')
let accountSecurity: typeof import('../lib/account-security')
let credits: typeof import('../lib/credits')
let payments: typeof import('../lib/payments')
let database: typeof import('../lib/db')

before(async () => {
  auth = await import('../lib/auth')
  accountSecurity = await import('../lib/account-security')
  credits = await import('../lib/credits')
  payments = await import('../lib/payments')
  database = await import('../lib/db')
})

after(() => {
  rmSync(workDir, { recursive: true, force: true })
})

test('additive migration preserves original rows and imports imeihub top-ups as invoices', () => {
  const connection = database.db()
  const legacyUser = auth.getUser(1)
  assert.equal(legacyUser?.email_verified_at !== null, true)
  assert.deepEqual(credits.getBalance(1), { creditCents: 10000, heldCents: 2000, availableCents: 8000 })
  assert.deepEqual(credits.getBalance(2), { creditCents: 777, heldCents: 0, availableCents: 777 })

  const hold = connection
    .prepare("SELECT affects_balance FROM credit_ledger WHERE user_id = 1 AND type = 'hold'")
    .get() as { affects_balance: number }
  assert.equal(hold.affects_balance, 0)
  assert.equal(payments.getInvoice('legacy-invoice', 1)?.status, 'pending')
  assert.equal(payments.getInvoice('imeihub-topup', 1)?.status, 'review')

  const invoiceMetadata = connection
    .prepare('SELECT provider, idempotency_key FROM invoices WHERE reference = ?')
    .get('legacy-invoice') as { provider: string; idempotency_key: string }
  assert.deepEqual(
    { provider: invoiceMetadata.provider, idempotencyKey: invoiceMetadata.idempotency_key },
    { provider: 'crypto_networks', idempotencyKey: 'invoice-legacy-invoice' },
  )

  const migrations = connection
    .prepare('SELECT version FROM schema_migrations ORDER BY version')
    .all() as Array<{ version: string }>
  assert.deepEqual(
    migrations.map((row) => row.version),
    ['2026-08-imeihub-backend-v1', '2026-08-unlockservice-native-v2'],
  )
})

test('registration keeps the original User contract and normal sign-in flow', () => {
  const user = auth.register('alice', 'Alice@Example.test', 'correct-horse-battery-staple')
  assert.equal(user.email, 'alice@example.test')
  assert.ok(user.email_verified_at)

  const signedIn = auth.authenticate('alice@example.test', 'correct-horse-battery-staple')
  assert.equal(signedIn.id, user.id)
  assert.throws(() => auth.authenticate('alice@example.test', 'wrong-password'), auth.AuthError)
  assert.throws(() => auth.register('alice', 'other@example.test', 'correct-horse-battery-staple'), auth.AuthError)
})

test('verified accounts cannot use the verification endpoint as a passwordless login', () => {
  assert.throws(() => accountSecurity.verifyEmail('alice@example.test', '123456'), auth.AuthError)
})

test('invoice confirmation is idempotent and writes one invoice ledger effect', () => {
  const user = auth.authenticate('alice', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'crypto_networks', 2500)
  payments.submitPaymentReference(invoice.reference, user.id, 'TX_REFERENCE_123456', 'integration test')

  payments.approveInvoice(invoice.reference, user.id, 'provider-charge-1')
  const afterFirst = credits.getBalance(user.id)
  payments.approveInvoice(invoice.reference, user.id, 'provider-charge-1')
  const afterSecond = credits.getBalance(user.id)
  assert.equal(afterFirst.creditCents, 2500)
  assert.deepEqual(afterSecond, afterFirst)
  assert.equal(payments.getInvoice(invoice.reference, user.id)?.status, 'success')

  const count = database
    .db()
    .prepare(
      `SELECT COUNT(*) AS count FROM credit_ledger
        WHERE user_id = ? AND ref_type = 'invoice' AND ref_id = ? AND type = 'topup'`,
    )
    .get(user.id, invoice.reference) as { count: number }
  assert.equal(count.count, 1)
})

test('escrow hold, refund and charge preserve the original balance contract', () => {
  const user = auth.authenticate('alice', 'correct-horse-battery-staple')

  assert.deepEqual(credits.hold(user.id, 1000, 'order', 'order-a'), {
    creditCents: 2500,
    heldCents: 1000,
    availableCents: 1500,
  })
  assert.deepEqual(credits.refund(user.id, 1000, 'order', 'order-a'), {
    creditCents: 2500,
    heldCents: 0,
    availableCents: 2500,
  })

  credits.hold(user.id, 1200, 'order', 'order-b')
  assert.deepEqual(credits.charge(user.id, 1200, 'order', 'order-b'), {
    creditCents: 1300,
    heldCents: 0,
    availableCents: 1300,
  })
  assert.deepEqual(credits.creditIntegrity(), { users: 3, mismatches: 0, invalidHolds: 0 })
})
