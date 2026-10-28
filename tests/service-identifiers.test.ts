import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { serviceIdentifier, type ServiceInputType } from '../lib/service-identifier'
import { decryptPaidReportImei, encryptPaidReportImei } from '../lib/paid-report-imei'
import { parseDeviceIntent } from '../lib/device-intent-value'
import { AVAILABLE_PROVIDER_PRODUCTS } from '../lib/provider-products'
import approved from '../catalog/owner-selling-prices-20261028.json'
import directory from '../catalog/storefront-service-directory.json'

const fixtures: [ServiceInputType, string, string][] = [
  ['imei', '49 015420 323751 8', '490154203237518'],
  ['serial', 'c02test123abc', 'C02TEST123ABC'],
  ['serial_or_imei', 'f2ltest123456', 'F2LTEST123456'],
  ['phone', '+1 (202) 555-0123', '12025550123'],
  ['case_id', '102925123456', '102925123456'],
  ['udid', '00008020-001c2d3e4f5a6789', '00008020-001C2D3E4F5A6789'],
  ['unlock_number', 'fsn-test123456', 'FSN-TEST123456'],
  ['ecid', '0x12ab34cd56ef7890', '0X12AB34CD56EF7890'],
]
test('service inputs validate without truncation and survive encrypted storage and draft handoff', () => {
  for (const [type, raw, canonical] of fixtures) {
    assert.equal(serviceIdentifier(raw, type), canonical)
    const ciphertext = encryptPaidReportImei(raw, type)
    assert.equal(ciphertext.includes(canonical), false)
    assert.equal(decryptPaidReportImei(ciphertext), canonical)
    const parsed = JSON.parse(ciphertext)
    parsed.type = type === 'phone' ? 'serial' : 'phone'
    if (parsed.v === 2) assert.equal(decryptPaidReportImei(JSON.stringify(parsed)), null)
    const draft = { imei: canonical, inputType: type, productCode: 'TEST', domain: 'imei_check', expiresAt: Date.now() + 60000 }
    assert.equal(parseDeviceIntent(JSON.stringify(draft))?.imei, canonical)
    assert.equal(serviceIdentifier(`<script>${raw}`, type), null)
    assert.equal(serviceIdentifier('x'.repeat(81), type), null)
  }
  assert.equal(serviceIdentifier('4901542032375189', 'imei'), null)
  assert.equal(serviceIdentifier('490154203237519', 'serial_or_imei'), null)
  assert.equal(serviceIdentifier('Serial: C02TEST123ABC', 'serial'), null)
  assert.equal(serviceIdentifier('02025550123', 'phone'), null)
  assert.equal(serviceIdentifier('ABC123456', 'case_id'), null)
})

test('owner-approved prices match all current provider IDs and retain the required markup', () => {
  const ids = new Set(directory.services.map(row => row.serviceId))
  const prices = new Map(approved.prices.map(row => [row.serviceId, row.sellingPriceCents]))
  assert.equal(ids.size, 129)
  assert.equal(AVAILABLE_PROVIDER_PRODUCTS.length, 128)
  for (const p of AVAILABLE_PROVIDER_PRODUCTS) {
    assert.ok(ids.has(p.serviceId))
    assert.equal(p.priceCents, prices.get(p.serviceId))
    assert.ok(p.priceCents * 1e6 >= p.providerCostMicros * 130)
  }
})

const folder = mkdtempSync(join(tmpdir(), 'service-identifiers-'))
process.env.IUNLOCKMOBILE_DB = join(folder, 'test.db')
process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'test'
process.env.IUNLOCKMOBILE_PROVIDER_DHRU_URL = 'https://provider.example.test/api/index.php'
process.env.IUNLOCKMOBILE_PROVIDER_DHRU_USERNAME = 'test-user'
process.env.IUNLOCKMOBILE_PROVIDER_DHRU_KEY = 'test-key'
const originalFetch = globalThis.fetch
after(() => { globalThis.fetch = originalFetch; rmSync(folder, { recursive: true, force: true }) })

test('paid orders preserve each identifier, hold credit before submission and settle once', async () => {
  const { db } = await import('../lib/db')
  const { credit, getBalance } = await import('../lib/credits')
  const { createPaidReport, settlePaidReportWebhook, getPaidReport } = await import('../lib/paid-reports')
  let calls = 0
  for (const [type, raw, canonical] of fixtures) {
    const p = AVAILABLE_PROVIDER_PRODUCTS.find(product => product.inputType === type)!
    assert.ok(p)
    db().prepare('UPDATE paid_report_products SET is_active=1 WHERE code=?').run(p.productCode)
    process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({ [`product:${p.productCode.toLowerCase()}`]: { id: p.serviceId, mode: 'dhru' } })
    const user = Number(db().prepare('INSERT INTO users(username,email,password_hash) VALUES (?,?,?)').run(type, `${type}@example.test`, 'test-only').lastInsertRowid)
    const input = { productCode: p.productCode, imei: raw, idempotencyKey: randomUUID(), expectedPriceCents: p.priceCents }
    globalThis.fetch = async (_url, init) => {
      calls++
      assert.equal(getBalance(user).heldCents, p.priceCents)
      const body = new URLSearchParams(String(init?.body))
      assert.equal(body.get('action'), 'placeimeiorder')
      assert.ok(body.get('parameters')?.includes(`<IMEI>${canonical}</IMEI>`))
      assert.ok(body.get('parameters')?.includes(`<ID>${p.serviceId}</ID>`))
      return Response.json({ SUCCESS: [{ REFERENCEID: `test-${type}` }] })
    }
    const beforeCalls = calls
    await assert.rejects(createPaidReport(user, input), /credit/i)
    assert.equal(calls, beforeCalls)
    credit(user, p.priceCents, 'topup', 'test', type)
    await assert.rejects(createPaidReport(user, { ...input, imei: '<invalid>' }), /valid|Enter/)
    assert.equal(calls, beforeCalls)
    const order = await createPaidReport(user, input)
    assert.equal(order.order.imei, canonical)
    assert.equal(order.order.inputType, type)
    assert.equal(order.order.status, 'processing')
    assert.equal(calls, beforeCalls + 1)
    assert.equal((await createPaidReport(user, input)).order.id, order.order.id)
    assert.equal(calls, beforeCalls + 1)
    const stored = db().prepare('SELECT imei_encrypted, imei_fingerprint FROM paid_report_orders WHERE id=?').get(order.order.id)
    assert.equal(JSON.stringify(stored).includes(canonical), false)
    settlePaidReportWebhook(order.order.id, `test-${type}`, { status: 'success', result: { Model: 'Test device', Status: 'Completed' } })
    settlePaidReportWebhook(order.order.id, `test-${type}`, { status: 'success', result: { Model: 'Test device', Status: 'Completed' } })
    assert.equal(getPaidReport(user, order.order.id)?.imei, canonical)
    assert.equal(getBalance(user).heldCents, 0)
    assert.equal(getBalance(user).availableCents, 0)
    assert.deepEqual(db().prepare("SELECT count(*) AS n FROM credit_ledger WHERE ref_type='paid_imei_report' AND ref_id=? AND type='charge'").get(String(order.order.id)), { n: 1 })
  }
  db().close()
})
