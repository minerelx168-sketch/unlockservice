import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'
import { AVAILABLE_PROVIDER_PRODUCTS } from '../lib/provider-products'

const directory = mkdtempSync(join(tmpdir(), 'owner-storefront-'))
process.env.IUNLOCKMOBILE_DB = join(directory, 'catalog.db')
process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
process.env.IUNLOCKMOBILE_PROVIDER_URL = 'https://provider.invalid/api'
process.env.IUNLOCKMOBILE_PROVIDER_API_KEY = 'local-test-only'
const mappings = {
  'product:unlock_346': { id: '346', mode: 'sync' },
  'product:apple_basic': { id: '214', mode: 'sync' },
}
process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify(mappings)

let connection: ReturnType<typeof import('../lib/db').db>
let listPublicProviderProducts: typeof import('../lib/public-provider-catalog').listPublicProviderProducts
before(async () => {
  const { db } = await import('../lib/db')
  ;({ listPublicProviderProducts } = await import('../lib/public-provider-catalog'))
  connection = db()
})
after(() => { connection.close(); rmSync(directory, { recursive: true, force: true }) })

test('storefront lists active owner products with current owner names and retail prices', () => {
  connection.prepare('UPDATE paid_report_products SET name=?, summary=?, price_cents=? WHERE code=?')
    .run('Owner carrier service', 'Owner service requirements', 321, 'UNLOCK_346')
  const products = listPublicProviderProducts('unlock')
  assert.equal(products.length, AVAILABLE_PROVIDER_PRODUCTS.filter((product) => product.domain === 'unlock').length)
  assert.equal(products[0].productCode, 'UNLOCK_346')
  assert.equal(products[0].name, 'Owner carrier service')
  assert.equal(products[0].summary, 'Owner service requirements')
  assert.equal(products[0].priceCents, 321)
  assert.equal(products[0].status, 'available')
  assert.ok(!('serviceId' in products[0]))
  assert.ok(!('providerCostMicros' in products[0]))
  assert.equal(listPublicProviderProducts('imei_check').length, AVAILABLE_PROVIDER_PRODUCTS.filter((product) => product.domain === 'imei_check').length)
  assert.ok([...products, ...listPublicProviderProducts('imei_check')].every((product) => product.status === 'available'))
})

test('paused owner products disappear instead of becoming prelaunch listings or fallback offers', () => {
  connection.prepare('UPDATE paid_report_products SET is_active=0 WHERE code=?').run('UNLOCK_346')
  try { assert.ok(listPublicProviderProducts('unlock').every((product) => product.productCode !== 'UNLOCK_346')) }
  finally { connection.prepare('UPDATE paid_report_products SET is_active=1 WHERE code=?').run('UNLOCK_346') }
})

test('local transport configuration does not turn the owner active catalog into prelaunch listings', () => {
  const before = listPublicProviderProducts('unlock')
  process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({ ...mappings, 'product:unlock_346': { id: '999999', mode: 'sync' } })
  try { assert.deepEqual(listPublicProviderProducts('unlock'), before) }
  finally { process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify(mappings) }
  process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'disabled'
  try { assert.deepEqual(listPublicProviderProducts('unlock'), before) }
  finally { process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled' }
})

test('unapproved database rows do not become customer products', () => {
  connection.prepare(`INSERT INTO paid_report_products (code, slug, name, summary, input_type, price_cents, provider_cost_micros, eta_minutes, is_active, sort_order)
    VALUES ('FOREIGN_DEMO', 'foreign-demo', 'Not an owner-approved product', '', 'imei', 500, 1000, 1, 1, 0)`).run()
  process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({ ...mappings, 'product:foreign_demo': { id: '346', mode: 'sync' } })
  try { assert.ok([...listPublicProviderProducts('unlock'), ...listPublicProviderProducts('imei_check')].every((product) => product.productCode !== 'FOREIGN_DEMO')) }
  finally { process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify(mappings) }
})
