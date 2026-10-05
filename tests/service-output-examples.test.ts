import assert from 'node:assert/strict'
import test from 'node:test'
import examples from '../catalog/service-output-examples.json'
import { PROVIDER_PRODUCTS, PUBLIC_PROVIDER_PRODUCTS } from '../lib/provider-products'
import { getServiceOutputExample, hasServiceOutputExample } from '../lib/service-output-examples'
import { GET } from '../app/api/services/[productCode]/example/route'

function assertPublicSample(value: unknown) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value))
  const sample = value as { title: string; variants: Array<{ label: string; output: string }> }
  assert.deepEqual(Object.keys(sample).sort(), ['title', 'variants'])
  assert.equal(typeof sample.title, 'string')
  assert.ok(sample.title.trim())
  assert.ok(Array.isArray(sample.variants) && sample.variants.length > 0)
  for (const variant of sample.variants) {
    assert.deepEqual(Object.keys(variant).sort(), ['label', 'output'])
    assert.equal(typeof variant.label, 'string')
    assert.ok(variant.label.trim())
    assert.equal(typeof variant.output, 'string')
    assert.ok(variant.output.trim())
  }

  const text = [sample.title, ...sample.variants.flatMap(({ label, output }) => [label, output])].join('\n')
  assert.doesNotMatch(text, /[\u0E00-\u0E7F]/u, 'Customer samples must be in English')
  assert.doesNotMatch(text, /[\p{Script=Cyrillic}\p{Script=Han}\p{Script=Arabic}]/u, 'Source-language text needs a reviewed English translation')
  assert.doesNotMatch(text, /<\/?[a-z][^>]*>/i, 'Sample content must be plain text')
  assert.doesNotMatch(text, /(?:https?:\/\/|www\.)\S+/i, 'Raw source URLs must not be published')
  assert.doesNotMatch(text, /[a-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[a-z0-9.-]+\.[a-z]{2,}/i, 'Email addresses must be redacted')
  assert.doesNotMatch(text, /\b(?:\d[\s-]?){14,}\d\b/, 'Full IMEI, EID or other numeric device identifiers must be masked')
  assert.doesNotMatch(text, /\b(?:[a-f\d]{2}[:-]){5}[a-f\d]{2}\b/i, 'Device MAC addresses must be masked')
  assert.doesNotMatch(text, /\b(?:\d{1,3}\.){3}\d{1,3}\b/, 'IP addresses must be masked')
  assert.doesNotMatch(text, /\b(?:service[_ -]?id|providerCostMicros|providerCost|api[_ -]?key)\b/i, 'Provider metadata must stay out of the public sample')

  // Field-aware checks also catch alphanumeric serials and shorter unlock codes,
  // while allowing public model numbers, part numbers and activation-policy IDs.
  const identifierField = /^(?:\[KG\]\s*)?(?:IMEI2?(?: Number)?(?:\/(?:SN|Serial|KeyLock))?|Serial(?: Number)?|S\/N|MEID(?: Number)?|EID(?: Number)?|ICCID|CSN\/CSN2\/EID|(?:eSIM )?CSN|(?:Wireless |Wi-Fi )?Mac Address|(?:NCK|NSCK|SPCK|CPCK|SIMCK|MCK)|Unlock (?:Code|Number)(?: \(FSN\))?|Master Number|Un Number|Lost Number|Device ID|Phone(?: Number)?|Email(?: Address)?|Account(?: ID| Number)|Case(?: ID| Number)|Id|Sold To Name|Product Sold By|Company)\s*[:=]\s*(.+)$/i
  for (const { output } of sample.variants) {
    for (const line of output.split('\n')) {
      const match = line.match(identifierField)
      if (match) assert.equal(match[1], '[redacted]', `Sensitive sample field is not fully redacted: ${line.split(/[:=]/)[0]}`)
    }
  }
}

test('every curated sample has an exact public product mapping and a safe English-only payload', () => {
  const publicCodes = new Set(PUBLIC_PROVIDER_PRODUCTS.map((product) => product.productCode))
  assert.ok(Object.keys(examples).length > 0)
  for (const [code, sample] of Object.entries(examples)) {
    assert.ok(publicCodes.has(code), `Example ${code} is not a published service`)
    assertPublicSample(sample)
    assert.deepEqual(getServiceOutputExample(code), sample, code)
    assert.equal(hasServiceOutputExample(code), true, code)
  }
})

test('unreviewed, hidden and unrelated services never receive a generic or neighbouring example', () => {
  assert.ok(getServiceOutputExample('APPLE_BASIC'))
  for (const code of ['UNLOCK_346', 'CHECK_980', 'CHECK_973', 'HONOR_INFO', 'CHECK_266']) {
    assert.equal(getServiceOutputExample(code), null, `Unclear or mismatched output ${code} remains unpublished`)
  }
  for (const product of PROVIDER_PRODUCTS) {
    const published = product.status === 'available' || product.status === 'coming_soon'
    const reviewed = Object.hasOwn(examples, product.productCode)
    assert.equal(hasServiceOutputExample(product.productCode), published && reviewed, product.productCode)
    if (!published || !reviewed) assert.equal(getServiceOutputExample(product.productCode), null)
  }
})

test('a clear reviewed preview is readable even when the public service is coming soon', async () => {
  const product = PUBLIC_PROVIDER_PRODUCTS.find(({ productCode }) => productCode === 'CHECK_343')
  assert.equal(product?.status, 'coming_soon')
  assert.equal(hasServiceOutputExample('CHECK_343'), true)
  const response = await GET(new Request('https://iunlockmobile.test/api/services/CHECK_343/example'), {
    params: Promise.resolve({ productCode: 'CHECK_343' }),
  })
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { success: true, example: getServiceOutputExample('CHECK_343') })
})

test('example lookup rejects malformed product keys and prototype or path traversal input', () => {
  for (const value of [
    undefined, null, 214, true, [], {}, new String('APPLE_BASIC'),
    '', 'apple_basic', ' APPLE_BASIC', 'APPLE_BASIC ', 'APPLE_BASIC\n',
    '__proto__', 'constructor', 'prototype', 'toString',
    '../APPLE_BASIC', '/APPLE_BASIC', 'APPLE_BASIC/../../', '%2e%2e%2fAPPLE_BASIC',
    'APPLE_BASIC?imei=490154203237518', '214', 'UNLOCK_99999999', 'A'.repeat(65),
  ]) {
    assert.equal(getServiceOutputExample(value), null, String(value))
    assert.equal(hasServiceOutputExample(value), false, String(value))
  }
})

test('callers cannot mutate a later customer sample by editing a returned variant', () => {
  const first = getServiceOutputExample('APPLE_BASIC')
  assert.ok(first)
  const expected = structuredClone(first)
  first.title = 'Changed title'
  first.variants[0].label = 'Changed label'
  first.variants[0].output = 'Changed output'
  first.variants.push({ label: 'Injected', output: 'Injected' })
  assert.deepEqual(getServiceOutputExample('APPLE_BASIC'), expected)
})

test('the public example API returns only the reviewed static display data and can be cached', async () => {
  const request = new Request('https://iunlockmobile.test/api/services/APPLE_BASIC/example?imei=490154203237518', {
    headers: { cookie: 'iunlockmobile_device_intent=private-device-draft' },
  })
  const response = await GET(request, { params: Promise.resolve({ productCode: 'APPLE_BASIC' }) })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') ?? '', /application\/json/)
  assert.match(response.headers.get('cache-control') ?? '', /\bpublic\b/)
  assert.match(response.headers.get('cache-control') ?? '', /\bmax-age=\d+/)
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  assert.equal(response.headers.get('set-cookie'), null)
  const payload = await response.json()
  assert.deepEqual(Object.keys(payload).sort(), ['example', 'success'])
  assert.deepEqual(payload, { success: true, example: getServiceOutputExample('APPLE_BASIC') })
  assertPublicSample(payload.example)
  const serialized = JSON.stringify(payload)
  assert.doesNotMatch(serialized, /490154203237518|private-device-draft/)
  assert.doesNotMatch(serialized, /"(?:serviceId|providerCostMicros|priceCents|userId|balanceCents|orderId)"\s*:/)
})

test('missing or restricted example API requests return a non-cacheable 404 without fallback data', async () => {
  const hiddenCode = PROVIDER_PRODUCTS.find((product) => product.status.startsWith('hidden_'))?.productCode
  assert.ok(hiddenCode, 'The catalog fixture must include a restricted service')
  for (const productCode of ['UNLOCK_346', 'UNKNOWN_SERVICE', '__proto__', hiddenCode]) {
    const response = await GET(new Request('https://iunlockmobile.test/api/services/example'), {
      params: Promise.resolve({ productCode }),
    })
    assert.equal(response.status, 404, productCode)
    assert.match(response.headers.get('cache-control') ?? '', /no-store/)
    const payload = await response.json()
    assert.equal(payload.success, false)
    assert.equal(typeof payload.error, 'string')
    assert.equal(Object.hasOwn(payload, 'example'), false)
    assert.equal(Object.hasOwn(payload, 'variants'), false)
  }
})
