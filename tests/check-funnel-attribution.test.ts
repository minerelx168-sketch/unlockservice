import assert from 'node:assert/strict'
import test, { after } from 'node:test'
import { createHmac } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { allowlistedFunnelParams, trackFunnelEvent } from '../lib/funnel-analytics'
import { validateClickId, ATTRIBUTION_MAX_AGE_SECONDS } from '../lib/attribution'
import { encodeSignedConsent, parseSignedConsent, parseAttributionCookie, snapshotWebsiteAttribution } from '../lib/order-attribution'
const dir = mkdtempSync(join(tmpdir(), 'check-attribution-'))
process.env.IUNLOCKMOBILE_DB = join(dir, 'qa.db')
process.env.IUNLOCKMOBILE_ATTRIBUTION_SECRET = 'synthetic-attribution-key-for-isolated-test-only'
after(() => rmSync(dir, { recursive: true, force: true }))
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
test('all three click IDs validate strictly without PII-shaped unsafe inputs', () => {
  for (const id of ['', 'a'.repeat(129), 'a@example.test', 'a b', '<script>', 'x\n']) assert.equal(validateClickId(id), undefined)
  assert.equal(validateClickId('abc._~-123'), 'abc._~-123')
  assert.equal(validateClickId(123), undefined)
})
test('signed attribution round-trips all IDs and rejects denial or plain unsigned cookie', () => {
  const now = 1000000000
  const data = { gclid: 'g-123', gbraid: 'gb_123', wbraid: 'wb.123' }
  const value = encodeSignedConsent('granted', data, now)
  assert.deepEqual(parseAttributionCookie(value, now), { consent: 'granted', ...data })
  assert.equal(parseAttributionCookie('gclid=g-123&consent=granted', now), null)
  assert.equal(parseAttributionCookie(encodeSignedConsent('denied', data, now), now), null)
  assert.deepEqual(parseSignedConsent(encodeSignedConsent('denied', data, now), now), { consent: 'denied' })
})
test('expiry, future issuance, tampering, malformed signatures and wrong key fail closed', () => {
  const now = 1000000000, value = encodeSignedConsent('granted', { gclid: 'g-123' }, now)
  assert.ok(parseAttributionCookie(value, now + ATTRIBUTION_MAX_AGE_SECONDS * 1000 - 1))
  assert.equal(parseAttributionCookie(value, now + ATTRIBUTION_MAX_AGE_SECONDS * 1000), null)
  assert.equal(parseAttributionCookie(value, now - 1), null)
  for (const cookie of ['a.b', value + '.x', value.slice(0, -2) + 'zz', 'a'.repeat(1025)]) assert.equal(parseAttributionCookie(cookie, now), null)
  const previous = process.env.IUNLOCKMOBILE_ATTRIBUTION_SECRET
  process.env.IUNLOCKMOBILE_ATTRIBUTION_SECRET = 'different-key-at-least-32-characters-long'
  assert.equal(parseAttributionCookie(value, now), null)
  process.env.IUNLOCKMOBILE_ATTRIBUTION_SECRET = previous
})
test('even correctly signed invalid TTL and malformed identifiers fail validation', () => {
  const now = 1000000000
  const sign = (data: unknown) => {
    const payload = Buffer.from(JSON.stringify(data)).toString('base64url')
    return `${payload}.${createHmac('sha256', process.env.IUNLOCKMOBILE_ATTRIBUTION_SECRET!).update(`website-attribution-v1:${payload}`).digest('base64url')}`
  }
  const base = { version: 1, consent: 'granted', issuedAt: now, expiresAt: now + 1000, gclid: 'good' }
  for (const data of [{ ...base, expiresAt: now + (ATTRIBUTION_MAX_AGE_SECONDS + 1) * 1000 }, { ...base, gclid: 'bad email@example.test' }, { ...base, issuedAt: '0' }, { ...base, version: 2 }]) assert.equal(parseAttributionCookie(sign(data), now), null)
})
test('best-effort helper never throws outside Next request context or invalid/API order input', async () => {
  await assert.doesNotReject(snapshotWebsiteAttribution('order', 1, 'website'))
  await assert.doesNotReject(snapshotWebsiteAttribution('order', 1, 'api'))
  await assert.doesNotReject(snapshotWebsiteAttribution('paid_report_order', NaN, 'website'))
})
test('additive attribution schema preserves existing tables, unique first snapshot, separate namespaces', async () => {
  const { db } = await import('../lib/db')
  const connection = db()
  const insert = connection.prepare("INSERT INTO order_attribution (order_type, order_id, gclid, consent_state) VALUES (?, ?, ?, 'granted') ON CONFLICT(order_type, order_id) DO NOTHING")
  insert.run('order', 1, 'first'); insert.run('order', 1, 'second'); insert.run('paid_report_order', 1, 'report')
  assert.equal((connection.prepare("SELECT gclid FROM order_attribution WHERE order_type='order'").get() as { gclid: string }).gclid, 'first')
  assert.equal((connection.prepare('SELECT count(*) AS n FROM order_attribution').get() as { n: number }).n, 2)
  assert.ok(connection.prepare("SELECT name FROM sqlite_master WHERE name='credit_ledger'").get())
})
test('funnel allowlist strips identifiers, unknown keys and arbitrary unsafe strings', () => {
  assert.deepEqual(allowlistedFunnelParams({ service_category: 'imei_check', status: 'completed', value: 2.5, currency: 'USD', imei: '490154203237518', email: 'private@example.test', wallet: '0xabc', transaction_id: 'secret', order_id: 1, product_code: 'private@example.test', csrfToken: 'secret', name: 'Name', source: 'text with spaces', consent: true, unknown: 1 }), { service_category: 'imei_check', status: 'completed', value: 2.5, currency: 'USD', consent: true })
  assert.deepEqual(allowlistedFunnelParams({ value: Infinity, currency: 'x'.repeat(81) }), {})
})
test('funnel transport is denied until consent and emits exactly one gtag event without PII', () => {
  const calls: unknown[][] = []
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const browser = { iunlockmobileAnalyticsConsent: 'denied', gtag: (...args: unknown[]) => calls.push(args) }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser })
  try {
    trackFunnelEvent('service_selection', { service_category: 'unlock', email: 'secret@example.test' }); assert.equal(calls.length, 0)
    browser.iunlockmobileAnalyticsConsent = 'granted'
    trackFunnelEvent('service_selection', { service_category: 'unlock', imei: '490154203237518' })
    assert.deepEqual(calls, [['event', 'service_selection', { service_category: 'unlock' }]])
  } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window') }
})
test('public pricing and structured free results require no login or provider network request', () => {
  const check = read('app/(marketing)/check/page.tsx'), form = read('components/imei-check-form.tsx')
  assert.match(check, /<ImeiCheckForm csrfToken=\{found\?\.session\.csrfToken\} \/>/); assert.match(check, /listPublicProviderProducts\('imei_check'\)/); assert.match(check, /<ServiceBrowser products=/)
  assert.match(form, /<table className="validation-results"/); assert.match(form, /15-digit format/); assert.match(form, /Luhn checksum/)
  const submit = form.slice(form.indexOf('  async function submit'), form.indexOf('  function reset'))
  assert.match(submit, /if \(csrfToken\)/); assert.match(submit, /JSON.stringify\(\{ imei: digits, csrfToken \}\)/); assert.match(submit, /else \{[\s\S]*localResult\(digits\)/)
  const local = read('lib/imei-check-provider.ts').split('const configuredImeiProvider')[0]
  assert.doesNotMatch(local, /demo:|source:|nextStep:/)
})
test('consent defaults precede Google configuration and no GTM/custom conversion replacement is installed', () => {
  const layout = read('app/layout.tsx')
  assert.ok(layout.indexOf("gtag('consent', 'default'") < layout.indexOf("gtag('config'"))
  assert.match(layout, /analytics_storage: 'denied'/); assert.match(layout, /page_location: location.origin/); assert.match(layout, /'\/account'/)
  assert.doesNotMatch(layout, /GTM-PDB4DNWC|gtm\.js|iunlockmobile_purchase/)
  assert.match(read('components/google-ads-purchase-conversion.tsx'), /AW-18465855968\/NzXJCKKYj5QdEOCzmuVE/)
  const route = read('app/api/consent/route.ts')
  assert.match(route, /httpOnly: true/); assert.match(route, /sameSite: 'lax'/); assert.match(route, /maxAge: 0/); assert.match(route, /encodeSignedConsent/)
})
test('remaining paid and payment hooks keep acceptance/verification distinct from purchase', () => {
  assert.match(read('components/paid-report-console.tsx'), /trackFunnelEvent\('order_submission'/)
  assert.match(read('components/paid-report-console.tsx'), /trackFunnelEvent\('order_accepted'/)
  assert.match(read('components/payment-forms.tsx'), /payment_verification_requested/)
  assert.match(read('components/payment-funnel-events.tsx'), /settled \? \['payment_completed'\]/)
  for (const path of ['components/payment-forms.tsx', 'components/payment-funnel-events.tsx']) assert.doesNotMatch(read(path), /GoogleAdsPurchaseConversion|'conversion'/)
  assert.match(read('lib/orders.ts'), /await snapshotWebsiteAttribution\('order', orderId, source\)/)
  assert.match(read('lib/paid-reports.ts'), /await snapshotWebsiteAttribution\('paid_report_order', row.id, source\)/)
  assert.match(read('app/(auth)/privacy/page.tsx'), /90 days/)
})

test('consent route refuses missing/cross-site origin before reading cookies', async () => {
  const { POST } = await import('../app/api/consent/route')
  for (const origin of [undefined, 'https://evil.example']) {
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-requested-with': 'XMLHttpRequest', host: 'iunlockmobile.com' }
    if (origin) headers.origin = origin
    const response = await POST(new Request('https://iunlockmobile.com/api/consent', { method: 'POST', headers, body: JSON.stringify({ consent: 'granted', gclid: 'test' }) }))
    assert.equal(response.status, 403)
  }
})
test('consent API rejects malformed choice and invalid click ID without setting cookies', async () => {
  const { POST } = await import('../app/api/consent/route')
  for (const body of [{ consent: 'unknown' }, { consent: 'granted', gclid: 'a@example.test' }]) {
    const response = await POST(new Request('http://localhost:3000/api/consent', { method: 'POST', headers: { origin: 'https://iunlockmobile.com', host: 'iunlockmobile.com', 'x-requested-with': 'XMLHttpRequest', 'content-type': 'application/json' }, body: JSON.stringify(body) }))
    assert.equal(response.status, 400)
  }
})
