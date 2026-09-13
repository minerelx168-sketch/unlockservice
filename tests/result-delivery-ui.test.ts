import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('completed paid report UI renders only the standalone Provider Code block', () => {
  const page = read('app/(app)/user/reports/[id]/page.tsx')
  assert.match(page, /if \(order\.status === 'completed'\)/)
  assert.match(page, /provider-code-result provider-code-result--standalone/)
  assert.doesNotMatch(page, /Full Provider result|Complete business result returned|Report result|Privacy/)
})

test('owner-scoped unlock order history renders the complete stored IMEI', () => {
  const page = read('app/(app)/user/orders/page.tsx')
  assert.match(page, /\{order\.imei\}/)
  assert.doesNotMatch(page, /maskIdentifier/)
})

test('owner-scoped paid report history prefers decrypted IMEI and falls back only for legacy rows', () => {
  const page = read('app/(app)/user/reports/page.tsx')
  assert.match(page, /report\.imei \?\? report\.maskedImei/)
})

test('the existing Provider poll entrypoint delivers the Unlock-only notification outbox', () => {
  const pollScript = read('scripts/poll-provider-jobs.ts')
  const reports = read('lib/paid-reports.ts')
  assert.match(pollScript, /deliverOrderNotifications/)
  assert.match(pollScript, /await deliverOrderNotifications/)
  assert.doesNotMatch(reports, /enqueueOrderNotification/)
})
