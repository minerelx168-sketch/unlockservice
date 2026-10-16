import assert from 'node:assert/strict'
import { test } from 'node:test'
import { parseReport, toneFor } from '../lib/report-card-parse'

test('a yes is bad under a blocking label and good under a warranty label', () => {
  assert.equal(toneFor('Blacklisted', 'Yes'), 'bad')
  assert.equal(toneFor('Lost or Stolen', 'Yes'), 'bad')
  assert.equal(toneFor('Blacklist Status', 'Blacklisted'), 'bad')
  assert.equal(toneFor('Blacklist Status', 'Clean'), 'good')
  assert.equal(toneFor('Under Warranty', 'No'), 'warn')
  assert.equal(toneFor('Under Warranty', 'Yes'), 'good')
  assert.equal(toneFor('Purchase Date Validated', 'Yes'), 'good')
  assert.equal(toneFor('Activated', 'Yes'), 'good')
})

test('locks an owner can clear are cautions, not failures', () => {
  assert.equal(toneFor('Find My iPhone', 'ON'), 'warn')
  assert.equal(toneFor('Find My iPhone', 'OFF'), 'good')
  assert.equal(toneFor('SIM Lock', 'Locked'), 'warn')
  assert.equal(toneFor('SIM Lock', 'Unlocked'), 'good')
  assert.equal(toneFor('iCloud Status', 'Lost'), 'bad')
  assert.equal(toneFor('Refurbished', 'Yes'), 'warn')
  assert.equal(toneFor('Demo Unit', 'No'), 'good')
})

test('an unknown label with a yes or no gets no colour instead of a guess', () => {
  assert.equal(toneFor('Dual SIM', 'Yes'), null)
  assert.equal(toneFor('eSIM', 'No'), null)
  assert.equal(toneFor('Model', 'iPhone 13'), null)
  assert.equal(toneFor('Anything', 'Unknown'), 'warn')
})

test('rows are grouped into critical, identity and details', () => {
  const report = parseReport(
    [
      'Model: iPhone 13 128GB Midnight',
      'IMEI: 350000000000000',
      'Serial Number: F2LXXXXXXXXX',
      'Blacklist Status: Clean',
      'Find My iPhone: ON',
      'SIM Lock: Locked',
      'Estimated Purchase Date: 2024-01-15',
    ].join('\n'),
  )
  assert.ok(report)
  assert.deepEqual(report.critical.map((row) => `${row.label}=${row.tone}`), [
    'Blacklist Status=good',
    'Find My iPhone=warn',
    'SIM Lock=warn',
  ])
  assert.deepEqual(report.identity.map((row) => row.label), ['Model', 'IMEI', 'Serial Number'])
  assert.deepEqual(report.details.map((row) => row.label), ['Estimated Purchase Date'])
})

test('codes and prose are not reports', () => {
  assert.equal(parseReport('4187 2290'), null)
  assert.equal(parseReport('Your device has been unlocked.\nInsert a new SIM and restart.'), null)
  assert.equal(parseReport('Only one: line'), null)
  const mostlyProse = parseReport(['Note: this is text', 'and this line has no key', 'nor does this one', 'or this'].join('\n'))
  assert.equal(mostlyProse, null)
})
