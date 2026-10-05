import assert from 'node:assert/strict'
import test from 'node:test'
import { decryptPaidReportImei, encryptPaidReportImei } from '../lib/paid-report-imei'
import { decryptProviderCode, encryptProviderCode } from '../lib/provider-code'

const imei = '490154203237518'

test('paid report IMEI is encrypted at rest and round-trips exactly', () => {
  const encrypted = encryptPaidReportImei(imei)
  assert.equal(encrypted.includes(imei), false)
  assert.equal(decryptPaidReportImei(encrypted), imei)
})

test('paid report IMEI uses a domain-separated envelope from Provider Code', () => {
  const encryptedImei = encryptPaidReportImei(imei)
  const encryptedCode = encryptProviderCode(imei)
  assert.equal(decryptProviderCode(encryptedImei), null)
  assert.equal(decryptPaidReportImei(encryptedCode), null)
})

test('paid report IMEI rejects malformed input and tampered ciphertext', () => {
  assert.throws(() => encryptPaidReportImei('not-an-imei'), /valid 15-digit IMEI/)
  const encrypted = encryptPaidReportImei(imei)
  const parsed = JSON.parse(encrypted) as { data: string }
  const bytes = Buffer.from(parsed.data, 'base64url')
  bytes[0] ^= 1
  parsed.data = bytes.toString('base64url')
  assert.equal(decryptPaidReportImei(JSON.stringify(parsed)), null)
})
