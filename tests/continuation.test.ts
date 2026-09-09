import assert from 'node:assert/strict'
import test from 'node:test'
import { safeContinuation, withContinuation } from '../lib/continuation'

test('retains selected public product across auth and drops unrelated sensitive query values', () => {
  assert.equal(safeContinuation('/user/reports/new?product=APPLE_INFO&imei=354909000000095'), '/user/reports/new?product=APPLE_INFO')
  assert.equal(safeContinuation('/user/add-funds?product=APPLE_INFO'), '/user/add-funds?product=APPLE_INFO')
  assert.equal(safeContinuation('/user/orders/12?secret=ignored'), '/user/orders/12')
  assert.equal(withContinuation('/verify-email?email=buyer%40example.test', '/user/reports/new?product=APPLE_INFO'), '/verify-email?email=buyer%40example.test&next=%2Fuser%2Freports%2Fnew%3Fproduct%3DAPPLE_INFO')
})

test('rejects external, protocol-relative, encoded, control-character and unsupported destinations', () => {
  for (const value of [null, {}, '//example.com', '///example.com', 'https://example.com', '/\\example.com', '/user/reports/new\n', '/%2f%2fexample.com', '/api/orders', '/admin', '/login?next=/login', '/user/reports/new#fragment']) {
    assert.equal(safeContinuation(value), null, String(value))
  }
  assert.equal(safeContinuation('/user/reports/new?product=bad%2Fcode'), '/user/reports/new')
  assert.equal(withContinuation('/login', '//example.com'), '/login')
})

test('an expired invoice session retains only an allowlisted report continuation', () => {
  const invoice = '/user/invoice/0123456789abcdef0123456789abcdef'
  const report = '/user/reports/new?product=APPLE_BASIC'
  const resume = withContinuation(invoice, report)
  assert.equal(safeContinuation(resume), resume)
  assert.equal(safeContinuation(invoice + '?next=' + encodeURIComponent('//example.com')), invoice)
  assert.equal(safeContinuation(invoice + '?next=' + encodeURIComponent('/user/invoice/0123456789abcdef0123456789abcdef')), invoice)
})

test('check and unlock workspaces survive sign-in without exposing device query values', () => {
  for (const path of ['/user/check', '/user/services/unlock']) {
    assert.equal(safeContinuation(path), path)
    assert.equal(safeContinuation(`${path}?imei=490154203237518&product=APPLE_BASIC&next=//example.com`), path)
    assert.equal(withContinuation('/login', path), `/login?next=${encodeURIComponent(path)}`)
    assert.equal(safeContinuation(`${path}/unexpected`), null)
  }
})
