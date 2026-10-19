'use client'
import { useEffect } from 'react'
import { trackFunnelEventOnce } from '@/lib/funnel-analytics'
export function PaymentFunnelEvents({ reference, settled, paymentMethod }: { reference: string; settled: boolean; paymentMethod?: 'card' | 'crypto' }) {
  useEffect(() => {
    const browser = window as Window & { iunlockmobileAnalyticsConsent?: string }
    const emit = () => {
      if (browser.iunlockmobileAnalyticsConsent !== 'granted') return
      for (const event of ['payment_viewed', ...(settled ? ['payment_completed'] as const : [])] as const) {
        trackFunnelEventOnce(event, reference, { service_category: 'account_credit', status: event === 'payment_completed' ? 'verified' : 'created', payment_method: paymentMethod })
      }
    }
    emit()
    window.addEventListener('iunlockmobile-consent', emit)
    return () => window.removeEventListener('iunlockmobile-consent', emit)
  }, [reference, settled, paymentMethod])
  return null
}
