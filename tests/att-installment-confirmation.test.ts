import assert from 'node:assert/strict'
import test, { before, after } from 'node:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { requiresAttInstallmentConfirmation, isAttName, assertAttInstallmentConfirmation } from '../lib/att-installment-confirmation'
const dir = mkdtempSync(join(tmpdir(), 'att-confirmation-'))
Object.assign(process.env, {
  IUNLOCKMOBILE_DB: join(dir, 'test.db'), IUNLOCKMOBILE_WHOP_ENABLED: '1', IUNLOCKMOBILE_GUEST_CHECKOUT_ENABLED: '1',
  WHOP_MODE: 'live', WHOP_ACCOUNT_ID: 'biz_test', WHOP_PRODUCT_ID: 'prod_test', WHOP_API_KEY: 'test-only', WHOP_WEBHOOK_SECRET: 'test-only',
  RESEND_API_KEY: 'test-only', IUNLOCKMOBILE_EMAIL_FROM: 'support@example.test',
  IUNLOCKMOBILE_TOPUP_ENABLED: '1', IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED: '1', IUNLOCKMOBILE_USDT_FEE_BPS: '0', IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS: '0x1111111111111111111111111111111111111111',
  IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET: 'test-only-att-confirmation-secret-32-characters',
  IUNLOCKMOBILE_PROVIDER_MODE: 'enabled', IUNLOCKMOBILE_PROVIDER_NAME: 'test', IUNLOCKMOBILE_PROVIDER_URL: 'https://provider.invalid/api',
  IUNLOCKMOBILE_PROVIDER_API_KEY: 'test-only', IUNLOCKMOBILE_IMEI_SERVICE_MAP: JSON.stringify({'check:unlock_346': {id: '346', mode: 'sync'}}),
})
let database: typeof import('../lib/db'), card: typeof import('../lib/guest-checkout'), crypto: typeof import('../lib/guest-crypto'), reports: typeof import('../lib/paid-reports')
const originalFetch = globalThis.fetch
let calls = 0
before(async () => {
  database = await import('../lib/db'); card = await import('../lib/guest-checkout'); crypto = await import('../lib/guest-crypto'); reports = await import('../lib/paid-reports')
  database.db().prepare("UPDATE paid_report_products SET price_cents=800,is_active=1 WHERE code='UNLOCK_346'").run()
  globalThis.fetch = async () => { calls++; throw new Error('Network forbidden in this test') }
})
after(() => { globalThis.fetch = originalFetch; database.db().close(); rmSync(dir, {recursive: true, force: true}) })
test('trusted catalog applies to AT&T unlock only, never arbitrary client carrier or check-only product', () => {
  assert.equal(requiresAttInstallmentConfirmation('UNLOCK_346'), true)
  assert.equal(requiresAttInstallmentConfirmation('APPLE_CARRIER_LITE'), false)
  assert.equal(requiresAttInstallmentConfirmation('unknown'), false)
  for (const name of ['AT&T USA', 'AT AND T', 'ATT USA', 'AT-T']) assert.equal(isAttName(name), true)
  for (const name of ['C Spire', 'ATTACHED', 'T-Mobile']) assert.equal(isAttName(name), false)
  for (const value of [undefined, false, 'true', 1, {}, null]) assert.throws(() => assertAttInstallmentConfirmation('UNLOCK_346', value), {code: 'att_installment_confirmation_required'})
  assert.doesNotThrow(() => assertAttInstallmentConfirmation('UNLOCK_346', true))
  assert.doesNotThrow(() => assertAttInstallmentConfirmation('APPLE_CARRIER_LITE', false))
})
test('new card and crypto AT&T checkout reject missing or coercible consent before bill, invoice, ledger or network creation', async () => {
  const counts = () => ['guest_checkouts', 'invoices', 'credit_ledger', 'paid_report_orders'].map(n => (database.db().prepare(`SELECT COUNT(*) AS n FROM ${n}`).get() as {n:number}).n)
  const beforeCounts = counts()
  assert.equal(reports.getPaidReportProduct('UNLOCK_346')?.providerReady, true)
  for (const value of [undefined, false, 'true', 1]) {
    const input = {productCode: 'UNLOCK_346', imei: ['49015420','3237518'].join(''), email: 'synthetic@example.test', requestKey: randomUUID(), expectedPriceCents: 800, attInstallmentConfirmation: value}
    await assert.rejects(card.createGuestCheckout(input), {code: 'att_installment_confirmation_required'})
    await assert.rejects(crypto.createGuestCryptoCheckout({...input, requestKey: randomUUID(), routeId: 'bsc-usdt-peg'}), {code: 'att_installment_confirmation_required'})
  }
  assert.deepEqual(counts(), beforeCounts); assert.equal(calls, 0)
})
test('authenticated new report rejects missing confirmation before hold or provider call', async () => {
  const uid = Number(database.db().prepare("INSERT INTO users(username,email,password_hash,credit_cents,held_cents) VALUES('synthetic-att','synthetic-att@example.test','unused',0,0)").run().lastInsertRowid)
  const beforeCount = (database.db().prepare('SELECT COUNT(*) AS n FROM credit_ledger').get() as {n:number}).n
  await assert.rejects(reports.createPaidReport(uid, {productCode: 'UNLOCK_346', imei: ['49015420','3237518'].join(''), idempotencyKey: randomUUID()}), {code: 'att_installment_confirmation_required'})
  assert.equal((database.db().prepare('SELECT COUNT(*) AS n FROM credit_ledger').get() as {n:number}).n, beforeCount)
  assert.equal(calls, 0)
})
