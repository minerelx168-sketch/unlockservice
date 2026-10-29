'use client'
import { CLICK_ID_FIELDS, validateClickId } from './attribution'

/**
 * First landing of this browser tab: path (no query), first UTM tags and ad click
 * IDs. Sent with a checkout so the server can show where the sale came from.
 * Cleared when the visitor refuses optional tracking.
 */
const KEY = 'iunlockmobile:landing'
const TEXT = /^[A-Za-z0-9._~+-]{1,80}$/
export type LandingContext = { landingPage?: string; utmSource?: string; utmMedium?: string; utmCampaign?: string; gclid?: string; gbraid?: string; wbraid?: string }

export function rememberLanding(pathname: string, params: URLSearchParams) {
  try {
    const existing = window.sessionStorage.getItem(KEY)
    const clicks = Object.fromEntries(CLICK_ID_FIELDS.flatMap((field) => { const id = validateClickId(params.get(field)); return id ? [[field, id]] : [] }))
    if (existing && !Object.keys(clicks).length) return
    const pick = (name: string) => { const value = params.get(name); return value && TEXT.test(value) ? value : undefined }
    const value: LandingContext = { landingPage: /^\/[A-Za-z0-9/_.-]{0,159}$/.test(pathname) ? pathname : undefined,
      utmSource: pick('utm_source'), utmMedium: pick('utm_medium'), utmCampaign: pick('utm_campaign'), ...clicks }
    window.sessionStorage.setItem(KEY, JSON.stringify(value))
  } catch { /* Storage is optional. */ }
}
export function forgetLanding() { try { window.sessionStorage.removeItem(KEY) } catch { /* optional */ } }
export function readLanding(): LandingContext {
  try { const value = JSON.parse(window.sessionStorage.getItem(KEY) ?? '{}'); return value && typeof value === 'object' ? value as LandingContext : {} } catch { return {} }
}
