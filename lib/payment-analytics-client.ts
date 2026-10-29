'use client'
import { analyticsHostAllowed } from './site'

/** Fetch the actual GA browser identifiers only with consent; never invent IDs. */
export async function paymentAnalyticsContext(): Promise<{ clientId: string; sessionId: string } | undefined> {
  if (typeof window === 'undefined' || !analyticsHostAllowed(window.location.hostname)) return
  const browser = window as Window & { iunlockmobileAnalyticsConsent?: string; gtag?: (...args: unknown[]) => void }
  if (!browser.iunlockmobileAnalyticsConsent) await new Promise<void>(resolve => {
    const done = () => { clearTimeout(timer); window.removeEventListener('iunlockmobile-consent', done); resolve() }
    const timer = setTimeout(done, 2000)
    window.addEventListener('iunlockmobile-consent', done, { once: true })
  })
  if (browser.iunlockmobileAnalyticsConsent !== 'granted' || !browser.gtag) return
  const get = (field: string) => new Promise<string>((resolve) => {
    const timer = setTimeout(() => resolve(''), 2000)
    try { browser.gtag!('get', 'G-9WCELVR3V3', field, (value: unknown) => {
      clearTimeout(timer); resolve(typeof value === 'string' || typeof value === 'number' ? String(value) : '')
    }) } catch { clearTimeout(timer); resolve('') }
  })
  const [clientId, sessionId] = await Promise.all([get('client_id'), get('session_id')])
  if (browser.iunlockmobileAnalyticsConsent === 'granted' && /^\d{1,20}\.\d{1,20}$/.test(clientId) && /^\d{1,12}$/.test(sessionId)) return { clientId, sessionId }
}
