'use client'

import { useEffect } from 'react'
import type { PurchaseConversion } from '@/lib/purchase-conversion'

const SEND_TO = 'AW-18465855968/NzXJCKKYj5QdEOCzmuVE'

/** The sitewide Google tag is already in <head>; fire only on a verified, charged purchase. */
export function GoogleAdsPurchaseConversion({ purchase }: { purchase: PurchaseConversion | null }) {
  useEffect(() => {
    if (!purchase) return
    const key = `iunlockmobile:ads-purchase:${purchase.transactionId}`
    try {
      if (window.sessionStorage.getItem(key) === 'sent') return
    } catch {
      // Google Ads also deduplicates by transaction_id if storage is unavailable.
    }

    const tag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag
    if (typeof tag !== 'function') return
    tag('event', 'conversion', {
      send_to: SEND_TO,
      value: purchase.value,
      currency: purchase.currency,
      transaction_id: purchase.transactionId,
      new_customer: purchase.newCustomer,
    })
    try { window.sessionStorage.setItem(key, 'sent') } catch { /* Storage is optional. */ }
  }, [purchase])
  return null
}
