import assert from 'node:assert/strict'
import test from 'node:test'
import {
  imeiProviderService,
  pollProviderRequest,
  providerConfiguration,
  submitProviderRequest,
  unlockProviderService,
} from '../lib/provider-api'

const ENV_KEYS = [
  'IUNLOCKMOBILE_PROVIDER_MODE',
  'IUNLOCKMOBILE_PROVIDER_NAME',
  'IUNLOCKMOBILE_PROVIDER_URL',
  'IUNLOCKMOBILE_PROVIDER_API_KEY',
  'IUNLOCKMOBILE_PROVIDER_DHRU_KEY',
  'IUNLOCKMOBILE_PROVIDER_USERNAME',
  'IUNLOCKMOBILE_UNLOCK_SERVICE_MAP',
  'IUNLOCKMOBILE_IMEI_SERVICE_MAP',
] as const

test('provider core keeps disabled mode safe and normalizes sync plus DHRU responses', async () => {
  const originalFetch = globalThis.fetch
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]])) as Record<string, string | undefined>

  try {
    process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'disabled'
    assert.equal(providerConfiguration().enabled, false)
    assert.equal((await submitProviderRequest({ imei: '490154203237518', service: { id: '1', mode: 'sync' } })).status, 'unavailable')

    process.env.IUNLOCKMOBILE_PROVIDER_MODE = 'enabled'
    process.env.IUNLOCKMOBILE_PROVIDER_NAME = 'unlock-service'
    process.env.IUNLOCKMOBILE_PROVIDER_URL = 'https://provider.example/api'
    process.env.IUNLOCKMOBILE_PROVIDER_API_KEY = 'sync-test-key'
    process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP = JSON.stringify({
      'carrier:103': { id: '901', mode: 'dhru' },
    })
    process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP = JSON.stringify({
      'check:basic': { id: '343', mode: 'sync' },
    })

    assert.deepEqual(unlockProviderService('carrier:103'), { id: '901', mode: 'dhru' })
    assert.deepEqual(imeiProviderService('basic'), { id: '343', mode: 'sync' })
    assert.equal(unlockProviderService('carrier:999'), undefined)

    globalThis.fetch = async (input) => {
      const url = new URL(String(input))
      assert.equal(url.searchParams.get('key'), 'sync-test-key')
      return new Response(
        JSON.stringify({ status: true, response: '', object: { Brand: 'Apple', Model: 'iPhone 15' } }),
        { status: 200 },
      )
    }
    const sync = await submitProviderRequest({
      imei: '490154203237518',
      service: { id: '343', mode: 'sync' },
    })
    assert.equal(sync.status, 'completed')
    if (sync.status === 'completed') {
      assert.equal(sync.data.Brand, 'Apple')
      assert.equal(sync.data.Model, 'iPhone 15')
    }

    process.env.IUNLOCKMOBILE_PROVIDER_DHRU_KEY = 'dhru-test-key'
    process.env.IUNLOCKMOBILE_PROVIDER_USERNAME = 'provider-user'
    let placed = false
    globalThis.fetch = async (input) => {
      const url = new URL(String(input))
      assert.equal(url.searchParams.get('apiaccesskey'), 'dhru-test-key')
      if (url.searchParams.get('action') === 'placeimeiorder') {
        placed = true
        return new Response(JSON.stringify({ SUCCESS: [{ REFERENCEID: 'provider-123' }] }), { status: 200 })
      }
      return new Response(
        JSON.stringify({ SUCCESS: [{ STATUS: 'SUCCESS', REPLY: 'Brand: Apple\nModel: iPhone 15' }] }),
        { status: 200 },
      )
    }

    const submitted = await submitProviderRequest({
      imei: '490154203237518',
      service: { id: '901', mode: 'dhru' },
    })
    assert.equal(placed, true)
    assert.equal(submitted.status, 'processing')
    if (submitted.status === 'processing') assert.equal(submitted.providerId, 'provider-123')

    const polled = await pollProviderRequest('provider-123')
    assert.equal(polled.status, 'completed')
    if (polled.status === 'completed') {
      assert.equal(polled.data.Brand, 'Apple')
      assert.equal(polled.data.Model, 'iPhone 15')
    }
  } finally {
    globalThis.fetch = originalFetch
    for (const key of ENV_KEYS) {
      const value = saved[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  }
})
