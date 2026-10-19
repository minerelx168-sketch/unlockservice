import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
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

test('GA4 purchase is separate from Ads, uses real proof and consent replay', () => {
  const event = read('components/google-ads-purchase-conversion.tsx')
  assert.match(event, /G-9WCELVR3V3/)
  assert.match(event, /tag\('event', 'purchase', event\)/)
  assert.match(event, /if \(browser.iunlockmobileAnalyticsConsent !== 'granted'\) return/)
  assert.match(event, /addEventListener\('iunlockmobile-consent', emit\)/)
  for (const field of ['transaction_id: purchase.transactionId', 'value: purchase.value', 'currency: purchase.currency', 'event.items = purchase.items']) assert.ok(event.includes(field))
  assert.match(event, /iunlockmobile:ga4-purchase:/)
  assert.match(event, /iunlockmobile:ads-purchase:/)
  for (const path of ['components/payment-forms.tsx', 'components/payment-funnel-events.tsx']) assert.doesNotMatch(read(path), /GoogleAdsPurchaseConversion|['"]purchase['"]/)
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
  assert.match(consent, /safeLocation.searchParams.set\(field, safeIds\[field\]!\)/)
  assert.match(consent, /send_page_view: false/)
  assert.match(consent, /safeAnalyticsPage/)
  assert.doesNotMatch(consent, /page_location: window.location.href|page_title: document.title/)
  const route = read('app/api/consent/route.ts')
  assert.match(route, /parseAttributionCookie/)
  assert.match(route, /Cache-Control.*no-store/)
})
