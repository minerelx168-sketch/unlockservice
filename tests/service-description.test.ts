import assert from 'node:assert/strict'
import test from 'node:test'
import catalog from '../catalog/provider-products.json'
import { serviceDescriptionBlocks } from '../lib/service-description'

test('provider comparison tables keep every heading, row and Yes/No value', () => {
  const products = catalog.products.filter(product => ['APPLE_BASIC', 'APPLE_CARRIER_LITE', 'APPLE_CARRIER_PRO', 'APPLE_CARRIER_PRO_PLUS', 'APPLE_MAX_INFO'].includes(product.productCode))
  assert.equal(products.length, 5)
  for (const product of products) {
    const blocks = serviceDescriptionBlocks(product.summary)
    const table = blocks.find(block => block.kind === 'table')
    assert.ok(table && table.kind === 'table', product.productCode)
    assert.deepEqual(table.headings, ['Report', 'SIM-Lock', 'Carrier Locked', 'Part Number', 'iCloud Status', 'Chimaera Status', 'MDM Status'])
    assert.equal(table.rows.length, 5)
    assert.deepEqual(table.rows[1], ['Carrier Lite', 'Yes', 'Yes', 'No', 'No', 'No', 'No'])
    assert.deepEqual(table.rows[4], ['Max Info Premium', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes', 'Yes'])
    assert.match(blocks.filter(block => block.kind === 'text').map(block => block.text).join('\n'), /Results depend on the data available/)
  }
})

test('known repair tables retain empty cells and never shift another row into their place', () => {
  const blocks = serviceDescriptionBlocks('Type |\nComponent Description |\nIssue Description |\nCUST |\nKeyboard |\n|\nTECH |\nPower |\nNo power |')
  assert.deepEqual(blocks, [{ kind: 'table', headings: ['Type', 'Component Description', 'Issue Description'], rows: [['CUST', 'Keyboard', ''], ['TECH', 'Power', 'No power']] }])
})

test('unknown or incomplete tables and markup remain plain text without invented values', () => {
  for (const value of ['Unknown |\nFormat |\n1 |', 'Type |\nComponent Description |\nIssue Description |\nMissing |', '<script>alert(1)</script>\nStatus: 1']) {
    assert.deepEqual(serviceDescriptionBlocks(value), [{ kind: 'text', text: value }])
  }
})
