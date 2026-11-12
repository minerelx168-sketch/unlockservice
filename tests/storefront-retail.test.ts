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
  assert.equal(checks.length, 63)
  assert.equal(unlocks.length, 58)
  assert.equal(new Set(all.map((product) => product.productCode)).size, 121)
  for (const code of ['UNLOCK_718','UNLOCK_926','UNLOCK_25','CHECK_661','CHECK_904','CHECK_702','CHECK_696']) assert.ok(!all.some(p => p.productCode === code), code)
  const moved = unlocks.find((product) => product.productCode === 'UNLOCK_346')!
  assert.equal(moved.priceCents, retail)
  assert.equal(moved.domain, 'unlock')
  assert.equal(checks.some((product) => product.productCode === moved.productCode), false)
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


test('retail cutover pauses only the old AT&T SKU and reprices three products once, without rewriting order quotes', async () => {
  const { db, applyNovemberRetailUpdate } = await import('../lib/db')
  const { NOV12_VERSION } = await import('../lib/retail-update-nov12')
  const { getPaidReportProduct } = await import('../lib/paid-reports')
  const { listStorefrontProviderProducts } = await import('../lib/public-provider-catalog')
  const connection = db()
  connection.prepare("INSERT INTO paid_report_products(code,slug,name,summary,price_cents,is_active) VALUES('UNLOCK_718','unlock-718','Legacy AT&T','',499,1)").run()
  connection.prepare("INSERT INTO guest_checkouts(reference,request_key,email,product_code,product_name,imei_encrypted,price_cents,fee_cents,account_id,product_id,environment) VALUES('legacy','legacy','test@example.test','UNLOCK_718','AT&T','opaque',499,25,'account','product','sandbox')").run()
  connection.prepare('DELETE FROM schema_migrations WHERE version=?').run(NOV12_VERSION)
  connection.prepare("UPDATE paid_report_products SET price_cents=100 WHERE code='CHECK_690'").run()
  connection.prepare("UPDATE paid_report_products SET price_cents=104,is_active=0 WHERE code='CHECK_973'").run()
  applyNovemberRetailUpdate(connection)
  assert.equal(getPaidReportProduct('UNLOCK_718')?.isActive, false)
  assert.equal(getPaidReportProduct('UNLOCK_718')?.providerReady, false)
  assert.ok(!listStorefrontProviderProducts('unlock').some(p=>p.productCode==='UNLOCK_718'))
  assert.equal(getPaidReportProduct('UNLOCK_346')?.priceCents, 800)
  assert.equal(getPaidReportProduct('CHECK_690')?.priceCents, 195)
  assert.equal(getPaidReportProduct('CHECK_973')?.priceCents, 195)
  assert.equal(getPaidReportProduct('CHECK_973')?.isActive, false)
  assert.deepEqual(connection.prepare("SELECT price_cents,fee_cents FROM guest_checkouts WHERE reference='legacy'").get(),{price_cents:499,fee_cents:25})
  connection.prepare("UPDATE paid_report_products SET price_cents=201 WHERE code='CHECK_690'").run()
  applyNovemberRetailUpdate(connection)
  assert.equal(getPaidReportProduct('CHECK_690')?.priceCents,201)
})
