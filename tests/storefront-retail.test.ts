import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after } from 'node:test'

const dir = mkdtempSync(join(tmpdir(), 'storefront-retail-'))
process.env.IUNLOCKMOBILE_DB = join(dir, 'test.db')
after(() => rmSync(dir, { recursive: true, force: true }))

test('the complete directory uses our current retail prices and never exposes supplier cost or ID', async () => {
  const { db } = await import('../lib/db')
  const { listStorefrontProviderProducts } = await import('../lib/public-provider-catalog')
  const { PROVIDER_PRODUCTS } = await import('../lib/provider-products')
  const { getPaidReportProduct } = await import('../lib/paid-reports')
  const retail = 12345
  assert.equal(db().prepare("UPDATE paid_report_products SET price_cents = ?, is_active = 1 WHERE code = 'UNLOCK_346'").run(retail).changes, 1)
  const checks = listStorefrontProviderProducts('imei_check')
  const unlocks = listStorefrontProviderProducts('unlock')
  const all = [...checks, ...unlocks]
  assert.equal(checks.length, 65)
  assert.equal(unlocks.length, 63)
  assert.equal(new Set(all.map((product) => product.productCode)).size, 128)
  const moved = checks.find((product) => product.productCode === 'UNLOCK_346')!
  assert.equal(moved.priceCents, retail)
  assert.equal(moved.domain, 'unlock')
  assert.equal(unlocks.some((product) => product.productCode === moved.productCode), false)
  const allowed = ['domain', 'etaLabel', 'group', 'hasExample', 'inputType', 'name', 'priceAvailable', 'priceCents', 'productCode', 'slug', 'sortOrder', 'status', 'summary'].sort()
  for (const product of all) {
    assert.deepEqual(Object.keys(product).sort(), allowed)
    const configured = PROVIDER_PRODUCTS.find((entry) => entry.productCode === product.productCode)
    const live = getPaidReportProduct(product.productCode)
    const ownPrice = live?.priceCents ?? configured?.priceCents
    assert.equal(product.priceAvailable, typeof ownPrice === 'number' && ownPrice > 0)
    assert.equal(product.priceCents, product.priceAvailable ? ownPrice : 0)
    if (!configured || configured.status !== 'available' || !live?.providerReady || !product.priceAvailable) {
      assert.equal(product.status, 'coming_soon', product.productCode)
    }
    if (configured) assert.equal(product.domain, configured.domain)
  }
  const unpriced = all.find((product) => product.productCode === 'CHECK_998')!
  assert.equal(unpriced.priceAvailable, true)
  assert.equal(unpriced.status, 'coming_soon')
  assert.ok(all.filter((product) => product.inputType !== 'imei').every((product) => product.status === 'coming_soon')) // Provider is disabled in this fixture.
})

