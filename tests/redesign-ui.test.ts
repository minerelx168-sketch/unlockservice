import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { SAMPLE_TESTIMONIALS } from '../lib/testimonials'

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('the navigator is a dialog the header controls, rendered outside the header', () => {
  const drawer = read('components/site-drawer.tsx')
  assert.match(drawer, /role="dialog"/)
  assert.match(drawer, /aria-modal="true"/)
  assert.match(drawer, /id="site-drawer"/)
  assert.match(drawer, /inert=\{!open\}/)
  const header = read('components/site-header.tsx')
  assert.match(header, /aria-controls="site-drawer"/)
  // The sheet must be a sibling: backdrop-filter on the header would clip a fixed child.
  assert.match(header, /<\/header>\s*<SiteDrawer/)
  const css = read('styles/drawer.css')
  assert.match(css, /\.drawer-root\s*\{[^}]*overflow:\s*hidden/s)
  assert.match(css, /\.drawer-sub\[hidden\]\s*\{\s*display:\s*none/s)
})

test('sample reviews are labelled as samples and never aggregated', () => {
  assert.ok(SAMPLE_TESTIMONIALS.length >= 3)
  assert.ok(SAMPLE_TESTIMONIALS.every((item) => item.sample === true))
  const component = read('components/testimonials.tsx')
  // One disclosure, under the heading, for as long as the rows are personas.
  assert.match(component, /Illustrative examples while verified customer reviews are collected/)
  assert.match(component, /allSample\s*\?/)
  assert.doesNotMatch(component, /AggregateRating|ratingValue|reviewCount/)
  const home = read('app/(marketing)/page.tsx')
  assert.doesNotMatch(home, /AggregateRating|ratingValue|reviewCount/)
  const structured = read('app/(marketing)/structured-data.tsx')
  assert.doesNotMatch(structured, /"Review"|AggregateRating/)
})

test('footer shows the requested payment labels and catalog counts remain derived', () => {
  const footer = read('components/site-footer.tsx')
  for (const method of ['Visa', 'Mastercard', 'Google Pay', 'Apple Pay', 'Bitcoin', 'USDT']) {
    assert.ok(footer.includes(method))
  }
  assert.doesNotMatch(footer, /Stripe|PayPal/)
  const chrome = read('components/site-chrome.tsx')
  assert.match(chrome, /CARRIERS\.map/)
  assert.match(chrome, /listArticles\(\)/)
  const home = read('app/(marketing)/page.tsx')
  assert.doesNotMatch(home, /12\+ Years|1\.6M|Trustpilot|Watch Demo/i)
  assert.match(home, /CARRIERS\.map/)
  assert.match(home, /BRANDS\.map/)
})

test('the hero widget carries the chosen report and preserves public report deep links', () => {
  const widget = read('components/hero-price-check.tsx')
  assert.match(widget, /\{selected \? <input type="hidden" name="productCode" value=\{selected\.code\} \/> : null\}/)
  assert.doesNotMatch(widget, /Check Price &amp; Unlock Time|Live prices are loading/)
  // Guest checkout validation is exercised by unlock-intent-selection.test.ts.
  const action = read('lib/device-intent-actions.ts')
  assert.match(action, /`product=\$\{encodeURIComponent\(product\.productCode\)\}`/)
  assert.match(action, /`\/services\/imei-check\?\$\{query\}`/)
  // The public browse action carries its selection to the entry form.
  assert.match(action, /start=1/)
  const landing = read('app/(marketing)/services/imei-check/page.tsx')
  assert.match(landing, /query\.start === '1'/)
  assert.match(landing, /<ScrollTo targetId="imei-check-browse" \/>/)
  const page = read('app/(marketing)/services/imei-check/page.tsx')
  assert.match(page, /searchParams/)
  assert.match(page, /products\.find\(\(product\) => product\.productCode === requested\)/)
})

test('the report card takes its colours from the tested parser', () => {
  const card = read('components/report-card.tsx')
  assert.match(card, /from '@\/lib\/report-card-parse'/)
  assert.doesNotMatch(card, /const GOOD = new Set|const WARN = new Set/)
  assert.match(card, />Status<\/h3>/)
  assert.match(card, /Device information/)
  assert.match(card, /provider-code-result/)
})

test('the two service links carry a menu built from the same groups as the drawer', () => {
  const header = read('components/site-header.tsx')
  assert.match(header, /menu: 'unlock'/)
  assert.match(header, /menu: 'check'/)
  assert.match(header, /<NavMenu/)
  assert.match(header, /href="\/support" aria-label="Help centre"/)
  const menu = read('components/nav-menu.tsx')
  assert.match(menu, /aria-expanded=\{open\}/)
  assert.match(menu, /event\.key !== 'Escape'/)
  assert.match(menu, /hidden=\{!open\}/)
  const css = read('styles/components.css')
  assert.match(css, /\.nav-menu\[hidden\]\s*\{\s*display:\s*none/s)
})
