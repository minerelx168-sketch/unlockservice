import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')
test('customer storefront readiness follows verified per-product catalog gates', () => {
  const source = read('lib/storefront-availability.ts')
  assert.match(source, /listPublicProviderProducts\(domain\)/)
  assert.match(source, /product.status === 'available'/)
  assert.match(source, /accepting: availableCount > 0/)
  const hub = read('app/(marketing)/services/page.tsx')
  assert.match(hub, /unlock.availableCount/)
  assert.doesNotMatch(hub, /View only|online ordering pending/)
})
test('free validation never advertises legacy global pause; waitlist follows storefront readiness', () => {
  const check = read('app/(marketing)/check/page.tsx')
  assert.doesNotMatch(check, /serviceStatus|New orders are paused|status.heading/)
  assert.match(check, /Browse Unlock services/)
  const waitlist = read('app/(marketing)/unlock-waitlist/page.tsx')
  assert.match(waitlist, /storefrontAvailability\('unlock'\).accepting/)
  assert.doesNotMatch(waitlist, /still finishing the supplier connection/)
})
test('legacy customer URL and quote use catalog checkout without opening legacy API', () => {
  const page = read('app/(app)/user/unlock/page.tsx')
  assert.match(page, /ServiceOrderWorkspace domain="unlock"/)
  assert.match(page, /fallbackImei=\{quote\?\.imei\}/)
  assert.doesNotMatch(page, /OrderConsole|WaitlistForm/)
  const action = read('lib/actions.ts').split('export async function startUnlockQuoteAction')[1].split('export async function joinUnlockWaitlistAction')[0]
  assert.match(action, /writeDeviceIntent\(imei, 'unlock'\)/)
  assert.match(action, /redirect\('\/services\/unlock\/catalog'\)/)
  assert.doesNotMatch(action, /redirect\('\/services\/imei-check'\)/)
  assert.match(read('lib/orders.ts'), /maintenanceState\(\).active/)
  assert.match(read('lib/device-intent-actions.ts'), /entry.providerReady/)
})
