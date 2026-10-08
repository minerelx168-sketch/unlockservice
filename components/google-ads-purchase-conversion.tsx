'use client'

import { useEffect } from 'react'
import type { PurchaseConversion } from '@/lib/purchase-conversion'

/** GTM owns the Ads conversion tag; never call gtag('conversion') here as well. */
export function GoogleAdsPurchaseConversion({ purchase }: { purchase: PurchaseConversion | null }) {
  useEffect(() => {
    if (!purchase) return
    const key = `iunlockmobile:ads-purchase:${purchase.transactionId}`
    try {
      if (window.sessionStorage.getItem(key) === 'sent') return
    } catch {
      // Google Ads also deduplicates by transaction_id if storage is unavailable.
    }

    // The nonce-bearing GTM bootstrap initializes this queue in <head>. If a
    // blocked GTM load leaves no queue, still retain the event until it loads.
    const w = window as Window & { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({
      event: 'iunlockmobile_purchase',
      value: purchase.value,
      currency: purchase.currency,
      transaction_id: purchase.transactionId,
      new_customer: purchase.newCustomer,
    })
    try { window.sessionStorage.setItem(key, 'sent') } catch { /* Storage is optional. */ }
  }, [purchase])
  return null
}
