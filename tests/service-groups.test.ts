import assert from 'node:assert/strict'
import test from 'node:test'
import { groupServices, SERVICE_GROUPS, storefrontDomain } from '../lib/service-groups'
import { PUBLIC_PROVIDER_PRODUCTS, PROVIDER_PRODUCTS } from '../lib/provider-products'

test('the supplier section boundary puts status checks before HLR and device services under Unlock', () => {
  for (const group of SERVICE_GROUPS.imei_check) {
    assert.equal(storefrontDomain({ group, domain: 'unlock' }), 'imei_check')
  }
  for (const group of SERVICE_GROUPS.unlock) {
    assert.equal(storefrontDomain({ group, domain: 'imei_check' }), 'unlock')
  }
  assert.equal(storefrontDomain({ group: 'Featured ⭐', domain: 'unlock' }), 'imei_check')
  assert.equal(storefrontDomain({ group: 'New category', domain: 'unlock' }), 'unlock')
})

test('the AT&T status and unlock service moves only its display section, never its checkout identity or retail price', () => {
  const product = PUBLIC_PROVIDER_PRODUCTS.find((entry) => entry.productCode === 'UNLOCK_346')!
  const before = structuredClone(product)
  assert.equal(storefrontDomain(product), 'imei_check')
  const grouped = groupServices([product])
  assert.equal(grouped[0].group, 'Status Check Services')
  assert.strictEqual(grouped[0].products[0], product)
  assert.equal(product.domain, 'unlock')
  assert.deepEqual(product, before)
})

test('grouped customer catalogs contain every published service exactly once and keep restricted or unpriced services out', () => {
  const sections = (['imei_check', 'unlock'] as const).map((domain) =>
    groupServices(PUBLIC_PROVIDER_PRODUCTS.filter((product) => storefrontDomain(product) === domain)))
  const all = sections.flatMap((groups) => groups.flatMap((group) => group.products))
  assert.equal(all.length, PUBLIC_PROVIDER_PRODUCTS.length)
  assert.equal(new Set(all.map((product) => product.productCode)).size, all.length)
  assert.equal(sections[0][0].group, 'Featured')
  assert.equal(sections[0].at(-1)?.group, 'Number Check HLR & PING')
  assert.equal(sections[1][0].group, 'Icloud Bad Case Remove Service')
  assert.equal(sections[1].at(-1)?.group, 'LG')
  for (const hidden of PROVIDER_PRODUCTS.filter((product) => product.status.startsWith('hidden_'))) {
    assert.equal(all.some((product) => product.productCode === hidden.productCode), false)
  }
})
