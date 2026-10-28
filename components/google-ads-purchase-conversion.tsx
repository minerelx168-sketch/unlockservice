'use client'

import { useEffect } from 'react'
import type { PurchaseConversion } from '@/lib/purchase-conversion'
import { analyticsHostAllowed } from '@/lib/site'

const ADS_SEND_TO = 'AW-18465855968/NzXJCKKYj5QdEOCzmuVE'
const GA4_SEND_TO = 'G-9WCELVR3V3'

type BrowserWithAnalytics = Window & {
  iunlockmobileAnalyticsConsent?: string
  gtag?: (...args: unknown[]) => void
}

/** Send only a verified, delivered/charged service purchase; top-ups never render this component. */
export function GoogleAdsPurchaseConversion({ purchase }: { purchase: PurchaseConversion | null }) {
  useEffect(() => {
    if (!purchase || !analyticsHostAllowed(window.location.hostname)) return
    const browser = window as BrowserWithAnalytics
    const emit = () => {
      if (browser.iunlockmobileAnalyticsConsent !== 'granted') return
      const tag = browser.gtag
      if (typeof tag !== 'function') return
      const adsKey = `iunlockmobile:ads-purchase:${purchase.transactionId}`
      const ga4Key = `iunlockmobile:ga4-purchase:${purchase.transactionId}`
      let adsSent = false
      let ga4Sent = false
      try { adsSent = window.sessionStorage.getItem(adsKey) === 'sent' } catch { /* Storage is optional. */ }
      try { ga4Sent = window.sessionStorage.getItem(ga4Key) === 'sent' } catch { /* Storage is optional. */ }

      if (!adsSent) {
        tag('event', 'conversion', {
          send_to: ADS_SEND_TO,
          value: purchase.value,
          currency: purchase.currency,
          transaction_id: purchase.transactionId,
          new_customer: purchase.newCustomer,
        })
        try { window.sessionStorage.setItem(adsKey, 'sent') } catch { /* Storage is optional. */ }
      }
      if (!ga4Sent && !purchase.ga4ServerManaged) {
        const event: Record<string, unknown> = {
          send_to: GA4_SEND_TO,
          transaction_id: purchase.transactionId,
          value: purchase.value,
          currency: purchase.currency,
        }
        if (purchase.items?.length) event.items = purchase.items
        tag('event', 'purchase', event)
        try { window.sessionStorage.setItem(ga4Key, 'sent') } catch { /* Storage is optional. */ }
      }
    }
    emit()
    window.addEventListener('iunlockmobile-consent', emit)
    return () => window.removeEventListener('iunlockmobile-consent', emit)
  }, [purchase])
  return null
}
