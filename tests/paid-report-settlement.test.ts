import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-paid-settlement-'))
process.env.IUNLOCKMOBILE_DB = join(workDir, 'settlement.db')
process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'dhru'
process.env.IUNLOCKMOBILE_PROVIDER_URL = 'https://provider.example.test/api'
process.env.IUNLOCKMOBILE_PROVIDER_API_KEY = 'test-only-key'
process.env.IUNLOCKMOBILE_PROVIDER_DHRU_URL = 'https://provider.example.test/api/index.php'
process.env.IUNLOCKMOBILE_PROVIDER_DHRU_KEY = 'test-only-dhru-key'
process.env.IUNLOCKMOBILE_PROVIDER_DHRU_USERNAME = 'test-user'

let database: typeof import('../lib/db')
let credits: typeof import('../lib/credits')
let reports: typeof import('../lib/paid-reports')
let privacy: typeof import('../lib/imei-privacy')
const originalFetch = globalThis.fetch

before(async () => {
  database = await import('../lib/db')
  credits = await import('../lib/credits')
  reports = await import('../lib/paid-reports')
  privacy = await import('../lib/imei-privacy')
  globalThis.fetch = async () => { throw new Error('This test must not contact a real provider.') }
})

after(() => {
  globalThis.fetch = originalFetch
  database.db().close()
  rmSync(workDir, { recursive: true, force: true })
})

function customer(name: string) {
  const inserted = database.db().prepare(
    'INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)',
  ).run(name, `${name}@example.test`, 'test-only-not-a-password')
  const id = Number(inserted.lastInsertRowid)
  credits.credit(id, 1_000, 'topup', 'test', name)
  return id
}

function pendingReport(userId: number, reference: string) {
  const inserted = database.db().prepare(`
    INSERT INTO paid_report_orders
      (user_id, product_code, product_name, imei_fingerprint, masked_imei, status,
       price_cents, source, idempotency_key, provider_order_id, provider_name, provider_mode)
    VALUES (?, 'APPLE_BASIC', 'Apple Basic', ?, '***********7518', 'processing',
      5, 'website', ?, ?, 'dhru', 'dhru')
  `).run(userId, privacy.fingerprintImei('490154203237518'), reference, reference)
  const id = Number(inserted.lastInsertRowid)
  credits.hold(userId, 5, 'paid_imei_report', String(id))
  return id
}

function stored(id: number) {
  return database.db().prepare(
    'SELECT status, report_json, error_message, completed_at, updated_at FROM paid_report_orders WHERE id = ?',
  ).get(id)
}

function effects(id: number) {
  return database.db().prepare(`
    SELECT type, amount_cents, affects_balance FROM credit_ledger
    WHERE ref_type = 'paid_imei_report' AND ref_id = ? ORDER BY id
  `).all(String(id))
}

function notifications(id: number) {
  return database.db().prepare(`
    SELECT event FROM order_notifications
    WHERE resource_type = 'paid_imei_report' AND resource_id = ? ORDER BY id
  `).all(id)
}

test('paid report success is immutable across duplicate and conflicting callbacks', () => {
  const userId = customer('paid-success')
  const id = pendingReport(userId, 'paid-success-1')
  const otherId = pendingReport(userId, 'paid-success-other')
  assert.deepEqual(reports.settlePaidReportWebhook(id, 'paid-success-1', {
    status: 'success', result: { Model: 'iPhone 15', IMEI: '490154203237518', providerSecret: 'never store' },
  }), { status: 'completed' })
  const completed = stored(id)

  assert.deepEqual(reports.settlePaidReportWebhook(id, 'paid-success-1', {
    status: 'success', result: { Model: 'Different replacement report' },
  }), { status: 'completed' })
  assert.deepEqual(reports.settlePaidReportWebhook(id, 'paid-success-1', {
    status: 'rejected', message: 'A conflicting provider update',
  }), { status: 'completed' })
  assert.deepEqual(stored(id), completed)
  assert.equal(JSON.stringify(completed).includes('never store'), false)
  assert.equal(JSON.stringify(completed).includes('490154203237518'), false)
  assert.deepEqual(credits.getBalance(userId), { creditCents: 995, heldCents: 5, availableCents: 990 })
  assert.equal(reports.getPaidReport(userId, otherId)?.status, 'processing')
  assert.deepEqual(effects(id), [
    { type: 'hold', amount_cents: -5, affects_balance: 0 },
    { type: 'charge', amount_cents: -5, affects_balance: 1 },
  ])
  assert.deepEqual(notifications(id), [{ event: 'success' }])
})

test('paid report rejection restores only its hold once and cannot later be charged', () => {
  const userId = customer('paid-rejection')
  const id = pendingReport(userId, 'paid-rejection-1')
  pendingReport(userId, 'paid-rejection-other')
  assert.deepEqual(reports.settlePaidReportWebhook(id, 'paid-rejection-1', {
    status: 'rejected', message: 'Private provider failure for IMEI 490154203237518',
  }), { status: 'refunded' })
  const refunded = stored(id)
  assert.deepEqual(reports.settlePaidReportWebhook(id, 'paid-rejection-1', {
    status: 'rejected', message: 'Another rejection',
  }), { status: 'refunded' })
  assert.deepEqual(reports.settlePaidReportWebhook(id, 'paid-rejection-1', {
    status: 'success', result: { Model: 'iPhone 15' },
  }), { status: 'refunded' })
  assert.deepEqual(stored(id), refunded)
  assert.equal(JSON.stringify(refunded).includes('490154203237518'), false)
  assert.deepEqual(credits.getBalance(userId), { creditCents: 1_000, heldCents: 5, availableCents: 995 })
  assert.deepEqual(effects(id), [
    { type: 'hold', amount_cents: -5, affects_balance: 0 },
    { type: 'refund', amount_cents: 5, affects_balance: 0 },
  ])
  assert.deepEqual(notifications(id), [{ event: 'rejected' }])
  assert.equal(credits.creditIntegrity().mismatches, 0)
  assert.equal(credits.creditIntegrity().invalidHolds, 0)
})

test('unsupported paid report success keeps its hold until a meaningful final result', () => {
  const userId = customer('paid-empty')
  const id = pendingReport(userId, 'paid-empty-1')
  const before = credits.getBalance(userId)
  assert.deepEqual(reports.settlePaidReportWebhook(id, 'paid-empty-1', {
    status: 'success', result: { providerInternalNote: 'No supported fields' },
  }), { status: 'manual_review' })
  assert.deepEqual(credits.getBalance(userId), before)
  assert.deepEqual(effects(id), [{ type: 'hold', amount_cents: -5, affects_balance: 0 }])
  assert.deepEqual(notifications(id), [])
  assert.deepEqual(reports.settlePaidReportWebhook(id, 'paid-empty-1', {
    status: 'success', result: { Model: 'iPhone 15' },
  }), { status: 'completed' })
})

test('paid report callbacks require the exact saved provider reference', () => {
  const userId = customer('paid-reference')
  const id = pendingReport(userId, 'paid-reference-1')
  const before = credits.getBalance(userId)
  assert.throws(() => reports.settlePaidReportWebhook(id, 'different-order', { status: 'rejected' }), /reference/)
  assert.throws(() => reports.settlePaidReportWebhook(id, '', { status: 'rejected' }), /reference/)
  assert.throws(() => reports.settlePaidReportWebhook(999_999, 'missing', { status: 'rejected' }), /not found/)
  assert.deepEqual(credits.getBalance(userId), before)
  assert.equal(reports.getPaidReport(userId, id)?.status, 'processing')
})

test('paid report settlement rolls back order and credit if its notification cannot be queued', () => {
  for (const status of ['success', 'rejected'] as const) {
    const userId = customer(`paid-rollback-${status}`)
    const reference = `paid-rollback-${status}-1`
    const id = pendingReport(userId, reference)
    const before = credits.getBalance(userId)
    const beforeOrder = stored(id)
    // Inject a database failure after the ledger and order writes. The outbox
    // must commit with them, otherwise a settled order can lose its notification.
    database.db().exec(`CREATE TEMP TRIGGER fail_paid_notification BEFORE INSERT ON order_notifications
      WHEN NEW.resource_type = 'paid_imei_report' AND NEW.resource_id = ${id}
      BEGIN SELECT RAISE(ABORT, 'simulated notification storage failure'); END`)
    try {
      assert.throws(() => reports.settlePaidReportWebhook(id, reference, {
        status, result: { Model: 'iPhone 15' },
      }), /simulated notification storage failure/)
    } finally {
      database.db().exec('DROP TRIGGER fail_paid_notification')
    }
    assert.deepEqual(stored(id), beforeOrder)
    assert.deepEqual(credits.getBalance(userId), before)
    assert.deepEqual(effects(id), [{ type: 'hold', amount_cents: -5, affects_balance: 0 }])
    assert.deepEqual(notifications(id), [])
  }
})

test('an in-flight paid report poll cannot overwrite a webhook refund', async () => {
  const userId = customer('paid-poll-race')
  const id = pendingReport(userId, 'paid-poll-race-1')
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  globalThis.fetch = async () => {
    await gate
    return new Response(JSON.stringify({ SUCCESS: [{ STATUS: 4, CODE: 'Model: iPhone 15' }] }))
  }
  const pending = reports.pollPaidReport(userId, id)
  try {
    assert.deepEqual(reports.settlePaidReportWebhook(id, 'paid-poll-race-1', { status: 'rejected' }), { status: 'refunded' })
  } finally {
    release()
  }
  assert.equal((await pending).order.status, 'refunded')
  assert.equal(reports.getPaidReport(userId, id)?.report, null)
  assert.deepEqual(credits.getBalance(userId), { creditCents: 1_000, heldCents: 0, availableCents: 1_000 })
})

test('an existing paid request replays while product and provider are disabled', async () => {
  const userId = customer('paid-replay-disabled')
  const id = pendingReport(userId, 'paid-replay-disabled-1')
  let calls = 0
  globalThis.fetch = async () => { calls += 1; throw new Error('Replay must not submit again.') }
  database.db().prepare("UPDATE paid_report_products SET is_active = 0 WHERE code = 'APPLE_BASIC'").run()
  process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'disabled'
  try {
    const result = await reports.createPaidReport(userId, {
      productCode: 'APPLE_BASIC', imei: '490154203237518', idempotencyKey: 'paid-replay-disabled-1',
    })
    assert.equal(result.order.id, id)
    assert.equal(calls, 0)
    assert.equal(credits.getBalance(userId).heldCents, 5)
    await assert.rejects(reports.createPaidReport(userId, {
      productCode: 'BLACKLIST_SIMPLE', imei: '490154203237518', idempotencyKey: 'paid-replay-disabled-1',
    }), (error: unknown) => error instanceof reports.PaidReportError && error.code === 'idempotency_conflict')
  } finally {
    database.db().prepare("UPDATE paid_report_products SET is_active = 1 WHERE code = 'APPLE_BASIC'").run()
    process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
  }
})

test('paid polling retains credit when provider configuration is disabled, incomplete or replaced', async () => {
  const userId = customer('paid-config-drift')
  const id = pendingReport(userId, 'paid-config-drift-1')
  const before = credits.getBalance(userId)
  let calls = 0
  globalThis.fetch = async () => { calls += 1; throw new Error('Unsafe polling must not contact any provider.') }
  const names = [
    'IUNLOCKMOBILE_PROVIDER_MODE', 'IUNLOCKMOBILE_PROVIDER_NAME',
    'IUNLOCKMOBILE_PROVIDER_API_KEY', 'IUNLOCKMOBILE_PROVIDER_DHRU_URL',
    'IUNLOCKMOBILE_PROVIDER_DHRU_KEY', 'IUNLOCKMOBILE_PROVIDER_DHRU_USERNAME',
  ] as const
  const saved = new Map(names.map((name) => [name, process.env[name]]))
  const restore = () => {
    for (const name of names) {
      const value = saved.get(name)
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
  const configurations = [
    () => { process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'disabled' },
    () => { process.env.IUNLOCKMOBILE_PROVIDER_DHRU_USERNAME = '' },
    () => { process.env.IUNLOCKMOBILE_PROVIDER_DHRU_URL = ''; process.env.IUNLOCKMOBILE_PROVIDER_DHRU_KEY = '' },
    () => { process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'different-provider' },
  ]
  try {
    for (const configure of configurations) {
      restore()
      configure()
      assert.equal((await reports.pollPaidReport(userId, id)).order.status, 'processing')
      assert.deepEqual(credits.getBalance(userId), before)
      assert.deepEqual(effects(id), [{ type: 'hold', amount_cents: -5, affects_balance: 0 }])
      assert.deepEqual(notifications(id), [])
      assert.equal(calls, 0)
    }
  } finally {
    restore()
  }
})
