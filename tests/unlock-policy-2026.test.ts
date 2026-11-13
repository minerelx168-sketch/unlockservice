import assert from 'node:assert/strict'
import test from 'node:test'
import { addMonths, cricketEligibility, tmobileEligibility, verizonEligibility } from '../lib/unlock-policy-2026'

test('Cricket: purchases before 2026-07-01 keep the six-month rule', () => {
  const result = cricketEligibility('2026-06-30', '2026-11-13')
  assert.equal(result.rule, 'cricket_six_months')
  assert.equal(result.eligibleOn, '2026-12-30')
  assert.equal(result.daysRemaining, 47)
  assert.equal(result.timeRequirementMet, false)
  assert.equal(cricketEligibility('2026-01-15', '2026-11-13').timeRequirementMet, true)
})

test('Cricket: purchases on or after 2026-07-01 need 365 days', () => {
  const onBoundary = cricketEligibility('2026-07-01', '2026-11-13')
  assert.equal(onBoundary.rule, 'cricket_365_days')
  assert.equal(onBoundary.waitDays, 365)
  assert.equal(onBoundary.eligibleOn, '2027-07-01')
  assert.equal(onBoundary.daysRemaining, 230)
  assert.equal(cricketEligibility('2026-08-31', '2026-11-13').eligibleOn, '2027-08-31')
})

test('six calendar months clamp to the last day of a short month', () => {
  assert.equal(addMonths('2026-08-31', 6), '2027-02-28')
  assert.equal(addMonths('2025-12-31', 2), '2026-02-28')
})

test('Verizon prepaid / Straight Talk: 60 days before 2026-01-20, 365 days from it', () => {
  const before = verizonEligibility('2026-01-19', 'prepaid', '2026-11-13')
  assert.equal(before.rule, 'verizon_prepaid_60_days')
  assert.equal(before.eligibleOn, '2026-03-20')
  assert.equal(before.timeRequirementMet, true)
  const from = verizonEligibility('2026-01-20', 'prepaid', '2026-11-13')
  assert.equal(from.rule, 'verizon_prepaid_365_days')
  assert.equal(from.eligibleOn, '2027-01-20')
  assert.equal(from.daysRemaining, 68)
})

test('Verizon postpaid: payoff-based from 2026-01-27, 60 days before', () => {
  const payoff = verizonEligibility('2026-01-27', 'postpaid', '2026-11-13')
  assert.equal(payoff.rule, 'verizon_postpaid_paid_in_full')
  assert.equal(payoff.eligibleOn, null)
  assert.equal(payoff.timeRequirementMet, null)
  assert.equal(verizonEligibility('2026-01-26', 'postpaid', '2026-11-13').rule, 'verizon_postpaid_60_days')
})

test('T-Mobile: 40 days postpaid, 365 days prepaid and Metro', () => {
  assert.equal(tmobileEligibility('2026-11-01', 'postpaid', '2026-11-13').eligibleOn, '2026-12-11')
  assert.equal(tmobileEligibility('2026-11-01', 'prepaid', '2026-11-13').eligibleOn, '2027-11-01')
  assert.equal(tmobileEligibility('2026-11-01', 'metro', '2026-11-13').rule, 'metro_365_days')
})

test('invalid dates are rejected rather than guessed', () => {
  assert.throws(() => cricketEligibility('2026-02-30', '2026-11-13'), RangeError)
  assert.throws(() => verizonEligibility('not-a-date', 'prepaid', '2026-11-13'), RangeError)
})
