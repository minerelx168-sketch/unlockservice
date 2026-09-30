import assert from 'node:assert/strict'
import test from 'node:test'
import { CUSTOMER_UNLOCK_PRODUCTS } from '../lib/customer-provider-products'
import { filterUnlockProducts, unlockCategories, unlockCategory, unlockPreviewProducts } from '../lib/unlock-catalog-view'
import type { PublicProviderProduct } from '../lib/public-provider-catalog'

const products: PublicProviderProduct[] = CUSTOMER_UNLOCK_PRODUCTS.map((product) => ({ ...product, hasExample: false }))

test('categories partition every listed service and country filters exclude other coverage', () => {
  const categories = unlockCategories(products)
  assert.equal(categories.reduce((sum, category) => sum + category.count, 0), products.length)
  assert.equal(new Set(categories.map((category) => category.name)).size, categories.length)
  const us = filterUnlockProducts(products, 'United States', '')
  assert.ok(us.length > 0)
  assert.ok(us.every((product) => /USA|United States/.test(product.name)))
  assert.ok(us.some((product) => product.productCode === 'UNLOCK_346'))
  for (const category of categories) {
    assert.equal(filterUnlockProducts(products, category.name, '').length, category.count)
  }
})

test('search intersects category and accepts words in any order without mutating the input', () => {
  const before = products.map((product) => product.productCode)
  const result = filterUnlockProducts(products, 'Japan', '  CLEAN docomo  ')
  assert.ok(result.some((product) => product.productCode === 'UNLOCK_294'))
  assert.ok(result.every((product) => unlockCategory(product) === 'Japan'))
  assert.equal(filterUnlockProducts(products, 'Canada', 'docomo').length, 0)
  assert.deepEqual(filterUnlockProducts(products, '', '   '), products)
  assert.deepEqual(products.map((product) => product.productCode), before)
})

test('entry previews use active owner products and prices without seeded sample services', () => {
  const runtime: PublicProviderProduct[] = products.map((product) => ({ ...product, priceCents: 999, status: 'available' as const }))
  const preview = unlockPreviewProducts(runtime)
  assert.equal(preview.length, 4)
  assert.ok(preview.every((product) => product.priceCents === 999 && product.status === 'available'))
  assert.equal(new Set(preview.map(unlockCategory)).size, 4)
  assert.ok(preview.every((product) => runtime.includes(product)))
  assert.ok(preview.every((product) => !/icloud|mdm|bypass/i.test(`${product.name} ${product.group} ${product.summary}`)))
  const paused = runtime.map((product) => ({ ...product, status: 'coming_soon' as const }))
  assert.deepEqual(unlockPreviewProducts(paused), [])
  const removed = runtime.filter((product) => product.productCode !== preview[0].productCode)
  assert.ok(unlockPreviewProducts(removed).every((product) => removed.includes(product)))
  assert.deepEqual(unlockPreviewProducts([]), [])
})
