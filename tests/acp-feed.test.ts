import assert from 'node:assert/strict'
import test from 'node:test'
import { BLOCKED_SERVICE_IDS, FEED_FIELDS, buildFeedRows, catalogResolver, csvCell, feedCsv, feedJsonl, publicFeedProduct } from '../lib/acp-feed'
import { PROVIDER_PRODUCTS } from '../lib/provider-products'
import { isMemberUnlock } from '../lib/member-unlocks'
import { DISABLED_PRODUCT_CODES } from '../lib/retail-update-nov12'

const origin = 'https://iunlockmobile.com'
const rows = buildFeedRows(origin, catalogResolver)
const FORBIDDEN = /\bLOST\b|\bLost\b|Owner ID|Bypass|\bMDM\b|Past Due|bit\.ly/
const FALSE_UNLOCK = /(T-Mobile USA|Verizon|Cricket|Bell)[^.]*\b(unlock service|carrier unlock|permanent unlock)\b/i

/** Minimal RFC 4180 parser so the test does not trust the writer it is testing. */
function parseCsv(text: string): string[][] {
  const out: string[][] = []; let row: string[] = []; let cell = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (quoted) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++ } else if (c === '"') quoted = false; else cell += c; continue }
    if (c === '"') quoted = true
    else if (c === ',') { row.push(cell); cell = '' }
    else if (c === '\r' && text[i + 1] === '\n') { row.push(cell); out.push(row); row = []; cell = ''; i++ }
    else cell += c
  }
  return out
}

test('the feed publishes the core PUBLIC services with all nine required fields', () => {
  assert.ok(rows.length >= 15, `expected at least 15 rows, got ${rows.length}`)
  const ids = rows.map((row) => row.item_id)
  for (const id of ['444', '445', '66', '688', '423', '346', '39', '36']) assert.ok(ids.includes(`IUM-SKU-${id}`), id)
  assert.equal(new Set(ids).size, ids.length)
  for (const row of rows) {
    for (const field of FEED_FIELDS) {
      const value = row[field]
      assert.equal(typeof value, 'string', field)
      assert.ok(value.trim().length > 0, `${row.item_id} ${field} empty`)
      assert.doesNotMatch(value, /^(null|n\/a|undefined|none|-)$/i, `${row.item_id} ${field} placeholder`)
    }
    assert.match(row.price, /^\d+\.\d{2} USD$/)
    assert.equal(row.availability, 'in_stock')
    assert.equal(row.brand, 'iUnlockMobile')
    assert.equal(row.seller_name, 'iUnlockMobile')
    assert.match(row.url, /^https:\/\/iunlockmobile\.com\//)
    assert.match(row.image_url, /^https:\/\/iunlockmobile\.com\/api\/product-card\/IUM-SKU-\d+\.png$/)
    assert.doesNotMatch(row.image_url, /\.svg/i)
    assert.doesNotMatch(JSON.stringify(row), FORBIDDEN)
    assert.doesNotMatch(row.title + ' ' + row.description, FALSE_UNLOCK)
  }
})

test('feed prices equal the catalog base prices the pages show', () => {
  const expected: Record<string, string> = { 'IUM-SKU-444': '1.70 USD', 'IUM-SKU-445': '2.95 USD', 'IUM-SKU-66': '1.60 USD', 'IUM-SKU-688': '3.47 USD', 'IUM-SKU-423': '1.97 USD', 'IUM-SKU-346': '8.00 USD', 'IUM-SKU-39': '14.00 USD', 'IUM-SKU-36': '19.99 USD' }
  for (const [id, price] of Object.entries(expected)) assert.equal(rows.find((row) => row.item_id === id)?.price, price, id)
})

test('DISABLED and AUTH_ONLY services can never enter the feed', () => {
  for (const id of ['718', '1000']) assert.equal(publicFeedProduct(id, catalogResolver), null, id)
  for (const row of rows) {
    const serviceId = row.item_id.replace('IUM-SKU-', '')
    const product = PROVIDER_PRODUCTS.find((entry) => entry.serviceId === serviceId)!
    assert.ok(!BLOCKED_SERVICE_IDS.has(serviceId))
    assert.ok(!DISABLED_PRODUCT_CODES.has(product.productCode))
    assert.ok(!isMemberUnlock(product.productCode))
    assert.equal(product.status, 'available')
  }
  // An unorderable or unpriced service is dropped, not published at a stale price.
  assert.equal(publicFeedProduct('444', () => ({ priceCents: 170, orderable: false })), null)
  assert.equal(publicFeedProduct('444', () => ({ priceCents: 0, orderable: true })), null)
})

test('CSV quotes cells with commas, quotes and newlines and round-trips', () => {
  assert.equal(csvCell('plain'), 'plain')
  assert.equal(csvCell('a, b'), '"a, b"')
  assert.equal(csvCell('say "hi"'), '"say ""hi"""')
  const csv = feedCsv(rows)
  const parsed = parseCsv(csv)
  assert.deepEqual(parsed[0].slice(0, 9), [...FEED_FIELDS])
  assert.equal(parsed.length, rows.length + 1)
  parsed.slice(1).forEach((cells, index) => assert.deepEqual(cells.slice(0, 9), FEED_FIELDS.map((field) => rows[index][field])))
})

test('JSONL has one valid object per line', () => {
  const lines = feedJsonl(rows).trim().split('\n')
  assert.equal(lines.length, rows.length)
  for (const line of lines) assert.deepEqual(Object.keys(JSON.parse(line)).slice(0, 9), [...FEED_FIELDS])
})
