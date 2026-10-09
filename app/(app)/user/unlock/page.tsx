import type { Metadata } from 'next'
import { ServiceOrderWorkspace } from '@/components/service-order-workspace'
import { readQuote } from '@/lib/quote'

export const metadata: Metadata = { title: 'Unlock services' }
export const dynamic = 'force-dynamic'

/** Legacy customer URL now uses the verified catalog checkout, not /api/orders. */
export default async function UnlockPage() {
  const quote = await readQuote()
  return <ServiceOrderWorkspace domain="unlock" fallbackImei={quote?.imei} />
}
