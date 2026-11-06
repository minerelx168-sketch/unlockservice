import assert from 'node:assert/strict'
import test from 'node:test'
import { serviceSpokeSchema, serializeServiceSchema } from '../lib/service-spoke-schema'
import { SERVICE_SPOKES } from '../lib/service-spokes'
import type { PublicProviderProduct } from '../lib/public-provider-catalog'

const product: PublicProviderProduct = {
  productCode: 'APPLE_CARRIER_LITE', slug: 'apple-carrier-lite', name: 'Carrier Lite',
  summary: 'Carrier and lock report', group: 'Apple', domain: 'imei_check',
  inputType: 'imei', status: 'available', priceCents: 170, priceAvailable: true,
  etaLabel: 'Instant', sortOrder: 1, hasExample: true,
}
const schemaFor = (p: PublicProviderProduct) => serviceSpokeSchema(SERVICE_SPOKES[1], [p], 'https://iunlockmobile.com')

test('search offers show the payable card total, including rounding and minimum', () => {
  for (const [priceCents, expected] of [[170, '1.79'], [75, '1.05'], [800, '8.40']] as const) {
    const schema = schemaFor({ ...product, priceCents })
    const service = schema['@graph'][1]
    assert.ok('offers' in service)
    assert.equal(service.offers?.price, expected)
    assert.equal(service.offers?.priceCurrency, 'USD')
  }
})

test('unavailable and unquoted services do not advertise purchasable offers', () => {
  for (const changed of [{ status: 'coming_soon' as const }, { priceAvailable: false, priceCents: 0 }]) {
    const service = schemaFor({ ...product, ...changed })['@graph'][1]
    assert.equal('offers' in service, false)
  }
})

test('catalog text cannot terminate the schema script and is preserved on parse', () => {
  const schema = schemaFor({ ...product, summary: '</script><img src=x onerror=alert(1)>' })
  const serialized = serializeServiceSchema(schema)
  assert.equal(serialized.includes('<'), false)
  assert.deepEqual(JSON.parse(serialized), schema)
})
