'use client'
import { useEffect } from 'react'
import { trackFunnelEventOnce } from '@/lib/funnel-analytics'
export function PaymentFunnelEvents({ reference, settled, paymentMethod }: { reference: string; settled: boolean; paymentMethod?: 'card' | 'crypto' }) {
  useEffect(() => {
    const browser = window as Window & { iunlockmobileAnalyticsConsent?: string }
    const emit = () => {
      if (browser.iunlockmobileAnalyticsConsent !== 'granted') return
      // Completion is emitted only by the verified server payment worker.
      trackFunnelEventOnce('payment_viewed', reference, { service_category: 'account_credit', status: settled ? 'verified' : 'created', payment_method: paymentMethod })
    }
    emit()
    window.addEventListener('iunlockmobile-consent', emit)
    return () => window.removeEventListener('iunlockmobile-consent', emit)
  }, [reference, settled, paymentMethod])
  return null
}
