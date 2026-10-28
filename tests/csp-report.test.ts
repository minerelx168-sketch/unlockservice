import assert from 'node:assert/strict'
import test from 'node:test'
import { summarizeCspReport } from '../lib/csp-report'
const report = (changes: Record<string, unknown> = {}) => ({ 'csp-report': {
  'document-uri': 'https://iunlockmobile.com/track/private?email=private@example.com&imei=123456789012345',
  'blocked-uri': 'https://googleads.g.doubleclick.net/pagead/viewthroughconversion/123?email=private@example.com',
  'effective-directive': 'script-src-elem',
  'script-sample': 'private', referrer: 'https://example.com/private', ...changes,
} })
test('CSP diagnostics retain only allowlisted origin and directive', () => {
  assert.deepEqual(summarizeCspReport(report()), { directive: 'script-src-elem', blockedOrigin: 'https://googleads.g.doubleclick.net' })
  assert.ok(!JSON.stringify(summarizeCspReport(report())).includes('private'))
})
test('CSP diagnostics reject foreign pages, spoofed hosts, credentials and malformed payloads', () => {
  for (const input of [null, [], {}, report({'document-uri':'https://evil.example/'}), report({'blocked-uri':'https://googleads.g.doubleclick.net.evil.example/'}), report({'blocked-uri':'https://secret@www.google.com/'}), report({'blocked-uri':'data:text/plain,private'}), report({'effective-directive':'unknown'})]) assert.equal(summarizeCspReport(input), null)
  assert.deepEqual(summarizeCspReport(report({'blocked-uri':'https://region1.google-analytics.com/g/collect?secret=1','effective-directive':'connect-src'})), {directive:'connect-src', blockedOrigin:'https://region1.google-analytics.com'})
})
