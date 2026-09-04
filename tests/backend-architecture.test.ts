import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
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
let adminCreditAdjustments: typeof import('../lib/admin-credit-adjustments')
let credits: typeof import('../lib/credits')
let payments: typeof import('../lib/payments')
let googleOAuth: typeof import('../lib/google-oauth')
let imeiChecks: typeof import('../lib/imei-checks')
let paidReports: typeof import('../lib/paid-reports')
let providerProducts: typeof import('../lib/provider-products')
let orders: typeof import('../lib/orders')
let providerApi: typeof import('../lib/provider-api')
let providerJobs: typeof import('../lib/provider-jobs')
let database: typeof import('../lib/db')

before(async () => {
  auth = await import('../lib/auth')
  accountSecurity = await import('../lib/account-security')
  admin = await import('../lib/admin')
  adminCreditAdjustments = await import('../lib/admin-credit-adjustments')
  credits = await import('../lib/credits')
  payments = await import('../lib/payments')
  googleOAuth = await import('../lib/google-oauth')
  imeiChecks = await import('../lib/imei-checks')
  paidReports = await import('../lib/paid-reports')
  providerProducts = await import('../lib/provider-products')
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
      '2026-09-admin-credit-adjustments-v1',
      '2026-09-paid-imei-reports-v1',
      '2026-09-provider-product-catalog-v2',
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

test('provider product catalog publishes only reviewed products and keeps activation fail-closed', () => {
  assert.equal(providerProducts.PROVIDER_PRODUCTS.length, 130)
  assert.equal(providerProducts.PUBLIC_PROVIDER_PRODUCTS.length, 109)
  assert.equal(providerProducts.AVAILABLE_PROVIDER_PRODUCTS.length, 25)
  assert.equal(providerProducts.COMING_SOON_PROVIDER_PRODUCTS.length, 84)
  assert.equal(providerProducts.REPRICE_PROVIDER_PRODUCTS.length, 13)
  assert.equal(providerProducts.RESTRICTED_PROVIDER_PRODUCTS.length, 8)
  assert.equal(new Set(providerProducts.PROVIDER_PRODUCTS.map((product) => product.productCode)).size, 130)
  assert.partialDeepStrictEqual(
    providerProducts.providerProductByCode('CHECK_988'),
    {
      serviceId: '988',
      status: 'hidden_reprice',
      priceCents: 0,
      providerCostMicros: 20_000,
    },
  )
  assert.equal(
    providerProducts.PUBLIC_PROVIDER_PRODUCTS.filter((product) => product.domain === 'unlock').length,
    55,
  )
  assert.equal(
    providerProducts.AVAILABLE_PROVIDER_PRODUCTS.every((product) =>
      product.domain === 'imei_check'
      && product.inputType === 'imei'
      && product.priceCents * 10_000 > product.providerCostMicros,
    ),
    true,
  )

  const paidRows = database.db()
    .prepare('SELECT COUNT(*) AS total, SUM(is_active) AS active FROM paid_report_products')
    .get() as { total: number; active: number }
  assert.deepEqual(paidRows, { total: 25, active: 25 })
})

test('Signal Blue services hub keeps Unlock and Phone Check catalogs on separate routes', () => {
  const tokens = readFileSync(join(process.cwd(), 'styles/tokens.css'), 'utf8')
  const buttons = readFileSync(join(process.cwd(), 'styles/components.css'), 'utf8')
  const appStyles = readFileSync(join(process.cwd(), 'styles/app.css'), 'utf8')
  const header = readFileSync(join(process.cwd(), 'components/site-header.tsx'), 'utf8')
  const catalog = readFileSync(join(process.cwd(), 'components/product-catalog.tsx'), 'utf8')
  const paidReportConsole = readFileSync(join(process.cwd(), 'components/paid-report-console.tsx'), 'utf8')
  const customerProducts = readFileSync(join(process.cwd(), 'lib/customer-provider-products.ts'), 'utf8')
  const servicesHub = readFileSync(join(process.cwd(), 'app/(marketing)/services/page.tsx'), 'utf8')
  const imeiPage = readFileSync(join(process.cwd(), 'app/(marketing)/services/imei-check/page.tsx'), 'utf8')
  const unlockPage = readFileSync(join(process.cwd(), 'app/(marketing)/services/unlock/page.tsx'), 'utf8')
  const basicCheckPage = readFileSync(join(process.cwd(), 'app/(marketing)/check/page.tsx'), 'utf8')
  const basicCheckForm = readFileSync(join(process.cwd(), 'components/imei-check-form.tsx'), 'utf8')

  assert.match(tokens, /--primary:\s*#0057b8/)
  assert.match(tokens, /--primary-dark:\s*#003f87/)
  assert.match(tokens, /--primary-soft:\s*#e8f2ff/)
  assert.match(buttons, /\.button--secondary/)
  assert.match(header, /href: '\/services\/unlock', label: 'Unlock Service'/)
  assert.match(header, /href: '\/services\/imei-check', label: 'Phone Check'/)
  assert.match(header, /className="button button--primary" href="\/services"/)

  assert.match(servicesHub, /href="\/services\/imei-check"/)
  assert.match(servicesHub, /href="\/services\/unlock"/)
  assert.doesNotMatch(servicesHub, /<ProductCatalog/)
  assert.match(imeiPage, /products=\{CUSTOMER_IMEI_CHECK_PRODUCTS\} domain="imei_check"/)
  assert.doesNotMatch(imeiPage, /CUSTOMER_UNLOCK_PRODUCTS/)
  assert.match(unlockPage, /products=\{CUSTOMER_UNLOCK_PRODUCTS\} domain="unlock"/)
  assert.match(unlockPage, /<h1 className="t-display">Unlock Service\.<\/h1>/)
  assert.doesNotMatch(unlockPage, /CUSTOMER_IMEI_CHECK_PRODUCTS/)
  assert.match(imeiPage, /<h1 className="t-display">Phone Check\.<\/h1>/)
  assert.match(basicCheckPage, /Basic IMEI validation/)
  assert.doesNotMatch(basicCheckPage, /Free IMEI check/i)
  assert.match(basicCheckForm, /Choose a paid Phone Check/)
  assert.doesNotMatch(basicCheckForm, /Provider data will be added/)
  assert.match(customerProducts, /product\.domain === 'imei_check'/)
  assert.match(customerProducts, /product\.domain === 'unlock'/)

  assert.match(catalog, /domain: ProviderProductDomain/)
  assert.match(catalog, /id=\{`\$\{domain\}-product-group`\}/)
  assert.match(catalog, /product-subcategory-list/)
  assert.match(catalog, /customerText\(product\.name\)/)
  assert.match(catalog, /formatUsd\(product\.priceCents\)/)
  assert.match(catalog, /Choose report/)
  assert.doesNotMatch(catalog, /Estimated delivery/)
  assert.doesNotMatch(catalog, /product\.etaLabel/)
  assert.doesNotMatch(catalog, /Provider ID/)
  assert.doesNotMatch(catalog, /product\.serviceId/)
  assert.doesNotMatch(catalog, /⭐|🌟|✅|🔍|🔒/u)
  assert.match(paidReportConsole, /function reviewOrder/)
  assert.match(paidReportConsole, /setReviewing\(true\)/)
  assert.match(paidReportConsole, /Estimated delivery/)
  assert.match(paidReportConsole, /Confirm and order/)
  const reviewFunction = paidReportConsole.slice(
    paidReportConsole.indexOf('function reviewOrder'),
    paidReportConsole.indexOf('async function confirmOrder'),
  )
  assert.doesNotMatch(reviewFunction, /post\(|idempotencyKey|crypto\.randomUUID/)
  const confirmFunction = paidReportConsole.slice(
    paidReportConsole.indexOf('async function confirmOrder'),
    paidReportConsole.indexOf('async function refreshStatus'),
  )
  assert.match(confirmFunction, /post\('\/api\/imei\/reports'/)
  assert.match(confirmFunction, /crypto\.randomUUID\(\)/)
  assert.match(customerProducts, /Extended_Pictographic/)
  assert.doesNotMatch(customerProducts, /⭐|🌟|✅|🔍|🔒/u)
  assert.match(appStyles, /\.service-hub-grid\s*\{[^}]*grid-template-columns:\s*repeat\(2/s)
  assert.match(appStyles, /\.product-subcategory-list\s*\{[^}]*gap:\s*52px/s)
  assert.match(appStyles, /\.product-card-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3/s)
  assert.match(appStyles, /\.product-card\s*\{[^}]*gap:\s*14px[^}]*padding:\s*20px/s)
  assert.match(appStyles, /\.product-card-action\s*\{[^}]*min-height:\s*46px/s)
  assert.match(appStyles, /\.order-review-actions\s*\{[^}]*grid-template-columns:/s)
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

test('administrator credit adjustments are RBAC-only, idempotent, append-only and ledger-safe', () => {
  const administrator = auth.authenticate('alice', 'correct-horse-battery-staple')
  const target = auth.getUser(2)!
  const before = credits.getBalance(target.id)

  assert.throws(
    () => adminCreditAdjustments.adjustUserCredit(1, {
      targetUserId: target.id,
      amountCents: 250,
      reason: 'Approved support correction',
      idempotencyKey: 'admin-credit-non-admin',
    }),
    (error: unknown) => error instanceof adminCreditAdjustments.AdminCreditAdjustmentError && error.code === 'forbidden',
  )

  const added = adminCreditAdjustments.adjustUserCredit(administrator.id, {
    targetUserId: target.id,
    amountCents: 250,
    reason: 'Approved support correction',
    idempotencyKey: 'admin-credit-add-001',
  })
  assert.equal(added.replayed, false)
  assert.equal(added.adjustment.amount_cents, 250)
  assert.equal(added.balance.creditCents, before.creditCents + 250)
  assert.equal(added.balance.heldCents, before.heldCents)

  const replay = adminCreditAdjustments.adjustUserCredit(administrator.id, {
    targetUserId: target.id,
    amountCents: 250,
    reason: 'Approved support correction',
    idempotencyKey: 'admin-credit-add-001',
  })
  assert.equal(replay.replayed, true)
  assert.equal(replay.adjustment.public_id, added.adjustment.public_id)
  assert.equal(credits.getBalance(target.id).creditCents, before.creditCents + 250)

  assert.throws(
    () => adminCreditAdjustments.adjustUserCredit(administrator.id, {
      targetUserId: target.id,
      amountCents: 300,
      reason: 'Different amount on replay',
      idempotencyKey: 'admin-credit-add-001',
    }),
    (error: unknown) => error instanceof adminCreditAdjustments.AdminCreditAdjustmentError && error.code === 'idempotency_conflict',
  )

  const removed = adminCreditAdjustments.adjustUserCredit(administrator.id, {
    targetUserId: target.id,
    amountCents: -100,
    reason: 'Reverse duplicate goodwill amount',
    idempotencyKey: 'admin-credit-remove-001',
  })
  assert.equal(removed.balance.creditCents, before.creditCents + 150)

  assert.throws(
    () => adminCreditAdjustments.adjustUserCredit(administrator.id, {
      targetUserId: 1,
      amountCents: -9_000,
      reason: 'Must not consume held order funds',
      idempotencyKey: 'admin-credit-held-001',
    }),
    (error: unknown) => error instanceof adminCreditAdjustments.AdminCreditAdjustmentError && error.code === 'held_credit_conflict',
  )
  assert.deepEqual(credits.getBalance(1), { creditCents: 10_000, heldCents: 2_000, availableCents: 8_000 })

  assert.throws(
    () => adminCreditAdjustments.adjustUserCredit(administrator.id, {
      targetUserId: target.id,
      amountCents: 0,
      reason: 'Zero is invalid',
      idempotencyKey: 'admin-credit-zero-001',
    }),
    (error: unknown) => error instanceof adminCreditAdjustments.AdminCreditAdjustmentError && error.code === 'invalid_amount',
  )
  assert.throws(
    () => adminCreditAdjustments.adjustUserCredit(administrator.id, {
      targetUserId: target.id,
      amountCents: 100,
      reason: 'short',
      idempotencyKey: 'admin-credit-reason-001',
    }),
    (error: unknown) => error instanceof adminCreditAdjustments.AdminCreditAdjustmentError && error.code === 'invalid_reason',
  )

  const auditCount = database.db()
    .prepare('SELECT COUNT(*) AS count FROM admin_credit_adjustments')
    .get() as { count: number }
  assert.equal(auditCount.count, 2)
  const ledger = database.db()
    .prepare("SELECT amount_cents, type, ref_type, ref_id FROM credit_ledger WHERE ref_type = 'admin_credit_adjustment' ORDER BY id")
    .all() as Array<{ amount_cents: number; type: string; ref_type: string; ref_id: string }>
  assert.deepEqual(ledger.map((row) => [row.amount_cents, row.type]), [[250, 'adjustment'], [-100, 'adjustment']])
  assert.equal(ledger[0]?.ref_id, added.adjustment.public_id)
  assert.equal(ledger[1]?.ref_id, removed.adjustment.public_id)

  assert.throws(
    () => database.db().prepare('UPDATE admin_credit_adjustments SET reason = ? WHERE public_id = ?').run('Tampered reason', added.adjustment.public_id),
    /append-only/,
  )
  assert.throws(
    () => database.db().prepare('DELETE FROM admin_credit_adjustments WHERE public_id = ?').run(added.adjustment.public_id),
    /append-only/,
  )
  assert.equal(adminCreditAdjustments.listAdminCreditAdjustments().length, 2)
  assert.deepEqual(credits.creditIntegrity(), { users: 3, mismatches: 0, invalidHolds: 0 })

  const routeSource = readFileSync(join(process.cwd(), 'app/api/admin/credit-adjustments/route.ts'), 'utf8')
  assert.match(routeSource, /await guard\(request\)/)
  assert.match(routeSource, /hasAdminRole\(found\.user\)/)
  assert.match(routeSource, /adjustUserCredit\(found\.user\.id/)
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

    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input))
      assert.equal(url.origin, 'https://provider.example')
      assert.equal(url.searchParams.get('key'), null)
      assert.equal(url.searchParams.get('imei'), null)
      assert.equal(init?.method, 'POST')
      const body = new URLSearchParams(String(init?.body))
      assert.equal(body.get('key'), 'sync-secret-key')
      assert.equal(body.get('service'), '343')
      assert.equal(body.get('imei'), '490154203237518')
      return new Response(
        JSON.stringify({
          success: true,
          response: 'Model: iPhone 15\\nBlacklist Status: Clean',
          object: [{
            Brand: 'Apple',
            Model: 'iPhone 15',
            IMEI: '490154203237518',
            'Serial Number': 'SERIAL-SECRET-1234',
            blacklistStatus: 'Clean',
            unknownProviderField: 'not public',
          }],
        }),
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
    assert.equal(syncCheck.result?.schemaVersion, 1)
    assert.match(String(syncCheck.result?.title), /iPhone 15/i)
    const storedSyncReport = JSON.stringify(syncCheck.result)
    assert.equal(storedSyncReport.includes('490154203237518'), false)
    assert.equal(storedSyncReport.includes('SERIAL-SECRET-1234'), false)
    assert.equal(storedSyncReport.includes('not public'), false)
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
    assert.equal(finishedCheck.result?.schemaVersion, 1)
    assert.match(String(finishedCheck.result?.title), /iPhone 14/i)
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

test('paid IMEI reports stay separate from free checks and preserve escrow, privacy and idempotency', async () => {
  const originalFetch = globalThis.fetch
  const saved = {
    mode: process.env.IUNLOCKMOBILE_PROVIDER_MODE,
    name: process.env.IUNLOCKMOBILE_PROVIDER_NAME,
    url: process.env.IUNLOCKMOBILE_PROVIDER_URL,
    apiKey: process.env.IUNLOCKMOBILE_PROVIDER_API_KEY,
    imeiMap: process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP,
  }

  const restore = (key: string, value: string | undefined) => {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }

  try {
    const connection = database.db()
    const alice = auth.authenticate('alice', 'correct-horse-battery-staple')
    const startingAliceBalance = credits.getBalance(alice.id)
    const freeChecksBefore = imeiChecks.listImeiChecks(alice.id).length

    const activeCatalog = paidReports.listPaidReportProducts()
    assert.equal(activeCatalog.length, 25)
    assert.equal(activeCatalog.every((product) => product.isActive), true)
    assert.equal(activeCatalog.every((product) => !product.providerReady), true)
    const seeded = paidReports.getPaidReportProduct('APPLE_BASIC')
    assert.equal(seeded?.isActive, true)
    assert.equal(seeded?.priceCents, 5)

    process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'disabled'
    await assert.rejects(
      paidReports.createPaidReport(alice.id, {
        productCode: 'APPLE_BASIC',
        imei: '490154203237518',
        idempotencyKey: 'paid-disabled',
      }),
      (error: unknown) => error instanceof paidReports.PaidReportError && error.code === 'provider_not_ready',
    )
    assert.equal(
      (connection.prepare('SELECT COUNT(*) AS count FROM paid_report_orders').get() as { count: number }).count,
      0,
    )

    credits.credit(alice.id, 1_000, 'adjustment', 'test', 'paid-report-wallet')
    process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
    process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'unlock-service'
    process.env.IUNLOCKMOBILE_PROVIDER_URL = 'https://provider.example/api'
    process.env.IUNLOCKMOBILE_PROVIDER_API_KEY = 'paid-report-secret'
    process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({
      'check:apple_basic': { id: '999', mode: 'sync' },
    })
    const beforeWrongMapping = credits.getBalance(alice.id)
    await assert.rejects(
      paidReports.createPaidReport(alice.id, {
        productCode: 'APPLE_BASIC',
        imei: '490154203237518',
        idempotencyKey: 'paid-wrong-service-id',
      }),
      (error: unknown) => error instanceof paidReports.PaidReportError && error.code === 'provider_not_ready',
    )
    assert.deepEqual(credits.getBalance(alice.id), beforeWrongMapping)
    assert.equal(
      (connection.prepare('SELECT COUNT(*) AS count FROM paid_report_orders').get() as { count: number }).count,
      0,
    )

    process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({
      'check:apple_basic': { id: '214', mode: 'sync' },
      'check:blacklist_simple': { id: '419', mode: 'sync' },
    })

    let providerCalls = 0
    globalThis.fetch = async (input, init) => {
      providerCalls += 1
      const url = new URL(String(input))
      assert.equal(url.searchParams.get('key'), null)
      assert.equal(url.searchParams.get('imei'), null)
      assert.equal(init?.method, 'POST')
      const body = new URLSearchParams(String(init?.body))
      assert.equal(body.get('key'), 'paid-report-secret')
      assert.equal(body.get('service'), '214')
      assert.equal(body.get('imei'), '490154203237518')
      return new Response(
        JSON.stringify({
          success: true,
          response: '',
          object: [{
            Model: 'iPhone 15 Pro',
            IMEI: '490154203237518',
            'Serial Number': 'PAID-RAW-SERIAL-1234',
            'Blacklist Status': 'Clean',
            providerInternalNote: 'must never be stored',
          }],
        }),
        { status: 200 },
      )
    }

    const beforeSuccess = credits.getBalance(alice.id)
    const delivered = await paidReports.createPaidReport(alice.id, {
      productCode: 'APPLE_BASIC',
      imei: '490154203237518',
      idempotencyKey: 'paid-success-1',
    })
    assert.equal(delivered.order.status, 'completed')
    assert.equal(delivered.credit.heldCents, 0)
    assert.equal(delivered.credit.chargedCents, 5)
    assert.equal(credits.getBalance(alice.id).creditCents, beforeSuccess.creditCents - 5)
    assert.equal(credits.getBalance(alice.id).heldCents, beforeSuccess.heldCents)
    assert.equal(providerCalls, 1)
    assert.equal(paidReports.getPaidReport(1, delivered.order.id), undefined)

    const storedDelivered = JSON.stringify(paidReports.getPaidReport(alice.id, delivered.order.id))
    assert.equal(storedDelivered.includes('490154203237518'), false)
    assert.equal(storedDelivered.includes('PAID-RAW-SERIAL-1234'), false)
    assert.equal(storedDelivered.includes('must never be stored'), false)
    assert.match(storedDelivered, /iPhone 15 Pro/)

    const replay = await paidReports.createPaidReport(alice.id, {
      productCode: 'APPLE_BASIC',
      imei: '490154203237518',
      idempotencyKey: 'paid-success-1',
    })
    assert.equal(replay.order.id, delivered.order.id)
    assert.equal(providerCalls, 1)
    await assert.rejects(
      paidReports.createPaidReport(alice.id, {
        productCode: 'APPLE_BASIC',
        imei: '356938035643809',
        idempotencyKey: 'paid-success-1',
      }),
      (error: unknown) => error instanceof paidReports.PaidReportError && error.code === 'idempotency_conflict',
    )

    providerCalls = 0
    globalThis.fetch = async () => {
      providerCalls += 1
      await new Promise((resolve) => setTimeout(resolve, 20))
      return new Response(
        JSON.stringify({ success: true, object: [{ Model: 'iPhone 14' }] }),
        { status: 200 },
      )
    }
    const [concurrentA, concurrentB] = await Promise.all([
      paidReports.createPaidReport(alice.id, {
        productCode: 'APPLE_BASIC',
        imei: '356938035643809',
        idempotencyKey: 'paid-concurrent-1',
      }),
      paidReports.createPaidReport(alice.id, {
        productCode: 'APPLE_BASIC',
        imei: '356938035643809',
        idempotencyKey: 'paid-concurrent-1',
      }),
    ])
    assert.equal(concurrentA.order.id, concurrentB.order.id)
    assert.equal(providerCalls, 1)
    const concurrentTransitions = connection
      .prepare("SELECT type FROM credit_ledger WHERE ref_type = 'paid_imei_report' AND ref_id = ? ORDER BY id")
      .all(String(concurrentA.order.id)) as Array<{ type: string }>
    assert.deepEqual(concurrentTransitions.map((row) => row.type), ['hold', 'charge'])

    globalThis.fetch = async () => new Response(
      JSON.stringify({ success: false, response: 'Unsupported device', object: {} }),
      { status: 200 },
    )
    const beforeFailure = credits.getBalance(alice.id)
    const refunded = await paidReports.createPaidReport(alice.id, {
      productCode: 'BLACKLIST_SIMPLE',
      imei: '356938035643809',
      idempotencyKey: 'paid-refund-1',
    })
    assert.equal(refunded.order.status, 'refunded')
    assert.equal(refunded.credit.refundedCents, 1)
    assert.deepEqual(credits.getBalance(alice.id), beforeFailure)

    globalThis.fetch = async () => {
      throw new Error('simulated ambiguous network failure')
    }
    const beforeAmbiguous = credits.getBalance(alice.id)
    const review = await paidReports.createPaidReport(alice.id, {
      productCode: 'BLACKLIST_SIMPLE',
      imei: '356938035643809',
      idempotencyKey: 'paid-review-1',
    })
    assert.equal(review.order.status, 'manual_review')
    assert.equal(credits.getBalance(alice.id).heldCents, beforeAmbiguous.heldCents + 1)

    credits.refund(alice.id, 1, 'paid_imei_report', String(review.order.id))
    credits.refund(alice.id, 1, 'paid_imei_report', String(review.order.id))
    assert.equal(paidReports.getPaidReport(alice.id, review.order.id)?.status, 'refunded')
    assert.deepEqual(credits.getBalance(alice.id), beforeAmbiguous)

    const paidLedger = connection
      .prepare(
        `SELECT type, amount_cents, affects_balance
           FROM credit_ledger
          WHERE ref_type = 'paid_imei_report'
          ORDER BY id`,
      )
      .all() as Array<{ type: string; amount_cents: number; affects_balance: number }>
    assert.deepEqual(
      paidLedger,
      [
        { type: 'hold', amount_cents: -5, affects_balance: 0 },
        { type: 'charge', amount_cents: -5, affects_balance: 1 },
        { type: 'hold', amount_cents: -5, affects_balance: 0 },
        { type: 'charge', amount_cents: -5, affects_balance: 1 },
        { type: 'hold', amount_cents: -1, affects_balance: 0 },
        { type: 'refund', amount_cents: 1, affects_balance: 0 },
        { type: 'hold', amount_cents: -1, affects_balance: 0 },
        { type: 'refund', amount_cents: 1, affects_balance: 0 },
      ],
    )

    const columns = connection
      .prepare("SELECT name FROM pragma_table_info('paid_report_orders') ORDER BY cid")
      .all() as Array<{ name: string }>
    assert.equal(columns.some((column) => column.name === 'imei'), false)
    assert.equal(columns.some((column) => column.name === 'raw_response'), false)
    assert.equal(columns.some((column) => column.name === 'imei_fingerprint'), true)
    assert.equal(columns.some((column) => column.name === 'masked_imei'), true)

    const paidRows = connection
      .prepare('SELECT imei_fingerprint, masked_imei, report_json FROM paid_report_orders')
      .all() as Array<{ imei_fingerprint: string; masked_imei: string; report_json: string | null }>
    const persistedText = JSON.stringify(paidRows)
    assert.equal(persistedText.includes('490154203237518'), false)
    assert.equal(persistedText.includes('356938035643809'), false)
    assert.equal(persistedText.includes('paid-report-secret'), false)

    const auditRows = connection
      .prepare("SELECT metadata_json FROM provider_events WHERE resource_type = 'paid_imei_report'")
      .all() as Array<{ metadata_json: string | null }>
    const auditText = JSON.stringify(auditRows)
    assert.equal(auditText.includes('490154203237518'), false)
    assert.equal(auditText.includes('356938035643809'), false)
    assert.equal(auditText.includes('paid-report-secret'), false)
    assert.equal(imeiChecks.listImeiChecks(alice.id).length, freeChecksBefore)

    const balanceBeforeCleanup = credits.getBalance(alice.id)
    const cleanupDelta = startingAliceBalance.creditCents - balanceBeforeCleanup.creditCents
    if (cleanupDelta !== 0) {
      credits.credit(alice.id, cleanupDelta, 'adjustment', 'test', 'paid-report-wallet-cleanup')
    }
    assert.deepEqual(credits.getBalance(alice.id), startingAliceBalance)
  } finally {
    globalThis.fetch = originalFetch
    restore('IUNLOCKMOBILE_PROVIDER_MODE', saved.mode)
    restore('IUNLOCKMOBILE_PROVIDER_NAME', saved.name)
    restore('IUNLOCKMOBILE_PROVIDER_URL', saved.url)
    restore('IUNLOCKMOBILE_PROVIDER_API_KEY', saved.apiKey)
    restore('IUNLOCKMOBILE_IMEI_SERVICE_MAP', saved.imeiMap)
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
