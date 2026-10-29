import assert from 'node:assert/strict'
import test from 'node:test'
import margins from '../catalog/service-margins.json'
import { PROVIDER_PRODUCTS } from '../lib/provider-products'
import { marginCents, serviceCostCents, serviceForCode, serviceForProviderId } from '../lib/service-margins'

test('spec example: AT&T USA Clean (718) $4.99 - $0.05 = $4.94', () => {
  assert.equal(serviceCostCents('718'), 5)
  assert.deepEqual(marginCents('718', 499), { valueCents: 494, known: true })
  const product = PROVIDER_PRODUCTS.find((p) => p.serviceId === '718')!
  assert.equal(serviceForCode(product.productCode).serviceId, '718')
  assert.equal(serviceForCode(product.productCode).category, product.group)
})

test('fractional costs round up so a margin is never overstated; never negative', () => {
  assert.equal(serviceCostCents('806'), 2) // $0.015
  assert.deepEqual(marginCents('806', 295), { valueCents: 293, known: true })
  assert.deepEqual(marginCents('718', 3), { valueCents: 0, known: true })
})

test('unknown service never reports revenue as value: 0 and flagged', () => {
  assert.deepEqual(marginCents(null, 150), { valueCents: 0, known: false })
  assert.equal(serviceForProviderId('not-a-number').serviceId, null)
  assert.equal(serviceForCode('CHECK_99999').serviceId, '99999')
})

test('every available service has a cost and the sheet matches its retail price', () => {
  const sheet = (margins as { services: Record<string, { retail_usd: number; cost_usd: number }> }).services
  for (const product of PROVIDER_PRODUCTS.filter((p) => p.status === 'available')) {
    assert.ok(sheet[product.serviceId], `${product.serviceId} missing from service-margins.json`)
    assert.equal(Math.round(sheet[product.serviceId].retail_usd * 100), product.priceCents, `${product.serviceId} retail differs from the storefront`)
  }
})
