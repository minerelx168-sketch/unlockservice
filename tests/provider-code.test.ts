import assert from 'node:assert/strict'
import test from 'node:test'
import {
  decryptProviderCode,
  encryptProviderCode,
  normalizeProviderCode,
  providerCodeDigest,
  providerCodeFromData,
} from '../lib/provider-code'

const SECRET_KEY = 'IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET'

test('Provider Code preserves business lines and redacts echoed credentials', () => {
  const input = 'Model: Device X<br>IMEI: 490154203237518\napiaccesskey: should-not-leak\nBearer abc.def-123'
  const normalized = normalizeProviderCode(input)
  assert.equal(
    normalized,
    'Model: Device X\nIMEI: 490154203237518\napiaccesskey: ***\nBearer ***',
  )

  const fallback = providerCodeFromData({
    Model: 'Device X',
    unknownProviderField: 'included in full Code',
    nested: { ignored: true },
  })
  assert.equal(fallback, 'Model: Device X\nunknownProviderField: included in full Code')
})

test('Provider Code is encrypted at rest and rejects tampering or the wrong key', () => {
  const saved = process.env[SECRET_KEY]
  try {
    process.env[SECRET_KEY] = 'test-provider-code-secret-0123456789abcdef'
    const code = 'Model: Device X\nIMEI: 490154203237518\nUnknown: complete value'
    const encrypted = encryptProviderCode(code)
    assert.ok(encrypted)
    assert.equal(encrypted.includes('490154203237518'), false)
    assert.equal(encrypted.includes('complete value'), false)
    assert.equal(decryptProviderCode(encrypted), code)
    assert.equal(providerCodeDigest(code), providerCodeDigest(code))

    const envelope = JSON.parse(encrypted) as { data: string }
    envelope.data = `${envelope.data.startsWith('A') ? 'B' : 'A'}${envelope.data.slice(1)}`
    assert.equal(decryptProviderCode(JSON.stringify(envelope)), null)

    process.env[SECRET_KEY] = 'different-provider-code-secret-abcdef0123456789'
    assert.equal(decryptProviderCode(encrypted), null)
  } finally {
    if (saved === undefined) delete process.env[SECRET_KEY]
    else process.env[SECRET_KEY] = saved
  }
})
