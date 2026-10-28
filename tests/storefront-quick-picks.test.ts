import assert from 'node:assert/strict'
import test from 'node:test'
import { quickPicks } from '../lib/quick-picks'
import type { PublicProviderProduct } from '../lib/public-provider-catalog'

function product(name: string, options: Partial<PublicProviderProduct> = {}): PublicProviderProduct {
  return { productCode: name, slug: name, name, summary: name, group: 'Status Check Services',
    domain: 'imei_check', inputType: 'imei', status: 'available', priceCents: 5,
    etaLabel: 'Instant', sortOrder: 1, hasExample: false, priceAvailable: true, ...options }
}

test('homepage shortcuts skip unavailable or unpriced directory listings', () => {
  const available = product('WorldWide GSMA Blacklist Status')
  const picks = quickPicks([
    product('Japan Blacklist Check', { status: 'coming_soon' }),
    product('Blacklist lookup', { priceAvailable: false }),
    available,
  ], 1)
  assert.equal(picks.length, 1)
  assert.strictEqual(picks[0].product, available)
})

test('the any-brand blacklist shortcut does not point to an Apple-only lost-mode report', () => {
  const blacklist = product('WorldWide GSMA Blacklist Status (SIMPLE INFO)')
  const carrier = product('Apple Carrier (Lite)', { group: 'Featured' })
  const picks = quickPicks([carrier, product('Apple iCloud (Clean / Lost)'), blacklist], 2)
  assert.equal(picks[0].short, 'Blacklist')
  assert.strictEqual(picks[0].product, blacklist)
  assert.strictEqual(picks[1].product, carrier)
})

test('view-only listings do not become homepage purchase shortcuts', () => {
  assert.deepEqual(quickPicks([product('Apple Basic Info', { status: 'coming_soon' })]), [])
})
