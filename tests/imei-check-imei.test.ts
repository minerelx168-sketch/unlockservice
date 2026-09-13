import assert from 'node:assert/strict'
import test from 'node:test'
import { decryptImeiCheckImei, encryptImeiCheckImei } from '../lib/imei-check-imei'
import { encryptPaidReportImei } from '../lib/paid-report-imei'

const IMEI = '490154203237518'

test('free-check IMEI encryption round-trips without plaintext at rest', () => {
  const encrypted = encryptImeiCheckImei(IMEI)
  assert.doesNotMatch(encrypted, new RegExp(IMEI))
  assert.equal(decryptImeiCheckImei(encrypted), IMEI)
})

test('free-check and paid-report IMEI encryption use separate domains', () => {
  const freeCheck = encryptImeiCheckImei(IMEI)
  const paidReport = encryptPaidReportImei(IMEI)
  assert.equal(decryptImeiCheckImei(paidReport), null)
  assert.notEqual(freeCheck, paidReport)
})

test('free-check IMEI encryption rejects modified ciphertext', () => {
  const parsed = JSON.parse(encryptImeiCheckImei(IMEI)) as { data: string }
  const bytes = Buffer.from(parsed.data, 'base64url')
  bytes[0] ^= 1
  parsed.data = bytes.toString('base64url')
  assert.equal(decryptImeiCheckImei(JSON.stringify(parsed)), null)
})

test('free-check IMEI encryption rejects invalid values', () => {
  assert.throws(() => encryptImeiCheckImei('123'))
  assert.equal(decryptImeiCheckImei('not-json'), null)
})
