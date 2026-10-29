'use client'
import { analyticsActive } from './google-consent-tracking'

export const FUNNEL_EVENTS = [
  'service_quote_viewed',
  'guest_details_completed',
  'order_preview_viewed',
  'order_summary_requested',
  'order_preview_continue',
  'imei_input_started',
  'unlock_imei_submitted',
  'validation_result',
  'service_selection',
  'unlock_service_selected',
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

export function trackFunnelEvent(name: FunnelEventName, input: Record<string, unknown> = {}): boolean {
  if (typeof window === 'undefined' || !analyticsActive()) return false
  const host = window.location.hostname.toLowerCase().replace(/\.$/, '')
  if (host !== 'iunlockmobile.com' && host !== 'www.iunlockmobile.com') return false
  const params = allowlistedFunnelParams(input)
  const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
  if (typeof gtag !== 'function') return false
  try { gtag('event', name, params); return true } catch { return false }
}

// References are used only locally for deduplication, never as event parameters.
// A 90-day browser marker survives return visits and is shared by tabs. This is
// best-effort measurement, not an exactly-once financial event log.
const sentFunnelEvents = new Set<string>()
let lastFunnelPruned = 0
export function trackFunnelEventOnce(name: FunnelEventName, reference: string, input: Record<string, unknown> = {}): boolean {
  if (typeof window === 'undefined' || !reference || !analyticsActive()) return false
  const host = window.location.hostname.toLowerCase().replace(/\.$/, '')
  if (host !== 'iunlockmobile.com' && host !== 'www.iunlockmobile.com') return false
  const key = `iunlockmobile-funnel:${name}:${reference}`
  if (sentFunnelEvents.has(key)) return false
  const now = Date.now()
  if (now - lastFunnelPruned > 3_600_000) {
    try {
      for (let index = window.localStorage.length - 1; index >= 0; index--) {
        const storedKey = window.localStorage.key(index)
        if (storedKey?.startsWith('iunlockmobile-funnel:') && Number(window.localStorage.getItem(storedKey)) <= now) window.localStorage.removeItem(storedKey)
      }
      lastFunnelPruned = now
    } catch { /* Storage is optional. */ }
  }
  try { if (Number(window.localStorage.getItem(key)) > now) return false } catch { /* Persistent storage is optional. */ }
  try { if (window.sessionStorage.getItem(key)) return false } catch { /* Storage is optional. */ }
  if (!trackFunnelEvent(name, input)) return false
  sentFunnelEvents.add(key)
  try { window.localStorage.setItem(key, String(now + 90 * 86_400_000)) } catch { /* In-memory/session fallback. */ }
  try { window.sessionStorage.setItem(key, '1') } catch { /* Storage is optional. */ }
  return true
}

