import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'
import { FAQ } from '../lib/faq'
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

test('new hero entry points use consented allowlisted funnel transport without raw device identifiers', () => {
  for (const path of ['components/hero-price-check.tsx', 'components/imei-quick-form.tsx']) {
    const source = read(path)
    assert.match(source, /trackFunnelEvent/)
    assert.match(source, /imei_input_started/)
    assert.match(source, /validation_result/)
    assert.match(source, /service_selection/)
    assert.doesNotMatch(source, /trackFunnelEvent\([^\n]+\{[^\n]*(imei:|email:|productCode:)/)
  }
  const transport = read('lib/funnel-analytics.ts')
  assert.match(transport, /iunlockmobileAnalyticsConsent !== 'granted'/)
  assert.match(transport, /allowlistedFunnelParams/)
})
test('homepage and FAQ qualify unlock compatibility and advertise only new BEP20 top-ups', () => {
  const home = read('app/(marketing)/page.tsx')
  assert.doesNotMatch(home, /Use any SIM|title: 'Permanent'|Financed\? Often still fine|Every other brand receives a code/)
  assert.match(home, /radio bands/)
  const text = FAQ.map((item) => item.answer).join(' ')
  assert.doesNotMatch(text, /Yes to both|TRC20 or BEP20/)
  assert.match(text, /USDT or USDC on BNB Smart Chain \(BEP20\)/)
  assert.match(text, /not a refund to the original payment method/)
})
test('hero and trust icons have explicit constrained dimensions', () => {
  const css = read('styles/home.css')
  assert.match(css, /\.hero-chip svg\s*\{[^}]*width:\s*16px[^}]*height:\s*16px/s)
  assert.match(css, /\.trust-bar-icon svg\s*\{[^}]*width:\s*19px[^}]*height:\s*19px/s)
})
test('public tracking carries only an order continuation, not caller identity, and never looks up orders', () => {
  const source = read('lib/track-actions.ts')
  assert.doesNotMatch(source, /identity=|cleanIdentityHint|getOrder\(|getPaidReport\(|form\.get\('email'\)/)
  assert.match(source, /String\(found\.user\.id\)/)
  assert.match(source, /redirect\(`\/login\?next=\$\{next\}`\)/)
  const forms = read('components/profile-forms.tsx')
  assert.match(forms, /name="current" type="password"/)
  assert.match(forms, /profile-email-start-password/)
  assert.match(forms, /profile-email-confirm-password/)
})
