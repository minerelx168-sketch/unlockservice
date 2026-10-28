import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after } from 'node:test'

const dir = mkdtempSync(join(tmpdir(), 'storefront-retail-'))
process.env.IUNLOCKMOBILE_DB = join(dir, 'test.db')
after(() => rmSync(dir, { recursive: true, force: true }))

test('both customer sections use current selling prices, preserve availability and expose no supplier cost or ID', async () => {
  const { db } = await import('../lib/db')
  const { listPublicProviderProducts, listStorefrontProviderProducts } = await import('../lib/public-provider-catalog')
  const retail = 12345
  const update = db().prepare("UPDATE paid_report_products SET price_cents = ?, is_active = 1 WHERE code = 'UNLOCK_346'").run(retail)
  assert.equal(update.changes, 1)
  const original = [...listPublicProviderProducts('imei_check'), ...listPublicProviderProducts('unlock')]
  const sections = [...listStorefrontProviderProducts('imei_check'), ...listStorefrontProviderProducts('unlock')]
  assert.equal(sections.length, original.length)
  const moved = listStorefrontProviderProducts('imei_check').find((product) => product.productCode === 'UNLOCK_346')!
  assert.equal(moved.priceCents, retail)
  assert.equal(moved.domain, 'unlock')
  assert.equal(listStorefrontProviderProducts('unlock').some((product) => product.productCode === moved.productCode), false)
  const allowed = ['domain', 'etaLabel', 'group', 'hasExample', 'inputType', 'name', 'priceCents', 'productCode', 'slug', 'sortOrder', 'status', 'summary'].sort()
  for (const product of sections) {
    assert.deepEqual(Object.keys(product).sort(), allowed)
    assert.deepEqual(product, original.find((entry) => entry.productCode === product.productCode))
  }
  assert.ok(sections.filter((product) => product.inputType !== 'imei').every((product) => product.status === 'coming_soon'))
})
