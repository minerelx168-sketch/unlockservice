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
let admin: typeof import('../lib/admin')
let credits: typeof import('../lib/credits')
let payments: typeof import('../lib/payments')
let googleOAuth: typeof import('../lib/google-oauth')
let imeiChecks: typeof import('../lib/imei-checks')
let orders: typeof import('../lib/orders')
let providerApi: typeof import('../lib/provider-api')
let providerJobs: typeof import('../lib/provider-jobs')
let database: typeof import('../lib/db')

before(async () => {
  auth = await import('../lib/auth')
  accountSecurity = await import('../lib/account-security')
  admin = await import('../lib/admin')
  credits = await import('../lib/credits')
  payments = await import('../lib/payments')
  googleOAuth = await import('../lib/google-oauth')
  imeiChecks = await import('../lib/imei-checks')
  orders = await import('../lib/orders')
  providerApi = await import('../lib/provider-api')
  providerJobs = await import('../lib/provider-jobs')
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
    [
      '2026-08-google-oauth-v1',
      '2026-08-imei-check-v1',
      '2026-08-imeihub-backend-v1',
      '2026-08-provider-architecture-v1',
      '2026-08-unlockservice-native-v2',
      '2026-09-ledger-effect-uniqueness-v1',
    ],
  )

  const providerColumns = database
    .db()
    .prepare("SELECT name FROM pragma_table_info('imei_checks') WHERE name LIKE 'provider_%' ORDER BY name")
    .all() as Array<{ name: string }>
  assert.deepEqual(
    providerColumns.map((row) => row.name),
    [
      'provider_attempts',
      'provider_check_id',
      'provider_error_code',
      'provider_last_polled_at',
      'provider_mode',
      'provider_service_id',
    ],
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

test('security email uses the configured transactional sender and reply-to', async () => {
  process.env.RESEND_API_KEY = 'test-key'
  process.env.IUNLOCKMOBILE_EMAIL_FROM = 'iUnlockMobile <no-reply@auth.iunlockmobile.com>'
  process.env.IUNLOCKMOBILE_EMAIL_REPLY_TO = 'support@iunlockmobile.com'

  const originalFetch = globalThis.fetch
  let payload: Record<string, unknown> | undefined
  globalThis.fetch = async (_input, init) => {
    payload = JSON.parse(String(init?.body)) as Record<string, unknown>
    return new Response(JSON.stringify({ id: 'test-message' }), { status: 200 })
  }

  try {
    await accountSecurity.requestPasswordReset('alice@example.test')
    assert.equal(payload?.from, 'iUnlockMobile <no-reply@auth.iunlockmobile.com>')
    assert.equal(payload?.reply_to, 'support@iunlockmobile.com')
    assert.deepEqual(payload?.to, ['alice@example.test'])
  } finally {
    globalThis.fetch = originalFetch
    delete process.env.RESEND_API_KEY
    delete process.env.IUNLOCKMOBILE_EMAIL_FROM
    delete process.env.IUNLOCKMOBILE_EMAIL_REPLY_TO
  }
})

test('administrator access requires the explicit admin account type', () => {
  const user = auth.authenticate('alice', 'correct-horse-battery-staple')
  assert.equal(auth.hasAdminRole(user), false)

  database.db().prepare("UPDATE users SET account_type = 'admin' WHERE id = ?").run(user.id)
  const promoted = auth.getUser(user.id)!
  assert.equal(auth.hasAdminRole(promoted), true)

  const overview = admin.adminOverview()
  assert.equal(overview.admins, 1)
  assert.equal(admin.listAdminUsers().some((entry) => entry.id === user.id && entry.account_type === 'admin'), true)
})

test('Google OAuth creates protected authorization transactions and stable identity links', () => {
  process.env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com'
  process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
  process.env.GOOGLE_REDIRECT_URI = 'https://iunlockmobile.com/auth/google/callback'

  try {
    const start = googleOAuth.beginGoogleOAuth()
    const authorization = new URL(start.authorizationUrl)
    assert.equal(authorization.origin, 'https://accounts.google.com')
    assert.equal(authorization.searchParams.get('client_id'), process.env.GOOGLE_CLIENT_ID)
    assert.equal(authorization.searchParams.get('redirect_uri'), process.env.GOOGLE_REDIRECT_URI)
    assert.equal(authorization.searchParams.get('scope'), 'openid email profile')
    assert.equal(authorization.searchParams.get('code_challenge_method'), 'S256')
    assert.ok(authorization.searchParams.get('state'))
    assert.ok(authorization.searchParams.get('nonce'))
    assert.equal(googleOAuth.googleOAuthPublicUrl('/user/unlock').toString(), 'https://iunlockmobile.com/user/unlock')
    assert.equal(
      googleOAuth.googleOAuthPublicUrl('/login?oauth=failed').toString(),
      'https://iunlockmobile.com/login?oauth=failed',
    )
    assert.throws(() => googleOAuth.googleOAuthPublicUrl('//malicious.example'), auth.AuthError)

    const transaction = database
      .db()
      .prepare('SELECT state_hash, code_verifier, nonce, consumed_at FROM oauth_transactions WHERE id = ?')
      .get(start.transactionId) as {
      state_hash: string
      code_verifier: string
      nonce: string
      consumed_at: string | null
    }
    assert.notEqual(transaction.state_hash, authorization.searchParams.get('state'))
    assert.ok(transaction.code_verifier.length >= 43)
    assert.equal(transaction.nonce, authorization.searchParams.get('nonce'))
    assert.equal(transaction.consumed_at, null)

    const alice = auth.authenticate('alice', 'correct-horse-battery-staple')
    const linkedAlice = googleOAuth.linkGoogleIdentity({
      subject: 'google-alice-subject',
      email: 'alice@example.test',
      emailVerified: true,
    })
    assert.equal(linkedAlice.id, alice.id)
    assert.equal(linkedAlice.account_type, 'admin')

    const googleUser = googleOAuth.linkGoogleIdentity({
      subject: 'google-new-subject',
      email: 'new.google.user@example.test',
      emailVerified: true,
    })
    assert.equal(googleUser.email, 'new.google.user@example.test')
    assert.equal(googleUser.account_type, 'customer')
    assert.ok(googleUser.email_verified_at)
    assert.equal(
      googleOAuth.linkGoogleIdentity({
        subject: 'google-new-subject',
        email: 'new.google.user@example.test',
        emailVerified: true,
      }).id,
      googleUser.id,
    )
    assert.throws(
      () =>
        googleOAuth.linkGoogleIdentity({
          subject: 'different-google-subject',
          email: 'new.google.user@example.test',
          emailVerified: true,
        }),
      auth.AuthError,
    )
    assert.throws(
      () =>
        googleOAuth.linkGoogleIdentity({
          subject: 'unverified-subject',
          email: 'unverified@example.test',
          emailVerified: false,
        }),
      auth.AuthError,
    )
  } finally {
    delete process.env.GOOGLE_CLIENT_ID
    delete process.env.GOOGLE_CLIENT_SECRET
    delete process.env.GOOGLE_REDIRECT_URI
  }
})

test('free IMEI checks are repeatable, owner-scoped, and never touch credit', async () => {
  const user = auth.authenticate('alice', 'correct-horse-battery-staple')
  const before = credits.getBalance(user.id)

  const first = await imeiChecks.createImeiCheck(user.id, { imei: '490154203237518' })
  const repeat = await imeiChecks.createImeiCheck(user.id, { imei: '490154203237518' })
  const replay = await imeiChecks.createImeiCheck(user.id, {
    imei: '356938035643809',
    idempotencyKey: 'free-check-replay',
  })
  const replayAgain = await imeiChecks.createImeiCheck(user.id, {
    imei: '356938035643809',
    idempotencyKey: 'free-check-replay',
  })

  assert.equal(first.status, 'completed')
  assert.equal(first.result?.demo, true)
  assert.equal(first.maskedImei, '49·········7518')
  assert.equal('imei' in first, false)
  assert.notEqual(first.id, repeat.id)
  assert.equal(replay.id, replayAgain.id)
  assert.equal(imeiChecks.getImeiCheck(2, first.id), undefined)
  assert.equal(imeiChecks.listImeiChecks(user.id).length >= 3, true)
  assert.deepEqual(credits.getBalance(user.id), before)
  await assert.rejects(
    imeiChecks.createImeiCheck(user.id, { imei: '123456789012345' }),
    (error: unknown) => error instanceof imeiChecks.ImeiCheckError && error.code === 'imei_invalid',
  )
})

test('provider adapters normalize sync and DHRU flows without leaking secrets or bypassing credit invariants', async () => {
  const originalFetch = globalThis.fetch
  const saved = {
    mode: process.env.IUNLOCKMOBILE_PROVIDER_MODE,
    name: process.env.IUNLOCKMOBILE_PROVIDER_NAME,
    url: process.env.IUNLOCKMOBILE_PROVIDER_URL,
    apiKey: process.env.IUNLOCKMOBILE_PROVIDER_API_KEY,
    dhruKey: process.env.IUNLOCKMOBILE_PROVIDER_DHRU_KEY,
    username: process.env.IUNLOCKMOBILE_PROVIDER_USERNAME,
    unlockMap: process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP,
    imeiMap: process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP,
    maintenance: process.env.IUNLOCKMOBILE_MAINTENANCE,
  }

  try {
    process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
    process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'unlock-service'
    process.env.IUNLOCKMOBILE_PROVIDER_URL = 'https://provider.example/api'
    process.env.IUNLOCKMOBILE_PROVIDER_API_KEY = 'sync-secret-key'
    process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({
      'check:basic': { id: '343', mode: 'sync' },
    })

    globalThis.fetch = async (input) => {
      const url = new URL(String(input))
      assert.equal(url.origin, 'https://provider.example')
      assert.equal(url.searchParams.get('key'), 'sync-secret-key')
      return new Response(
        JSON.stringify({ status: true, response: '', object: { Brand: 'Apple', Model: 'iPhone' } }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      )
    }

    const alice = auth.authenticate('alice', 'correct-horse-battery-staple')
    const aliceCredit = credits.getBalance(alice.id)
    const syncCheck = await imeiChecks.createImeiCheck(alice.id, {
      imei: '490154203237518',
      idempotencyKey: 'provider-sync-check',
    })
    assert.equal(syncCheck.status, 'completed')
    assert.equal(syncCheck.provider, 'unlock-service')
    assert.equal(syncCheck.result?.Brand, 'Apple')
    assert.deepEqual(credits.getBalance(alice.id), aliceCredit)

    process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'dhru'
    process.env.IUNLOCKMOBILE_PROVIDER_DHRU_KEY = 'dhru-secret-key'
    process.env.IUNLOCKMOBILE_PROVIDER_USERNAME = 'provider-user'
    process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({
      'check:basic': { id: '900', mode: 'dhru' },
    })
    process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP = JSON.stringify({
      'carrier:103': { id: '901', mode: 'dhru' },
    })
    process.env.IUNLOCKMOBILE_MAINTENANCE = '0'

    let checkPlaced = false
    let orderPlaced = false
    globalThis.fetch = async (input) => {
      const url = new URL(String(input))
      assert.equal(url.searchParams.get('apiaccesskey'), 'dhru-secret-key')
      const action = url.searchParams.get('action')
      if (action === 'placeimeiorder' && url.searchParams.get('service') === '900') {
        checkPlaced = true
        return new Response(JSON.stringify({ SUCCESS: [{ REFERENCEID: 'dhru-check-1' }] }), { status: 200 })
      }
      if (action === 'placeimeiorder' && url.searchParams.get('service') === '901') {
        orderPlaced = true
        return new Response(JSON.stringify({ SUCCESS: [{ REFERENCEID: 'dhru-order-1' }] }), { status: 200 })
      }
      if (action === 'getimeiorder' && url.searchParams.get('id') === 'dhru-check-1') {
        return new Response(
          JSON.stringify({ SUCCESS: [{ STATUS: 'SUCCESS', REPLY: 'Brand: Apple\\nModel: iPhone 14' }] }),
          { status: 200 },
        )
      }
      if (action === 'getimeiorder' && url.searchParams.get('id') === 'dhru-order-1') {
        return new Response(
          JSON.stringify({ SUCCESS: [{ STATUS: 'SUCCESS', REPLY: 'Status: Unlocked\\nPermanent: Yes' }] }),
          { status: 200 },
        )
      }
      return new Response(JSON.stringify({ ERROR: [{ MESSAGE: 'unexpected request' }] }), { status: 400 })
    }

    const asyncCheck = await imeiChecks.createImeiCheck(alice.id, {
      imei: '356938035643809',
      idempotencyKey: 'provider-dhru-check',
    })
    assert.equal(checkPlaced, true)
    assert.equal(asyncCheck.status, 'processing')
    database
      .db()
      .prepare("UPDATE imei_checks SET provider_last_polled_at = datetime('now', '-1 minute') WHERE id = ?")
      .run(asyncCheck.id)
    const finishedCheck = await imeiChecks.pollImeiCheck(alice.id, asyncCheck.id)
    assert.equal(finishedCheck.status, 'completed')
    assert.equal(finishedCheck.result?.Brand, 'Apple')
    assert.deepEqual(credits.getBalance(alice.id), aliceCredit)

    const legacyBefore = credits.getBalance(1)
    const order = await orders.submitOrder(1, {
      kind: 'carrier_unlock',
      brandId: 1,
      carrierId: 103,
      imei: '490154203237518',
      email: 'legacy@example.test',
    })
    assert.equal(orderPlaced, true)
    assert.equal(order.status, 'processing')
    assert.equal(credits.getBalance(1).heldCents, legacyBefore.heldCents + order.priceCents)
    database
      .db()
      .prepare(
        "UPDATE orders SET provider_ready_at = datetime('now', '-1 minute'), provider_last_polled_at = datetime('now', '-1 minute') WHERE id = ?",
      )
      .run(order.orderId)
    const delivered = await orders.pollOrder(1, order.orderId)
    assert.equal(delivered.status, 'delivered')
    assert.equal(credits.getBalance(1).heldCents, legacyBefore.heldCents)
    assert.equal(credits.getBalance(1).creditCents, legacyBefore.creditCents - order.priceCents)

    const events = database
      .db()
      .prepare('SELECT metadata_json FROM provider_events ORDER BY id')
      .all() as Array<{ metadata_json: string | null }>
    assert.equal(events.length >= 4, true)
    const auditText = events.map((event) => event.metadata_json ?? '').join(' ')
    assert.equal(auditText.includes('sync-secret-key'), false)
    assert.equal(auditText.includes('dhru-secret-key'), false)
    assert.equal(auditText.includes('490154203237518'), false)
    assert.equal(auditText.includes('356938035643809'), false)

    process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'disabled'
    assert.equal(providerApi.providerConfiguration().enabled, false)
    assert.deepEqual(await providerJobs.pollProviderJobs(), {
      enabled: false,
      ordersSeen: 0,
      checksSeen: 0,
      completed: 0,
      unavailable: 0,
      processing: 0,
      errors: 0,
    })
  } finally {
    globalThis.fetch = originalFetch
    const restore = (key: string, value: string | undefined) => {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    restore('IUNLOCKMOBILE_PROVIDER_MODE', saved.mode)
    restore('IUNLOCKMOBILE_PROVIDER_NAME', saved.name)
    restore('IUNLOCKMOBILE_PROVIDER_URL', saved.url)
    restore('IUNLOCKMOBILE_PROVIDER_API_KEY', saved.apiKey)
    restore('IUNLOCKMOBILE_PROVIDER_DHRU_KEY', saved.dhruKey)
    restore('IUNLOCKMOBILE_PROVIDER_USERNAME', saved.username)
    restore('IUNLOCKMOBILE_UNLOCK_SERVICE_MAP', saved.unlockMap)
    restore('IUNLOCKMOBILE_IMEI_SERVICE_MAP', saved.imeiMap)
    restore('IUNLOCKMOBILE_MAINTENANCE', saved.maintenance)
  }
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
  assert.deepEqual(credits.creditIntegrity(), { users: 4, mismatches: 0, invalidHolds: 0 })
})

test('a replayed refund cannot release another order’s hold', () => {
  const user = auth.register('replay', 'replay@example.com', 'correct-horse-battery-staple')
  credits.credit(user.id, 10_000, 'topup', 'test', `seed-${user.id}`)

  credits.hold(user.id, 3_000, 'order', `${user.id}-a`)
  credits.hold(user.id, 3_000, 'order', `${user.id}-b`)
  credits.refund(user.id, 3_000, 'order', `${user.id}-b`)

  /* Before the effect index covered hold and refund, this second release was
     accepted and took order A's hold with it, leaving A unable ever to be
     charged. */
  assert.throws(
    () => credits.refund(user.id, 3_000, 'order', `${user.id}-b`),
    (error: unknown) => error instanceof credits.DuplicateLedgerEffect,
  )
  assert.throws(
    () => credits.hold(user.id, 3_000, 'order', `${user.id}-a`),
    (error: unknown) => error instanceof credits.DuplicateLedgerEffect,
  )

  assert.deepEqual(credits.getBalance(user.id), {
    creditCents: 10_000,
    heldCents: 3_000,
    availableCents: 7_000,
  })

  /* A still holds its own credit, so it can still settle. */
  credits.charge(user.id, 3_000, 'order', `${user.id}-a`)
  assert.deepEqual(credits.getBalance(user.id), {
    creditCents: 7_000,
    heldCents: 0,
    availableCents: 7_000,
  })
  assert.equal(credits.creditIntegrity().mismatches, 0)
  assert.equal(credits.creditIntegrity().invalidHolds, 0)
})

test('a failed hold leaves no order behind, and a resent order is not placed twice', async () => {
  const user = auth.register('atomic', 'atomic@example.com', 'correct-horse-battery-staple')
  const before = database
    .db()
    .prepare('SELECT COUNT(*) AS count FROM orders')
    .get() as { count: number }

  await assert.rejects(
    orders.submitOrder(user.id, {
      kind: 'carrier_unlock',
      brandId: 1,
      carrierId: 101,
      imei: '354909000000095',
      email: 'atomic@example.com',
    }),
    (error: unknown) => error instanceof orders.OrderError && error.code === 'insufficient_credit',
  )

  /* The row and its hold commit together, so a refused hold rolls the row
     back rather than leaving an orphan for the sweep to find. */
  const after = database
    .db()
    .prepare('SELECT COUNT(*) AS count FROM orders')
    .get() as { count: number }
  assert.equal(after.count, before.count)

  credits.credit(user.id, 50_000, 'topup', 'test', `atomic-${user.id}`)
  const key = `attempt-${user.id}-0001`
  const first = await orders.submitOrder(user.id, {
    kind: 'carrier_unlock',
    brandId: 1,
    carrierId: 101,
    imei: '354909000000095',
    email: 'atomic@example.com',
    idempotencyKey: key,
  })
  const resent = await orders.submitOrder(user.id, {
    kind: 'carrier_unlock',
    brandId: 1,
    carrierId: 101,
    imei: '354909000000095',
    email: 'atomic@example.com',
    idempotencyKey: key,
  })

  assert.equal(resent.orderId, first.orderId)
  const placed = database
    .db()
    .prepare('SELECT COUNT(*) AS count FROM orders WHERE user_id = ?')
    .get(user.id) as { count: number }
  assert.equal(placed.count, 1)
  assert.equal(credits.creditIntegrity().mismatches, 0)
})

test('only one settlement of an order moves money', async () => {
  const user = auth.register('settle', 'settle@example.com', 'correct-horse-battery-staple')
  credits.credit(user.id, 50_000, 'topup', 'test', `settle-${user.id}`)

  const placed = await orders.submitOrder(user.id, {
    kind: 'carrier_unlock',
    brandId: 1,
    carrierId: 101,
    imei: '354909000000095',
    email: 'settle@example.com',
  })
  assert.equal(placed.status, 'processing')

  /* The console polls while the sweep reads the same row, so both see
     `processing` before either settles. Only the poll that actually changes
     the status may charge. */
  database
    .db()
    .prepare("UPDATE orders SET provider_ready_at = datetime('now', '-1 minute') WHERE id = ?")
    .run(placed.orderId)
  const [a, b] = await Promise.all([
    orders.pollOrder(user.id, placed.orderId),
    orders.pollOrder(user.id, placed.orderId),
  ])

  assert.equal(a.status, 'delivered')
  assert.equal(b.status, 'delivered')
  const charges = database
    .db()
    .prepare(
      `SELECT COUNT(*) AS count FROM credit_ledger
        WHERE ref_type = 'order' AND ref_id = ? AND type = 'charge'`,
    )
    .get(String(placed.orderId)) as { count: number }
  assert.equal(charges.count, 1)

  const balance = credits.getBalance(user.id)
  assert.equal(balance.heldCents, 0)
  assert.equal(balance.creditCents, 50_000 - placed.priceCents)
  assert.equal(credits.creditIntegrity().mismatches, 0)
})

test('the production switches are closed unless they are opened by hand', async () => {
  const provider = await import('../lib/provider')
  const originalNodeEnv = process.env.NODE_ENV

  assert.equal(payments.selfApprovalEnabled(), false, 'self-approval is off without the flag')
  process.env.IUNLOCKMOBILE_ALLOW_SELF_APPROVE = '1'
  assert.equal(payments.selfApprovalEnabled(), true)

  /* An unset NODE_ENV used to read as "not production" and hand every account
     the ability to confirm its own invoice. A missing variable means off. */
  delete process.env.NODE_ENV
  assert.equal(payments.selfApprovalEnabled(), true, 'still opt-in, not inferred')
  delete process.env.IUNLOCKMOBILE_ALLOW_SELF_APPROVE
  assert.equal(payments.selfApprovalEnabled(), false)

  Object.assign(process.env, { NODE_ENV: 'production' })
  process.env.IUNLOCKMOBILE_ALLOW_SELF_APPROVE = '1'
  assert.equal(payments.selfApprovalEnabled(), false, 'production never self-approves')
  delete process.env.IUNLOCKMOBILE_ALLOW_SELF_APPROVE

  /* The mock invents unlock codes, and the pipeline charges for them either
     way, so production refuses to hand it back at all. */
  assert.throws(() => provider.activeSupplier(), /no supplier is configured/)

  const user = auth.authenticate('alice', 'correct-horse-battery-staple')
  const heldBefore = credits.getBalance(user.id).heldCents
  const ordersBefore = database.db().prepare('SELECT COUNT(*) AS count FROM orders').get() as {
    count: number
  }
  await assert.rejects(
    orders.submitOrder(user.id, {
      kind: 'carrier_unlock',
      brandId: 1,
      carrierId: 101,
      imei: '354909000000095',
      email: 'alice@example.com',
    }),
    (error: unknown) => error instanceof orders.OrderError && error.code === 'supplier_unconfigured',
  )
  const ordersAfter = database.db().prepare('SELECT COUNT(*) AS count FROM orders').get() as {
    count: number
  }
  assert.equal(ordersAfter.count, ordersBefore.count, 'no order is left held against no supplier')
  assert.equal(credits.getBalance(user.id).heldCents, heldBefore)

  /* An HMAC keyed with a constant from the source is reversible over the
     million serials behind a known TAC, so production needs a real key. */
  await assert.rejects(
    imeiChecks.createImeiCheck(user.id, { imei: '354909000000095' }),
    (error: unknown) =>
      error instanceof imeiChecks.ImeiCheckError && error.code === 'provider_not_ready',
  )

  if (originalNodeEnv === undefined) delete process.env.NODE_ENV
  else Object.assign(process.env, { NODE_ENV: originalNodeEnv })
})
