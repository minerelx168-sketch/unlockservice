import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'
import { CUSTOMER_IMEI_CHECK_PRODUCTS, CUSTOMER_UNLOCK_PRODUCTS } from '../lib/customer-provider-products'

const directory = mkdtempSync(join(tmpdir(), 'owner-storefront-'))
process.env.IUNLOCKMOBILE_DB = join(directory, 'catalog.db')
process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
process.env.IUNLOCKMOBILE_PROVIDER_URL = 'https://provider.invalid/api'
process.env.IUNLOCKMOBILE_PROVIDER_API_KEY = 'local-test-only'
const mappings = { 'product:unlock_346': { id: '346', mode: 'sync' } }
process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify(mappings)

let connection: ReturnType<typeof import('../lib/db').db>
let listPublicProviderProducts: typeof import('../lib/public-provider-catalog').listPublicProviderProducts
before(async () => {
  const { db } = await import('../lib/db')
  ;({ listPublicProviderProducts } = await import('../lib/public-provider-catalog'))
  connection = db()
})
after(() => { connection.close(); rmSync(directory, { recursive: true, force: true }) })

test('public catalog keeps approved names and live retail prices without supplier data', () => {
  connection.prepare('UPDATE paid_report_products SET price_cents=?, is_active=1 WHERE code=?')
    .run(321, 'UNLOCK_346')
  const products = listPublicProviderProducts('unlock')
  const checks = listPublicProviderProducts('imei_check')
  assert.deepEqual(products.map((product) => product.productCode), CUSTOMER_UNLOCK_PRODUCTS.map((product) => product.productCode))
  assert.deepEqual(checks.map((product) => product.productCode), CUSTOMER_IMEI_CHECK_PRODUCTS.map((product) => product.productCode))
  const product = products.find((entry) => entry.productCode === 'UNLOCK_346')!
  const approved = CUSTOMER_UNLOCK_PRODUCTS.find((entry) => entry.productCode === product.productCode)!
  assert.equal(product.name, approved.name)
  assert.equal(product.summary, approved.summary)
  assert.equal(product.priceCents, 321)
  assert.equal(product.status, 'available')
  for (const entry of [...products, ...checks]) {
    assert.ok(!('serviceId' in entry))
    assert.ok(!('providerCostMicros' in entry))
  }
  assert.ok(checks.every((entry) => entry.status === 'coming_soon')) // No check mappings are configured.
})

test('paused products remain viewable but cannot be advertised as orderable', () => {
  connection.prepare('UPDATE paid_report_products SET is_active=0 WHERE code=?').run('UNLOCK_346')
  try {
    const product = listPublicProviderProducts('unlock').find((entry) => entry.productCode === 'UNLOCK_346')
    assert.ok(product)
    assert.equal(product.status, 'coming_soon')
  } finally {
    connection.prepare('UPDATE paid_report_products SET is_active=1 WHERE code=?').run('UNLOCK_346')
  }
})

test('mismatched mappings and disabled transport close availability without changing retail prices', () => {
  const ready = listPublicProviderProducts('unlock').find((entry) => entry.productCode === 'UNLOCK_346')!
  assert.equal(ready.status, 'available')
  process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({ 'product:unlock_346': { id: '999999', mode: 'sync' } })
  try {
    const unavailable = listPublicProviderProducts('unlock').find((entry) => entry.productCode === ready.productCode)!
    assert.equal(unavailable.status, 'coming_soon')
    assert.equal(unavailable.priceCents, ready.priceCents)
  } finally {
    process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify(mappings)
  }
  process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'disabled'
  try {
    const unavailable = listPublicProviderProducts('unlock').find((entry) => entry.productCode === ready.productCode)!
    assert.equal(unavailable.status, 'coming_soon')
    assert.equal(unavailable.priceCents, ready.priceCents)
  } finally {
    process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
  }
  assert.equal(listPublicProviderProducts('unlock').find((entry) => entry.productCode === ready.productCode)!.status, 'available')
})

test('unapproved database rows do not become customer products', () => {
  connection.prepare(`INSERT INTO paid_report_products (code, slug, name, summary, input_type, price_cents, provider_cost_micros, eta_minutes, is_active, sort_order)
    VALUES ('FOREIGN_DEMO', 'foreign-demo', 'Not an owner-approved product', '', 'imei', 500, 1000, 1, 1, 0)`).run()
  process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({ ...mappings, 'product:foreign_demo': { id: '346', mode: 'sync' } })
  try {
    assert.ok([...listPublicProviderProducts('unlock'), ...listPublicProviderProducts('imei_check')].every((product) => product.productCode !== 'FOREIGN_DEMO'))
  } finally {
    process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify(mappings)
  }
})
