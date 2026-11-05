import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8')
const sharedText = read('lib/att-installment-confirmation.ts').match(/export const ATT_INSTALLMENT_CONFIRMATION_TEXT\s*=\s*\n?\s*'([^']+)'/)?.[1]

assert.ok(sharedText, 'the shared acknowledgement export should remain available')

test('guest checkout renders the shared AT&T acknowledgement and gates both card and crypto requests', () => {
  const form = read('components/guest-checkout-form.tsx')
  assert.match(form, /ATT_INSTALLMENT_CONFIRMATION_TEXT/)
  assert.match(form, /requiresAttInstallmentConfirmation\(product\.code\)/)
  assert.match(form, /id="guest-att-installment-confirmation"/)
  assert.match(form, /checked=\{attConfirmationProductCode === product\.code && attInstallmentConfirmation\}/)
  assert.match(form, /disabled=\{busy \|\| \(requiresAtt && !attConfirmed\)/)
  assert.match(form, /fetch\(isCrypto \? '\/api\/checkout\/crypto' : '\/api\/checkout\/guest'/)
  assert.match(form, /attInstallmentConfirmation: attConfirmed/)
  assert.match(form, /setAttInstallmentConfirmation\(false\)/)
  assert.match(form, /onChange=\{e => \{ setImei\(e\.target\.value\); setAttInstallmentConfirmation\(false\)/)
  assert.match(form, /\{ATT_INSTALLMENT_CONFIRMATION_TEXT\}/)
})

test('authenticated paid-report confirmation gates /api/imei/reports and resets on request changes', () => {
  const form = read('components/paid-report-console.tsx')
  assert.match(form, /requiresAttInstallmentConfirmation\?: boolean/)
  assert.match(form, /id="paid-report-att-installment-confirmation"/)
  assert.match(form, /disabled=\{busy \|\| \(requiresAtt && attInstallmentConfirmation !== true\)\}/)
  assert.match(form, /post\('\/api\/imei\/reports', \{ productCode: product\.code, imei: digits, idempotencyKey, attInstallmentConfirmation: requiresAtt \? attInstallmentConfirmation : false \}\)/)
  assert.match(form, /function resetRequestIdentity\(\)[\s\S]*setAttInstallmentConfirmation\(false\)/)
  assert.match(form, /\{ATT_INSTALLMENT_CONFIRMATION_TEXT\}/)
})

test('legacy order console classifies only the trusted AT&T carrier and sends a boolean acknowledgement', () => {
  const form = read('components/order-console.tsx')
  assert.match(form, /import \{ ATT_INSTALLMENT_CONFIRMATION_TEXT, isAttName \}/)
  assert.match(form, /kind === 'carrier_unlock' && Boolean\(carrier && isAttName\(carrier\.name\)\)/)
  assert.match(form, /id="legacy-att-installment-confirmation"/)
  assert.match(form, /disabled=\{busy \|\| \(requiresAtt && !attConfirmed\)\}/)
  assert.match(form, /attInstallmentConfirmation: attConfirmed/)
  assert.match(form, /setAttInstallmentConfirmation\(false\)/)
  assert.match(form, /\{ATT_INSTALLMENT_CONFIRMATION_TEXT\}/)
})

test('hero price check has no direct payment/order API submit to duplicate acknowledgement handling', () => {
  const hero = read('components/hero-price-check.tsx')
  assert.match(hero, /useActionState\(continueDeviceServiceAction/)
  assert.doesNotMatch(hero, /\/api\/(imei\/reports|checkout\/guest|checkout\/crypto|orders)/)
})
