import assert from 'node:assert/strict'
import test from 'node:test'
import {
  imeiProviderService,
  pollProviderRequest,
  providerConfiguration,
  submitProviderRequest,
  unlockProviderService,
} from '../lib/provider-api'
import { buildProviderReport } from '../lib/imei-report'

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

    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input))
      assert.equal(url.searchParams.get('key'), null)
      assert.equal(url.searchParams.get('imei'), null)
      assert.equal(init?.method, 'POST')
      const headers = new Headers(init?.headers)
      assert.match(headers.get('content-type') ?? '', /^application\/x-www-form-urlencoded/i)
      const body = new URLSearchParams(String(init?.body))
      assert.equal(body.get('key'), 'sync-test-key')
      assert.equal(body.get('service'), '343')
      assert.equal(body.get('imei'), '490154203237518')
      return new Response(
        JSON.stringify({
          success: true,
          response: 'Model: iPhone 15\\nBlacklist Status: Clean',
          object: [{
            Brand: 'Apple',
            Model: 'iPhone 15',
            IMEI: '490154203237518',
            'Serial Number': 'SERIAL-SECRET-1234',
            blacklistStatus: 'Clean',
            unknownProviderField: 'must not reach the report',
          }],
        }),
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
      assert.equal(sync.data.IMEI, '490154203237518')
      const report = buildProviderReport('APPLE_BASIC', 'unlock-service', sync.data)
      const serialized = JSON.stringify(report)
      assert.equal(report.schemaVersion, 1)
      assert.match(report.title, /iPhone 15/i)
      assert.equal(serialized.includes('490154203237518'), false)
      assert.equal(serialized.includes('SERIAL-SECRET-1234'), false)
      assert.equal(serialized.includes('must not reach the report'), false)
      assert.equal(report.checks.some((item) => item.key === 'blacklist' && item.status === 'passed'), true)
    }

    globalThis.fetch = async () => new Response(
      JSON.stringify({ status: true, response: '', object: { Brand: 'Samsung', Model: 'Galaxy S24' } }),
      { status: 200 },
    )
    const legacySync = await submitProviderRequest({
      imei: '490154203237518',
      service: { id: '343', mode: 'sync' },
    })
    assert.equal(legacySync.status, 'completed')
    if (legacySync.status === 'completed') {
      assert.equal(legacySync.data.Brand, 'Samsung')
      assert.equal(legacySync.data.Model, 'Galaxy S24')
    }

    globalThis.fetch = async () => new Response(
      JSON.stringify({ success: false, response: 'Service temporarily disabled', object: {} }),
      { status: 200 },
    )
    const rejectedSync = await submitProviderRequest({
      imei: '490154203237518',
      service: { id: '343', mode: 'sync' },
    })
    assert.equal(rejectedSync.status, 'unavailable')
    if (rejectedSync.status === 'unavailable') {
      assert.equal(rejectedSync.code, 'provider_rejected')
      assert.equal(rejectedSync.message, 'Service temporarily disabled')
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


test('expanded paid-report profiles remain service-specific, masked and fail-closed', () => {
  const carrier = buildProviderReport('APPLE_CARRIER_PRO_PLUS', 'unlock-service', {
    Model: 'iPhone 15 Pro',
    IMEI: '490154203237518',
    'Serial Number': 'SERIAL-CARRIER-PRIVATE',
    'Next Activation Policy': 'US Reseller Flex Policy',
    'Open Repair Case': 'No',
    providerInternalNote: 'never publish this',
  })
  const carrierJson = JSON.stringify(carrier)
  assert.match(carrierJson, /US Reseller Flex Policy/)
  assert.match(carrierJson, /Open repair case/)
  assert.equal(carrierJson.includes('490154203237518'), false)
  assert.equal(carrierJson.includes('SERIAL-CARRIER-PRIVATE'), false)
  assert.equal(carrierJson.includes('never publish this'), false)

  const gsx = buildProviderReport('APPLE_FULL_GSX', 'unlock-service', {
    'Config Description': 'IPHONE 15 PRO BLACK 256GB',
    IMEI: '490154203237518',
    'Serial Number': 'SERIAL-GSX-PRIVATE',
    'Wireless Mac Address': '00:11:22:33:44:55',
    ICCID: '8901000000000000000',
    'Warranty Status': 'Limited Warranty',
    'Purchase Country': 'United States',
  })
  const gsxJson = JSON.stringify(gsx)
  assert.match(gsxJson, /IPHONE 15 PRO BLACK 256GB/)
  assert.match(gsxJson, /Limited Warranty/)
  assert.equal(gsxJson.includes('490154203237518'), false)
  assert.equal(gsxJson.includes('SERIAL-GSX-PRIVATE'), false)
  assert.equal(gsxJson.includes('00:11:22:33:44:55'), false)
  assert.equal(gsxJson.includes('8901000000000000000'), false)

  const huawei = buildProviderReport('HUAWEI_INFO', 'unlock-service', {
    'Model Description': 'Huawei P60 Pro',
    IMEI: '490154203237518',
    'S/N': 'SERIAL-HUAWEI-PRIVATE',
    'Warranty Status': 'Active',
    'Ship To Customer Name': 'Private Customer Name',
  })
  const huaweiJson = JSON.stringify(huawei)
  assert.match(huaweiJson, /Huawei P60 Pro/)
  assert.match(huaweiJson, /Active/)
  assert.equal(huaweiJson.includes('490154203237518'), false)
  assert.equal(huaweiJson.includes('SERIAL-HUAWEI-PRIVATE'), false)
  assert.equal(huaweiJson.includes('Private Customer Name'), false)

  const tmobile = buildProviderReport('TMOBILE_USA_PRO', 'unlock-service', {
    Model: 'Galaxy S24',
    IMEI: '490154203237518',
    'eSIM CSN': 'PRIVATE-CSN-123',
    'eSIM Supported': 'Yes',
    Status: 'Eligible',
    'Status Description': 'Device is eligible',
  })
  const tmobileJson = JSON.stringify(tmobile)
  assert.match(tmobileJson, /Device is eligible/)
  assert.match(tmobileJson, /eSIM supported/)
  assert.equal(tmobileJson.includes('490154203237518'), false)
  assert.equal(tmobileJson.includes('PRIVATE-CSN-123'), false)

  const unknown = buildProviderReport('CHECK_928', 'unlock-service', {
    Model: 'iPhone 15',
    IMEI: '490154203237518',
    'Sold By': 'Private reseller',
  })
  assert.equal(unknown.sections.length, 0)
  assert.equal(unknown.checks.length, 0)
  assert.match(unknown.summary, /did not return any supported public report fields/i)
})
