'use client'
import { ATTRIBUTION_MAX_AGE_SECONDS, CLICK_ID_FIELDS, validateClickId } from './attribution'
const KEY = 'iunlockmobile:landing'
const COOKIE = 'iunlockmobile_landing'
const TEXT = /^[A-Za-z0-9._~+-]{1,80}$/
export type LandingContext = { landingPage?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; gclid?: string; gbraid?: string; wbraid?: string }
type Stored = { capturedAt: number; context: LandingContext }
function clean(value: unknown): LandingContext {
  if (!value || typeof value !== 'object') return {}
  const input = value as Record<string, unknown>, result: LandingContext = {}
  for (const field of CLICK_ID_FIELDS) { const id = validateClickId(input[field]); if (id) result[field] = id }
  for (const field of ['utmSource', 'utmMedium', 'utmCampaign'] as const) {
    const text = input[field]; if (typeof text === 'string' && TEXT.test(text)) result[field] = text
  }
  if (typeof input.landingPage === 'string' && /^\/[A-Za-z0-9/_.-]{0,159}$/.test(input.landingPage)) result.landingPage = input.landingPage
  return result
}
export function parseStoredLanding(raw: string | null, now = Date.now()): Stored | null {
  try {
    if (!raw || raw.length > 2048) return null
    const data = JSON.parse(raw)
    if (!Number.isSafeInteger(data.capturedAt) || data.capturedAt > now || now - data.capturedAt >= ATTRIBUTION_MAX_AGE_SECONDS * 1000) return null
    return { capturedAt: data.capturedAt, context: clean(data.context) }
  } catch { return null }
}
function stored(): Stored | null {
  try {
    const session = parseStoredLanding(window.sessionStorage.getItem(KEY))
    const cookie = document.cookie.split('; ').find(part => part.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1)
    const persisted = parseStoredLanding(cookie ? decodeURIComponent(cookie) : null)
    return session && (!persisted || session.capturedAt >= persisted.capturedAt) ? session : persisted
  } catch { return null }
}
/** Persist only after explicit consent, without extending the original attribution window. */
export function persistLanding() {
  try {
    if ((window as Window & { iunlockmobileAnalyticsConsent?: string }).iunlockmobileAnalyticsConsent !== 'granted') return
    const value = stored(); if (!value) return
    const remaining = Math.floor((value.capturedAt + ATTRIBUTION_MAX_AGE_SECONDS * 1000 - Date.now()) / 1000)
    if (remaining > 0) document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(value))}; Path=/; SameSite=Lax; Max-Age=${remaining}; Secure`
  } catch { /* Optional measurement must never block checkout. */ }
}
export function rememberLanding(pathname: string, params: URLSearchParams) {
  try {
    const clicks = Object.fromEntries(CLICK_ID_FIELDS.flatMap(field => { const id = validateClickId(params.get(field)); return id ? [[field, id]] : [] }))
    const campaign = ['utm_source', 'utm_medium', 'utm_campaign'].some(key => TEXT.test(params.get(key) ?? ''))
    if (stored() && !Object.keys(clicks).length && !campaign) return
    const context = clean({ landingPage: pathname, utmSource: params.get('utm_source'), utmMedium: params.get('utm_medium'), utmCampaign: params.get('utm_campaign'), ...clicks })
    window.sessionStorage.setItem(KEY, JSON.stringify({ capturedAt: Date.now(), context }))
    persistLanding()
  } catch { /* Storage is optional. */ }
}
export function forgetLanding() {
  try { window.sessionStorage.removeItem(KEY); document.cookie = `${COOKIE}=; Path=/; SameSite=Lax; Max-Age=0; Secure` } catch { /* optional */ }
}
export function readLanding(): LandingContext { return stored()?.context ?? {} }
