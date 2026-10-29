'use client'
import { analyticsHostAllowed } from './site'
import { analyticsActive } from './google-consent-tracking'
import { readLanding, type LandingContext } from './landing-context'

export type CheckoutAnalyticsContext = LandingContext & { clientId?: string; sessionId?: string }

/**
 * Real GA browser identifiers (never invented) plus the tab's landing context.
 * Nothing is returned once the visitor has refused optional tracking; the
 * server then records the sale as consent_denied and sends nothing.
 */
export async function paymentAnalyticsContext(): Promise<CheckoutAnalyticsContext | undefined> {
  if (typeof window === 'undefined' || !analyticsHostAllowed(window.location.hostname)) return
  const browser = window as Window & { iunlockmobileAnalyticsConsent?: string; gtag?: (...args: unknown[]) => void }
  if (!browser.iunlockmobileAnalyticsConsent) await new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); window.removeEventListener('iunlockmobile-consent', done); resolve() }
    const timer = setTimeout(done, 2000)
    window.addEventListener('iunlockmobile-consent', done, { once: true })
  })
  if (!analyticsActive()) return
  const landing = readLanding()
  if (!browser.gtag) return landing
  const get = (field: string) => new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve(''), 2000)
    try { browser.gtag!('get', 'G-9WCELVR3V3', field, (value: unknown) => {
      clearTimeout(timer); resolve(typeof value === 'string' || typeof value === 'number' ? String(value) : '')
    }) } catch { clearTimeout(timer); resolve('') }
  })
  const [clientId, sessionId] = await Promise.all([get('client_id'), get('session_id')])
  if (!analyticsActive()) return
  return /^\d{1,20}\.\d{1,20}$/.test(clientId) && /^\d{1,12}$/.test(sessionId) ? { ...landing, clientId, sessionId } : landing
}
