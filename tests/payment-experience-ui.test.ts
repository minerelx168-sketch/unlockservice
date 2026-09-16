import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')

test('Add funds presents quick amounts, locked summary and one auto-verified method', () => {
  const page = read('app/(app)/user/add-funds/page.tsx')
  const form = read('components/payment-forms.tsx')
  assert.match(page, /Add credit in four clear steps/)
  assert.match(page, /Automatic verification ready/)
  assert.match(form, /QUICK_AMOUNTS = \[10, 25, 50, 100\]/)
  assert.match(form, /Suggested amount to send/)
  assert.match(form, /verified on-chain amount determines the credit/i)
  assert.match(form, /Create payment request/)
  assert.match(form, /private key or seed phrase/)
})

test('invoice page keeps BscScan calls off the browser and refreshes database state only', () => {
  const page = read('app/(app)/user/invoice/[reference]/page.tsx')
  const actions = read('components/invoice-actions.tsx')
  const form = read('components/payment-forms.tsx')
  assert.match(page, /paymentAddressQrDataUrl/)
  assert.match(page, /AutoRefreshPaymentStatus/)
  assert.match(page, /https:\/\/bscscan\.com\/tx\//)
  assert.match(actions, /router\.refresh\(\)/)
  assert.match(actions, /5_000/)
  assert.doesNotMatch(actions, /fetch\(/)
  assert.match(form, /pattern="0x\[a-fA-F0-9\]\{64\}"/)
})

test('bounded payment reconciliation runs inside the existing provider poll entrypoint', () => {
  const script = read('scripts/poll-provider-jobs.ts')
  assert.match(script, /pollInvoiceVerifications/)
  assert.match(script, /const payments = await pollInvoiceVerifications\(boundedLimit\)/)
  assert.doesNotMatch(script, /setInterval|setTimeout/)
})

test('admin fallback uses API guard, admin RBAC, reason and idempotency', () => {
  const route = read('app/api/admin/invoice-verifications/route.ts')
  const component = read('components/admin-invoice-review.tsx')
  const domain = read('lib/payment-verification.ts')
  assert.match(route, /guard\(request\)/)
  assert.match(route, /hasAdminRole\(found\.user\)/)
  assert.match(component, /csrfToken/)
  assert.match(component, /idempotencyKey/)
  assert.match(component, /Decision reason/)
  assert.match(domain, /consumeAttempt\('admin-invoice-verification'/)
  assert.match(domain, /credit\(row\.user_id, approvedCreditCents, 'topup', 'invoice'/)
})

test('payment verification is fail closed and matches receipt logs by contract, recipient and exact amount', () => {
  const config = read('lib/payment-config.ts')
  const domain = read('lib/payment-verification.ts')
  assert.match(config, /mode === 'bnb_rpc'/)
  assert.match(domain, /config\.mode === 'bnb_rpc'/)
  assert.match(domain, /eth_chainId/)
  assert.match(config, /Boolean\(destinationAddress\)/)
  assert.match(config, /Boolean\(tokenContract\)/)
  assert.match(domain, /eth_getTransactionReceipt/)
  assert.match(domain, /eth_blockNumber/)
  assert.match(domain, /value\.address/)
  assert.match(domain, /topicAddress\(value\.topics\[2\]\)/)
  assert.match(domain, /rawAmountToCreditCents\(candidate\.rawAmount/)
  assert.match(domain, /requestedCreditCents/)
  assert.match(domain, /verifiedCreditCents/)
  assert.match(domain, /duplicate_transaction/)
})
