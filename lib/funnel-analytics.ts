'use client'

export const FUNNEL_EVENTS = [
  'imei_input_started',
  'validation_result',
  'service_selection',
  'review_login_intent',
  'begin_checkout',
  'order_submission',
  'order_accepted',
  'payment_request_created',
  'payment_viewed',
  'payment_completed',
  'payment_verification_requested',
] as const
export type FunnelEventName = (typeof FUNNEL_EVENTS)[number]

type FunnelValue = string | number | boolean
const ALLOWED_KEYS = new Set([
  'event_category', 'service_category', 'validation_status',
  'status', 'currency', 'value', 'payment_method', 'source', 'consent',
])
const BLOCKED_KEY = /(imei|email|phone|wallet|csrf|token|transaction|order_id|provider_id|customer|user|address|name)/i

export function allowlistedFunnelParams(input: Record<string, unknown>): Record<string, FunnelValue> {
  const result: Record<string, FunnelValue> = {}
  for (const [key, value] of Object.entries(input)) {
    if (!ALLOWED_KEYS.has(key) || BLOCKED_KEY.test(key)) continue
    if (typeof value === 'string' && value.length <= 80 && /^[A-Za-z0-9_.:-]+$/.test(value)) result[key] = value
    else if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) < 1_000_000) result[key] = value
    else if (typeof value === 'boolean') result[key] = value
  }
  return result
}

export function trackFunnelEvent(name: FunnelEventName, input: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined' || (window as Window & { iunlockmobileAnalyticsConsent?: string }).iunlockmobileAnalyticsConsent !== 'granted') return
  const params = allowlistedFunnelParams(input)
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
  gtag?.('event', name, params)
}
