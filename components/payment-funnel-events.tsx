'use client'
import { useEffect } from 'react'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
export function PaymentFunnelEvents({ reference, settled }: { reference: string; settled: boolean }) {
  useEffect(() => {
    const browser = window as Window & { iunlockmobileAnalyticsConsent?: string }
    const emit = () => {
      if (browser.iunlockmobileAnalyticsConsent !== 'granted') return
      for (const event of ['payment_request_created', 'payment_viewed', ...(settled ? ['payment_completed'] as const : [])] as const) {
        // The reference stays in this tab's dedup key; it is never sent to analytics.
        const key = `iunlockmobile-funnel:${event}:${reference}`
        try {
          if (sessionStorage.getItem(key)) continue
          trackFunnelEvent(event, { service_category: 'account_credit', status: event === 'payment_completed' ? 'verified' : 'created' })
          sessionStorage.setItem(key, '1')
        } catch { /* Storage failures must never interfere with payment. */ }
      }
    }
    emit()
    window.addEventListener('iunlockmobile-consent', emit)
    return () => window.removeEventListener('iunlockmobile-consent', emit)
  }, [reference, settled])
  return null
}
