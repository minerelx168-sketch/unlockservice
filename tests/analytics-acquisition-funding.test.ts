import assert from 'node:assert/strict'
import test from 'node:test'
import { runInNewContext } from 'node:vm'
import { readFileSync } from 'node:fs'
import { safeAnalyticsPage } from '../lib/analytics-page'
import { trackFunnelEventOnce } from '../lib/funnel-analytics'

test('acquisition retains only bounded campaign labels and external referrer origin', () => {
  assert.deepEqual(safeAnalyticsPage('https://iunlockmobile.com/services/unlock?utm_source=google&utm_medium=cpc&utm_campaign=autumn-unlock-2026&utm_id=12345678901&utm_content=hero-a&utm_term=private+search&email=private@example.test&imei=351212582890071&gclid=click-secret#private', 'https://www.google.com/search?q=private+search'), {
    page_location: 'https://iunlockmobile.com/services/unlock', page_referrer: 'https://www.google.com', page_title: 'iUnlockMobile',
    campaign_source: 'google', campaign_medium: 'cpc', campaign_name: 'autumn-unlock-2026', campaign_id: '12345678901', campaign_content: 'hero-a',
  })
})

test('private paths, identifiers, arbitrary queries and free-text campaign values never enter page context', () => {
  const expected = { page_location: 'https://iunlockmobile.com/account', page_referrer: '', page_title: 'iUnlockMobile' }
  for (const path of ['/user/invoice/private-secret', '/admin/payments', '/api/private']) {
    assert.deepEqual(safeAnalyticsPage(`https://iunlockmobile.com${path}?utm_campaign=private%40example.test&utm_source=https%3A%2F%2Fevil.test&utm_medium=has+spaces&utm_id=351212582890071&utm_content=${'a'.repeat(81)}&token=secret`, 'https://iunlockmobile.com/user/reports/private-secret'), expected)
  }
  assert.equal(safeAnalyticsPage('https://iunlockmobile.com/track/351212582890071', '').page_location, 'https://iunlockmobile.com/')
  assert.equal(safeAnalyticsPage('https://iunlockmobile.com/track/private%40example.test', '').page_location, 'https://iunlockmobile.com/')
  assert.equal(safeAnalyticsPage('https://iunlockmobile.com/?utm_campaign=35-121-258-289-007-1', '').campaign_name, undefined)
})

test('invalid, credential-bearing, local and authentication referrers are omitted', () => {
  for (const referrer of ['not a URL', 'javascript:alert(1)', 'https://name:password@external.test/private', 'http://192.168.1.1/private', 'http://localhost/private', 'https://accounts.google.com/o/oauth?code=secret']) {
    assert.equal(safeAnalyticsPage('https://iunlockmobile.com/', referrer).page_referrer, '')
  }
  assert.equal(safeAnalyticsPage('https://iunlockmobile.com/', 'https://news.example.test/article?email=private@example.test').page_referrer, 'https://news.example.test')
})

test('the same acquisition sanitizer runs standalone in the initial tag without module dependencies', () => {
  const href = 'https://iunlockmobile.com/articles/carrier-unlock?utm_source=newsletter&utm_medium=email&utm_campaign=october', referrer = 'https://news.example.test/private'
  const actual = runInNewContext(`(${safeAnalyticsPage.toString()})(href, referrer)`, { URL, href, referrer })
  assert.deepEqual(JSON.parse(JSON.stringify(actual)), safeAnalyticsPage(href, referrer))
})

type Store = { getItem: (key: string) => string | null; setItem: (key: string, value: string) => void; length?: number; key?: (index: number) => string | null; removeItem?: (key: string) => void }
function fakeBrowser(run: (browser: { location: { hostname: string }; iunlockmobileAnalyticsConsent: string; gtag?: (...args: unknown[]) => void; sessionStorage: Store; localStorage: Store }, calls: unknown[][], saved: Map<string, string>) => void) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const calls: unknown[][] = [], saved = new Map<string, string>()
  const persistent = new Map<string, string>()
  const browser = { location: { hostname: 'iunlockmobile.com' }, iunlockmobileAnalyticsConsent: 'denied', gtag: (...args: unknown[]) => { calls.push(args) }, sessionStorage: { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => { saved.set(key, value) } }, localStorage: { get length() { return persistent.size }, key: (index: number) => [...persistent.keys()][index] ?? null, getItem: (key: string) => persistent.get(key) ?? null, setItem: (key: string, value: string) => { persistent.set(key, value) }, removeItem: (key: string) => { persistent.delete(key) } } }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser })
  try { run(browser, calls, saved) } finally { if (previous) Object.defineProperty(globalThis, 'window', previous); else Reflect.deleteProperty(globalThis, 'window') }
}

test('funding dedup marks only consented production events and never transmits the reference', () => fakeBrowser((browser, calls, saved) => {
  const reference = 'private-invoice-consent-case'
  assert.equal(trackFunnelEventOnce('payment_completed', reference, { service_category: 'account_credit' }), false)
  assert.equal(saved.size, 0)
  browser.iunlockmobileAnalyticsConsent = 'granted'
  browser.location.hostname = 'localhost'
  assert.equal(trackFunnelEventOnce('payment_completed', reference), false)
  browser.location.hostname = 'iunlockmobile.com'
  assert.equal(trackFunnelEventOnce('payment_completed', reference, { service_category: 'account_credit', payment_method: 'card', status: 'verified', transaction_id: reference }), true)
  assert.equal(trackFunnelEventOnce('payment_completed', reference), false)
  assert.deepEqual(calls, [['event', 'payment_completed', { service_category: 'account_credit', payment_method: 'card', status: 'verified' }]])
  assert.equal(JSON.stringify(calls).includes(reference), false)
}))

test('funding retries after absent or throwing gtag and deduplicates without session storage', () => fakeBrowser((browser, calls, saved) => {
  browser.iunlockmobileAnalyticsConsent = 'granted'
  const tag = browser.gtag
  browser.gtag = undefined
  assert.equal(trackFunnelEventOnce('payment_completed', 'missing-tag'), false)
  browser.gtag = () => { throw new Error('Optional analytics unavailable') }
  assert.equal(trackFunnelEventOnce('payment_completed', 'missing-tag'), false)
  assert.equal(saved.size, 0)
  browser.gtag = tag
  browser.sessionStorage = { getItem: () => { throw new Error('Blocked') }, setItem: () => { throw new Error('Blocked') } }
  browser.localStorage = browser.sessionStorage
  assert.equal(trackFunnelEventOnce('payment_completed', 'missing-tag'), true)
  assert.equal(trackFunnelEventOnce('payment_completed', 'missing-tag'), false)
  assert.equal(calls.length, 1)
}))

test('existing cross-tab funding markers suppress repeats and expire after 90 days', () => fakeBrowser((browser, calls) => {
  browser.iunlockmobileAnalyticsConsent = 'granted'
  const reference = 'prior-tab-completed', key = `iunlockmobile-funnel:payment_completed:${reference}`
  browser.localStorage.setItem(key, String(Date.now() + 60_000))
  assert.equal(trackFunnelEventOnce('payment_completed', reference), false)
  assert.equal(calls.length, 0)
  browser.localStorage.setItem(key, String(Date.now() - 1))
  assert.equal(trackFunnelEventOnce('payment_completed', reference), true)
  const expiry = Number(browser.localStorage.getItem(key))
  assert.ok(expiry > Date.now() + 89 * 86_400_000 && expiry <= Date.now() + 90 * 86_400_000)
}))

test('denied funding events do not read or write browser storage', () => fakeBrowser((browser, calls) => {
  let accesses = 0
  browser.localStorage = browser.sessionStorage = { getItem: () => { accesses++; return null }, setItem: () => { accesses++ } }
  assert.equal(trackFunnelEventOnce('payment_completed', 'denied-storage'), false)
  assert.equal(accesses, 0)
  assert.equal(calls.length, 0)
}))

test('invoice and modal funding hooks preserve verified completion and never emit a service purchase', () => {
  const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
  const invoice = read('app/(app)/user/invoice/[reference]/page.tsx')
  assert.match(invoice, /topup.environment === 'live'/)
  assert.match(invoice, /settled=\{invoice.status === 'success' && Boolean\(topup.credited\)\}/)
  assert.match(read('components/crypto-deposit-flow.tsx'), /settled=\{deposit.status === 'success'\}/)
  assert.doesNotMatch(read('components/payment-funnel-events.tsx'), /payment_request_created/)
  assert.match(read('components/crypto-deposit-flow.tsx'), /action === 'create'[\s\S]+trackFunnelEventOnce\('payment_request_created'/)
  assert.match(read('components/whop-payment-form.tsx'), /trackFunnelEventOnce\('payment_request_created'/)
  for (const path of ['components/whop-payment-form.tsx', 'components/crypto-deposit-flow.tsx', 'components/payment-funnel-events.tsx']) {
    assert.doesNotMatch(read(path), /GoogleAdsPurchaseConversion|['"]purchase['"]|['"]conversion['"]/)
  }
})
