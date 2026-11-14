import test from 'node:test'
import assert from 'node:assert/strict'
import { ARTICLE_REPORT_CODE, carrierFunnelItem, carrierFunnelItemById } from '../lib/article-report-offer'
import { allowlistedFunnelParams } from '../lib/funnel-analytics'
import { providerProductByCode } from '../lib/provider-products'

test('article offer and existing Lite report keep separate, catalog-backed analytics identities', () => {
  assert.equal(ARTICLE_REPORT_CODE, 'APPLE_CARRIER_PRO_PLUS')
  for (const code of [ARTICLE_REPORT_CODE, 'APPLE_CARRIER_LITE']) {
    const catalog = providerProductByCode(code)!
    const item = carrierFunnelItem(code)
    assert.deepEqual(item, {id:catalog.serviceId, name:catalog.name})
    assert.equal(carrierFunnelItemById(item!.id), item)
    assert.deepEqual(allowlistedFunnelParams({item_id:item!.id, email:'dummy@example.invalid'}), {item_id:item!.id})
  }
  assert.deepEqual(allowlistedFunnelParams({item_id:'490154203237518'}), {})
})
