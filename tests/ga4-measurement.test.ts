import assert from 'node:assert/strict'
import test from 'node:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { analyticsHostAllowed } from '../lib/site'
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('analytics loader allows only actual production hosts', () => {
  assert.equal(analyticsHostAllowed('iunlockmobile.com'), true)
  assert.equal(analyticsHostAllowed('www.iunlockmobile.com'), true)
  for (const host of ['localhost', '127.0.0.1:3000', 'imeihub.net', 'unlockservice.35-237-31-173.sslip.io', 'iunlockmobile.com.evil.test']) assert.equal(analyticsHostAllowed(host), false)
  const layout = read('app/layout.tsx')
  assert.match(layout, /analyticsEnabled \? <script async/)
  assert.equal((layout.match(/gtag\/js\?id=/g) ?? []).length, 1)
})

test('purchase is sent only by the server worker, never from a page', () => {
  assert.ok(!existsSync(join(process.cwd(), 'components/google-ads-purchase-conversion.tsx')))
  for (const path of ['components/order-console.tsx', 'components/paid-report-console.tsx', 'app/(app)/user/orders/[id]/page.tsx', 'app/(app)/user/reports/[id]/page.tsx', 'components/payment-forms.tsx', 'components/payment-funnel-events.tsx'])
    assert.doesNotMatch(read(path), /GoogleAdsPurchaseConversion|tag\('event', ['"]purchase['"]/)
  const worker = read('lib/ga4.ts')
  assert.match(worker, /INSERT OR IGNORE INTO ga4_events_sent/)
  assert.match(worker, /GA4_MP_API_SECRET/)
})

test('SPA pageview suppresses initial duplicate but tracks private route changes without IDs', () => {
  const navigation = read('components/google-analytics-navigation.tsx')
  assert.match(navigation, /firstPath.current === null/)
  assert.match(navigation, /lastPath.current === pathname/)
  assert.match(navigation, /safeAnalyticsPage/)
  const sanitizer = read('lib/analytics-page.ts')
  assert.match(sanitizer, /\? '\/account'/)
  assert.match(sanitizer, /page_title: 'iUnlockMobile'/)
  assert.doesNotMatch(navigation, /document.title|window.location.search/)
  assert.match(sanitizer, /accounts.google.com/)
  assert.match(sanitizer, /page_referrer = source.origin/)
})

test('consent restores only validated click IDs and never arbitrary landing query', () => {
  const consent = read('components/analytics-consent.tsx')
  assert.match(consent, /validateClickId/)
  // The banner validates captured IDs and delegates tag emission to the shared helper.
  assert.match(consent, /updateGoogleConsent\(state, state === 'granted' \? clicks.current : \{\}\)/)
  const tracking = read('lib/google-consent-tracking.ts')
  assert.match(tracking, /const safeIds = readClickIds\(clickIds\)/)
  assert.match(tracking, /validateClickId\(\(input as Record<string, unknown>\)\[field\]\)/)
  assert.match(tracking, /safeLocation.searchParams.set\(field, safeIds\[field\]!\)/)
  assert.match(tracking, /send_page_view: false/)
  assert.match(tracking, /safeAnalyticsPage/)
  for (const source of [consent, tracking]) {
    assert.doesNotMatch(source, /page_location: window.location.href|page_title: document.title/)
  }
  const route = read('app/api/consent/route.ts')
  assert.match(route, /parseAttributionCookie/)
  assert.match(route, /Cache-Control.*no-store/)
})
