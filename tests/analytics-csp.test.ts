import assert from 'node:assert/strict'
import test from 'node:test'
import { NextRequest } from 'next/server'
import { middleware } from '../middleware'

function directives(response: ReturnType<typeof middleware>) {
  const header = response.headers.get('content-security-policy')
  assert.ok(header)
  return new Map(header.split(';').map(entry => {
    const [name, ...values] = entry.trim().split(/\s+/)
    return [name, values] as const
  }))
}

test('CSP allows base and regional Analytics collectors for images and connections only', () => {
  const policy = directives(middleware(new NextRequest('https://iunlockmobile.com/')))
  for (const directive of ['img-src', 'connect-src']) {
    for (const source of ['https://*.google-analytics.com', 'https://analytics.google.com', 'https://*.analytics.google.com']) assert.ok(policy.get(directive)?.includes(source), `${directive} must allow ${source}`)
    assert.ok(!policy.get(directive)?.includes('*'))
    assert.ok(!policy.get(directive)?.includes('https:'))
    assert.ok(!policy.get(directive)?.includes('https://*.google.com'))
  }
  for (const [directive, values] of policy) {
    if (['img-src', 'connect-src'].includes(directive)) continue
    assert.ok(!values.includes('https://analytics.google.com'), directive)
    assert.ok(!values.includes('https://*.analytics.google.com'), directive)
  }
  assert.ok(policy.get('connect-src')?.includes('https://stats.g.doubleclick.net'))
  assert.ok(!policy.get('img-src')?.includes('https://stats.g.doubleclick.net'))
  for (const source of ['https://ad.doubleclick.net', 'https://www.google.com', 'https://www.googleadservices.com']) assert.equal(policy.get('connect-src')?.filter(value => value === source).length, 1)
})

test('collector compatibility preserves per-request nonce and restrictive script and framing policy', () => {
  const first = directives(middleware(new NextRequest('https://iunlockmobile.com/')))
  const second = directives(middleware(new NextRequest('https://iunlockmobile.com/')))
  const nonce = (policy: Map<string, string[]>) => policy.get('script-src')?.find(source => /^'nonce-[a-f0-9]{32}'$/.test(source))
  assert.ok(nonce(first))
  assert.notEqual(nonce(first), nonce(second))
  assert.ok(first.get('script-src')?.includes("'strict-dynamic'"))
  assert.ok(!first.get('script-src')?.includes("'unsafe-inline'"))
  if (process.env.NODE_ENV !== 'development') assert.ok(!first.get('script-src')?.includes("'unsafe-eval'"))
  for (const directive of ['frame-ancestors', 'object-src', 'base-uri']) assert.deepEqual(first.get(directive), ["'none'"])
  assert.deepEqual(first.get('form-action'), ["'self'"])
  assert.deepEqual(first.get('upgrade-insecure-requests'), [])
  assert.equal(directives(middleware(new NextRequest('http://localhost:3000/'))).has('upgrade-insecure-requests'), false)
})
