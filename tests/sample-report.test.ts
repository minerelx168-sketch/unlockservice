import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { badgeFor, iconForLabel, sampleRows } from '../lib/sample-report'
import { preferredSample, quickPicks } from '../lib/quick-picks'
import type { PublicProviderProduct } from '../lib/public-provider-catalog'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

const BLACKLIST = [
  'Model Name: APPLE IPHONE 11 PRO (A2160)',
  'Manufacturer: APPLE INC',
  'Blacklist Status: BLACKLISTED',
  'Blacklisted (FRAUD) By: VERIZON WIRELESS',
  'Blacklisted (FRAUD) Country: US',
  'Blacklisted (FRAUD) On: 24/01/2020 10:31:00',
  'Note: Reported stolen on 29/01/17',
].join('\n')

test('the sample card leads with the device, then every verdict, and never shows a redacted field', () => {
  const table = sampleRows(`IMEI: [redacted]\n${BLACKLIST}`, 6)
  assert.ok(table)
  assert.equal(table.total, 7)
  assert.equal(table.rows.length, 6)
  assert.equal(table.rows[0].label, 'Model Name')
  assert.equal(table.rows[1].label, 'Blacklist Status')
  assert.equal(table.rows[1].tone, 'bad')
  assert.ok(table.rows.every((row) => row.value !== '[redacted]'))
  assert.equal(sampleRows('CODE 1234 5678', 6), null)
})

test('row icons and badges follow the label and the tone', () => {
  assert.equal(iconForLabel('Blacklist Status'), 'shield')
  assert.equal(iconForLabel('Warranty Status'), 'shieldCheck')
  assert.equal(iconForLabel('Sim-Lock'), 'lock')
  assert.equal(iconForLabel('Model Description'), 'device')
  assert.equal(iconForLabel('Purchased In'), 'globe')
  assert.equal(iconForLabel('Estimated Purchase Date'), 'clock')
  assert.equal(iconForLabel('Something Else'), 'file')
  assert.equal(badgeFor('good'), 'Clear')
  assert.equal(badgeFor('warn'), 'Attention')
  assert.equal(badgeFor('bad'), 'Flagged')
  assert.equal(badgeFor(null), null)
})

function product(code: string, name: string): PublicProviderProduct {
  return {
    productCode: code,
    slug: code.toLowerCase(),
    name,
    summary: '',
    group: 'Status Check Services',
    domain: 'imei_check',
    inputType: 'imei',
    status: 'available',
    priceCents: 100,
    etaLabel: 'Instant',
    sortOrder: 1,
  } as PublicProviderProduct
}

test('quick picks follow the catalog and the landing sample prefers the blacklist report', () => {
  const products = [
    product('A', 'Apple Basic Info'),
    product('B', 'WorldWide GSMA Blacklist Status (FULL INFO)'),
    product('C', 'Apple Carrier (Lite)'),
    product('D', 'SAMSUNG (Knox Guard Status)'),
  ]
  const picks = quickPicks(products)
  assert.deepEqual(picks.map((pick) => pick.product.productCode), ['B', 'C', 'A', 'D'])
  assert.deepEqual(quickPicks(products, 2).map((pick) => pick.short), ['Blacklist', 'Carrier & lock'])
  assert.equal(quickPicks([product('Z', 'HLR Lookup')]).length, 0)
  const sample = preferredSample(products.map((entry) => ({ product: entry })))
  assert.equal(sample?.product.productCode, 'B')
})

test('every landing sample is labelled as an example and shows a masked identifier only', () => {
  // Unlock now opens with the quote form; Phone Check retains the sample report.
  const samplePage = read('app/(marketing)/services/imei-check/page.tsx')
  assert.match(samplePage, /<SampleReportCard/)
  assert.match(samplePage, /pill="Example/)
  assert.match(samplePage, /imei="35•• •••• ••80"/)
  for (const path of ['app/(marketing)/services/imei-check/page.tsx', 'app/(marketing)/services/unlock/page.tsx']) {
    const source = read(path)
    assert.doesNotMatch(source, /LIVE DATA|Live source|Bank-grade|6,000\+|Trusted by/i)
  }
  const card = read('components/sample-report-card.tsx')
  assert.doesNotMatch(card, /fetch\(|useEffect/)
})
