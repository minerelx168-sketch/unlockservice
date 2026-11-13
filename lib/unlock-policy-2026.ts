/**
 * Published 2026 carrier unlock waiting periods, as offline date arithmetic.
 *
 * Every rule here is a carrier's own published policy (sources below); the
 * calculator only answers "when does that waiting period end?". It cannot see
 * an account, payments, financing, fraud flags or whether service was
 * continuous, which every carrier also checks. All dates are calendar dates
 * in UTC (YYYY-MM-DD) so the answer never shifts with the viewer's timezone.
 */
export const POLICY_SOURCES = {
  cricket: ['https://www.cricketwireless.com/device-unlock', 'https://www.cricketwireless.com/support/account-management/device-unlock'],
  verizon: ['https://www.verizon.com/prepaid/device-unlock/', 'https://www.verizon.com/about/consumer-safety/device-unlocking-policy'],
  straightTalk: ['https://www.straighttalk.com/device/device-unlock'],
  tmobile: ['https://www.t-mobile.com/responsibility/consumer-info/policies/sim-unlock-policy'],
} as const

/** Cricket: purchases on or after this date need 365 days of paid service; earlier ones six months. */
export const CRICKET_365_START = '2026-07-01'
/** Separate effective dates for Verizon Prepaid and Verizon Value brands. */
export const VERIZON_PREPAID_365_START = '2026-01-27'
export const VERIZON_VALUE_365_START = '2026-01-20'
/** Verizon postpaid: devices bought on or after this date unlock once paid in full; earlier ones after 60 days. */
export const VERIZON_POSTPAID_PAYOFF_START = '2026-01-27'

export type PolicyRule =
  | 'cricket_six_months' | 'cricket_365_days'
  | 'verizon_prepaid_60_days' | 'verizon_prepaid_365_days'
  | 'verizon_postpaid_60_days' | 'verizon_postpaid_paid_in_full'
  | 'tmobile_postpaid_40_days' | 'tmobile_prepaid_365_days' | 'metro_365_days'

export type Eligibility = {
  rule: PolicyRule
  /** Waiting period in days, or null when the release depends on payoff rather than time. */
  waitDays: number | null
  /** First calendar date the time requirement is met, or null when it is payoff-based. */
  eligibleOn: string | null
  daysRemaining: number | null
  timeRequirementMet: boolean | null
}

const DATE = /^\d{4}-\d{2}-\d{2}$/

export function parseDate(value: string): Date | null {
  if (!DATE.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value ? null : date
}

export const isoDate = (date: Date) => date.toISOString().slice(0, 10)

export function addDays(value: string, days: number): string {
  const date = parseDate(value)
  if (!date) throw new RangeError('Invalid date.')
  date.setUTCDate(date.getUTCDate() + days)
  return isoDate(date)
}

/** Calendar months; a day that does not exist (Aug 31 + 6) clamps to the month's last day. */
export function addMonths(value: string, months: number): string {
  const date = parseDate(value)
  if (!date) throw new RangeError('Invalid date.')
  const day = date.getUTCDate()
  date.setUTCDate(1)
  date.setUTCMonth(date.getUTCMonth() + months)
  const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate()
  date.setUTCDate(Math.min(day, last))
  return isoDate(date)
}

export function daysBetween(from: string, to: string): number {
  const a = parseDate(from), b = parseDate(to)
  if (!a || !b) throw new RangeError('Invalid date.')
  return Math.round((b.getTime() - a.getTime()) / 86_400_000)
}

function timed(rule: PolicyRule, start: string, eligibleOn: string, today: string, waitDays: number): Eligibility {
  const remaining = Math.max(0, daysBetween(today, eligibleOn))
  return { rule, waitDays, eligibleOn, daysRemaining: remaining, timeRequirementMet: remaining === 0 }
}

function assertDates(...values: string[]) {
  for (const value of values) if (!parseDate(value)) throw new RangeError('Invalid date.')
}

export function cricketEligibility(purchased: string, today: string): Eligibility {
  assertDates(purchased, today)
  if (purchased >= CRICKET_365_START) return timed('cricket_365_days', purchased, addDays(purchased, 365), today, 365)
  const eligibleOn = addMonths(purchased, 6)
  return timed('cricket_six_months', purchased, eligibleOn, today, daysBetween(purchased, eligibleOn))
}

export type VerizonPlan = 'prepaid' | 'straight-talk' | 'postpaid'
export function verizonEligibility(activated: string, plan: VerizonPlan, today: string): Eligibility {
  assertDates(activated, today)
  if (plan !== 'postpaid') {
    return activated >= (plan === 'straight-talk' ? VERIZON_VALUE_365_START : VERIZON_PREPAID_365_START)
      ? timed('verizon_prepaid_365_days', activated, addDays(activated, 365), today, 365)
      : timed('verizon_prepaid_60_days', activated, addDays(activated, 60), today, 60)
  }
  if (activated >= VERIZON_POSTPAID_PAYOFF_START) return { rule: 'verizon_postpaid_paid_in_full', waitDays: null, eligibleOn: null, daysRemaining: null, timeRequirementMet: null }
  return timed('verizon_postpaid_60_days', activated, addDays(activated, 60), today, 60)
}

export type TMobilePlan = 'postpaid' | 'prepaid' | 'metro'
export function tmobileEligibility(activated: string, plan: TMobilePlan, today: string): Eligibility {
  assertDates(activated, today)
  if (plan === 'postpaid') return timed('tmobile_postpaid_40_days', activated, addDays(activated, 40), today, 40)
  if (plan === 'metro') return timed('metro_365_days', activated, addDays(activated, 365), today, 365)
  return timed('tmobile_prepaid_365_days', activated, addDays(activated, 365), today, 365)
}
