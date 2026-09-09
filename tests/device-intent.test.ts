import assert from 'node:assert/strict'
import test from 'node:test'
import {
  DEVICE_INTENT_TTL_SECONDS,
  deviceDomain,
  deviceImei,
  intentImeiFor,
  parseDeviceIntent,
  type DeviceIntent,
} from '../lib/device-intent-value'

const IMEI = '490154203237518'
const NOW = 1_800_000_000_000
const DRAFT: DeviceIntent = {
  imei: IMEI,
  domain: 'imei_check',
  productCode: 'APPLE_BASIC',
  expiresAt: NOW + DEVICE_INTENT_TTL_SECONDS * 1000,
}

test('device input accepts a full IMEI and common pasted formatting', () => {
  for (const value of [IMEI, '49 015420 323751 8', '49-015420-323751-8', ` ${IMEI} `]) {
    assert.equal(deviceImei(value), IMEI)
  }
})

test('device input rejects malformed identifiers instead of silently changing the device', () => {
  for (const value of [
    undefined, null, Number(IMEI), {}, '', '   ', IMEI.slice(0, -1),
    `${IMEI}0`, '490154203237519', `IMEI: ${IMEI}`, `A${IMEI}`, `${IMEI}/`,
    `${' '.repeat(41)}${IMEI}`,
  ]) {
    assert.equal(deviceImei(value), null, String(value))
  }
})

test('service domains are allowlisted', () => {
  assert.equal(deviceDomain('imei_check'), 'imei_check')
  assert.equal(deviceDomain('unlock'), 'unlock')
  for (const value of [null, undefined, {}, 'check', 'UNLOCK', '/user/unlock']) {
    assert.equal(deviceDomain(value), null)
  }
})

test('a current cookie yields only the validated device handoff', () => {
  const raw = JSON.stringify({ ...DRAFT, imei: '49 015420 323751 8', priceCents: 1, returnTo: '//example.com' })
  assert.deepEqual(parseDeviceIntent(raw, NOW), DRAFT)
  const browseDraft = { imei: IMEI, domain: 'imei_check', expiresAt: DRAFT.expiresAt }
  assert.deepEqual(parseDeviceIntent(JSON.stringify(browseDraft), NOW), { ...browseDraft, productCode: undefined })
})

test('expired, excessively long-lived and malformed cookies never prefill a device', () => {
  const malformed = [
    undefined, '', 'not-json', 'null', '[]', 'true', '1', JSON.stringify('draft'),
    JSON.stringify({ ...DRAFT, imei: `${IMEI}0` }),
    JSON.stringify({ ...DRAFT, domain: 'admin' }),
    JSON.stringify({ ...DRAFT, productCode: '/user/reports/new' }),
    JSON.stringify({ ...DRAFT, productCode: 'apple_basic' }),
    JSON.stringify({ ...DRAFT, productCode: null }),
    JSON.stringify({ ...DRAFT, productCode: 'A'.repeat(65) }),
    JSON.stringify({ ...DRAFT, expiresAt: NOW }),
    JSON.stringify({ ...DRAFT, expiresAt: NOW - 1 }),
    JSON.stringify({ ...DRAFT, expiresAt: DRAFT.expiresAt + 1 }),
    JSON.stringify({ ...DRAFT, expiresAt: String(DRAFT.expiresAt) }),
    JSON.stringify({ ...DRAFT, expiresAt: NOW + 0.5 }),
    JSON.stringify({ ...DRAFT, extra: 'x'.repeat(512) }),
  ]
  for (const raw of malformed) assert.equal(parseDeviceIntent(raw, NOW), null)
  assert.equal(parseDeviceIntent(JSON.stringify(DRAFT), DRAFT.expiresAt), null)
})

test('a handoff cannot prefill a different service domain or a conflicting product', () => {
  assert.equal(intentImeiFor(DRAFT, 'imei_check', 'APPLE_BASIC'), IMEI)
  assert.equal(intentImeiFor(DRAFT, 'imei_check'), IMEI)
  assert.equal(intentImeiFor({ ...DRAFT, productCode: undefined }, 'imei_check', 'APPLE_BASIC'), IMEI)
  assert.equal(intentImeiFor(DRAFT, 'unlock', 'APPLE_BASIC'), undefined)
  assert.equal(intentImeiFor(DRAFT, 'imei_check', 'SAMSUNG_INFO'), undefined)
  assert.equal(intentImeiFor(null, 'imei_check', 'APPLE_BASIC'), undefined)
})
