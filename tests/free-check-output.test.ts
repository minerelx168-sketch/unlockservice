import assert from 'node:assert/strict'
import test from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ProviderOutputText } from '../components/provider-output-text'

test('plain Free Check output preserves provider order, labels and values without interpreting them', () => {
  const text = 'Model: iPhone test\nModel Description: Description\nModel Configuration: Configuration\nReplacement Device: No\nReplaced Device: Yes\nUnknown Provider Field: 1\nBlacklist History: Details: Never been blacklisted\niCloud Status: Clean'
  const html = renderToStaticMarkup(createElement(ProviderOutputText, { value: text, variant: 'plain' }))
  assert.equal(html, '<pre class="provider-output-plain">' + text + '</pre>')
})

test('plain provider output is escaped text and cannot execute provider markup', () => {
  const html = renderToStaticMarkup(createElement(ProviderOutputText, { value: 'Note: <script>alert(1)</script> & text', variant: 'plain' }))
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt; &amp; text'))
  assert.ok(!html.includes('<script>'))
})

test('Apple free polling retains all original provider lines encrypted, like the immediate result', async () => {
  const keys = ['IUNLOCKMOBILE_PROVIDER_MODE', 'IUNLOCKMOBILE_PROVIDER_NAME', 'IUNLOCKMOBILE_PROVIDER_URL', 'IUNLOCKMOBILE_PROVIDER_API_KEY', 'IUNLOCKMOBILE_PROVIDER_DHRU_URL', 'IUNLOCKMOBILE_PROVIDER_DHRU_KEY', 'IUNLOCKMOBILE_PROVIDER_DHRU_USERNAME']
  const previous = new Map(keys.map(key => [key, process.env[key]]))
  const originalFetch = globalThis.fetch
  try {
    Object.assign(process.env, {
      IUNLOCKMOBILE_PROVIDER_MODE: 'enabled', IUNLOCKMOBILE_PROVIDER_NAME: 'unlock-service',
      IUNLOCKMOBILE_PROVIDER_URL: 'https://provider.example.test/api', IUNLOCKMOBILE_PROVIDER_API_KEY: 'test-only',
      IUNLOCKMOBILE_PROVIDER_DHRU_URL: 'https://provider.example.test/dhru', IUNLOCKMOBILE_PROVIDER_DHRU_KEY: 'test-only',
      IUNLOCKMOBILE_PROVIDER_DHRU_USERNAME: 'test-only',
    })
    const raw = 'Model: iPhone test\nModel Configuration: Original configuration\nReplaced Device: Yes\nExtra Provider Field: Exact value'
    globalThis.fetch = async (_input, init) => {
      assert.equal(new URLSearchParams(String(init?.body)).get('action'), 'getimeiorder')
      return Response.json({ SUCCESS: [{ STATUS: 4, CODE: raw }] })
    }
    const { activeImeiCheckProvider } = await import('../lib/imei-check-provider')
    const { decryptProviderCode } = await import('../lib/provider-code')
    const outcome = await activeImeiCheckProvider().poll!('existing-provider-job', 'apple_free')
    assert.equal(outcome.status, 'completed')
    const encrypted = outcome.result?._providerCodeEncrypted as string
    assert.ok(encrypted)
    assert.ok(!encrypted.includes('Exact value'))
    assert.equal(decryptProviderCode(encrypted), raw)
    assert.equal(outcome.result?.checkType, 'APPLE_BASIC')
  } finally {
    globalThis.fetch = originalFetch
    for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value }
  }
})
