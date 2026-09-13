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

test('paid report console shows Provider Code inline, auto-refreshes from the database and saves without a View result link', () => {
  const page = read('components/paid-report-console.tsx')
  assert.match(page, /method: 'GET'/)
  assert.match(page, /provider-code-result service-workbench-inline-code/)
  assert.match(page, />Save<\/button>/)
  assert.match(page, /new Blob/)
  assert.doesNotMatch(page, />View result<\/Link>/)
  assert.match(page, /payload\.order\.imei \?\? digits/)
  assert.doesNotMatch(page, /maskIdentifier/)
})

test('free check result shows the complete owner IMEI inline and offers Save instead of a detail link', () => {
  const form = read('components/imei-check-form.tsx')
  assert.match(form, /check\.imei \?\? normalizeImei\(value\)/)
  assert.match(form, /api\/imei\/checks\/\$\{check\.id\}/)
  assert.match(form, /method: 'GET'/)
  assert.match(form, /JSON\.stringify\(check\.result, null, 2\)/)
  assert.match(form, />Save<\/button>/)
  assert.doesNotMatch(form, /View full report|Open this check/)
})

test('all authenticated history and dashboard surfaces prefer complete owner IMEIs', () => {
  const paidHistory = read('app/(app)/user/reports/page.tsx')
  const paidDetail = read('app/(app)/user/reports/[id]/page.tsx')
  const freeHistory = read('app/(app)/user/checks/page.tsx')
  const freeDetail = read('app/(app)/user/checks/[id]/page.tsx')
  const dashboard = read('app/(app)/user/dashboard/page.tsx')
  assert.match(paidHistory, /report\.imei \?\? report\.maskedImei/)
  assert.match(paidDetail, /order\.imei \?\? order\.maskedImei/)
  assert.match(freeHistory, /check\.imei \?\? check\.maskedImei/)
  assert.match(freeDetail, /check\.imei \?\? check\.maskedImei/)
  assert.match(dashboard, /\{order\.imei\}/)
  assert.doesNotMatch(dashboard, /maskIdentifier/)
})
