'use client'
import { CLICK_ID_FIELDS, validateClickId, type ClickIdField } from './attribution'
import { analyticsHostAllowed } from './site'
import { safeAnalyticsPage } from './analytics-page'
function readClickIds(input: unknown): Partial<Record<ClickIdField, string>> {
  if (!input || typeof input !== 'object') return {}
  const result: Partial<Record<ClickIdField, string>> = {}
  for (const field of CLICK_ID_FIELDS) {
    const value = validateClickId((input as Record<string, unknown>)[field])
    if (value) result[field] = value
  }
  return result
}

let initialPageViewSent = false
/**
 * 'default' = the visitor has not chosen yet. Google's region-specific consent
 * default decides (denied in the EEA/UK/CH, granted elsewhere), so page views and
 * funnel events are sent and Google applies the right mode.
 */
export type AnalyticsState = 'granted' | 'denied' | 'default'
export function analyticsActive(): boolean {
  if (typeof window === 'undefined') return false
  const state = (window as Window & { iunlockmobileAnalyticsConsent?: string }).iunlockmobileAnalyticsConsent
  return state === 'granted' || state === 'default'
}
export function updateGoogleConsent(state: AnalyticsState, clickIds: Partial<Record<ClickIdField, string>> = {}) {
  const browser = window as Window & { iunlockmobileAnalyticsConsent?: string; gtag?: (...args: unknown[]) => void }
  browser.iunlockmobileAnalyticsConsent = state
  if (!analyticsHostAllowed(window.location.hostname) || document.documentElement.dataset.analyticsDisabled === 'true' || window.location.pathname.startsWith('/admin')) {
    browser.iunlockmobileAnalyticsConsent = 'denied'
    window.dispatchEvent(new Event('iunlockmobile-consent'))
    return
  }
  if (state !== 'default') browser.gtag?.('consent', 'update', { analytics_storage: state, ad_storage: state, ad_user_data: state, ad_personalization: state })
  if (state !== 'denied') {
    const safeIds = readClickIds(clickIds)
    if (typeof browser.gtag === 'function') {
      if (Object.keys(safeIds).length) browser.gtag('set', safeIds)
      const page = safeAnalyticsPage(window.location.href, document.referrer)
      const safeLocation = new URL(page.page_location)
      for (const field of CLICK_ID_FIELDS) if (safeIds[field]) safeLocation.searchParams.set(field, safeIds[field]!)
      browser.gtag('set', { ...page, page_location: safeLocation.href })
      for (const tag of ['AW-18465855968', 'G-9WCELVR3V3']) {
        browser.gtag('config', tag, {
          ...safeIds,
          ...page,
          send_page_view: false,
          page_location: safeLocation.href,
        })
      }
      if (!initialPageViewSent) {
        browser.gtag('event', 'page_view', { ...page, page_location: safeLocation.href, send_to: 'G-9WCELVR3V3' })
        initialPageViewSent = true
      }
    }
  }
  window.dispatchEvent(new Event('iunlockmobile-consent'))
}
