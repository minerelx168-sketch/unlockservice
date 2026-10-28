import { notFound } from 'next/navigation'
import { authorizedGuestCheckout } from '@/lib/guest-checkout'
import { getGuestCryptoStatus } from '@/lib/guest-crypto'
import { GuestCryptoPayment } from '@/components/guest-crypto-payment'
import '@/styles/guest-checkout.css'
import '@/styles/guest-crypto.css'

export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Pay with crypto | iUnlockMobile',
  robots: { index: false, follow: false, noarchive: true },
  referrer: 'no-referrer' as const,
}

export default async function CryptoCheckoutPage({ params, searchParams }: {
  params: Promise<{ reference: string }>
  searchParams: Promise<{ key?: string }>
}) {
  const key = (await searchParams).key ?? ''
  const reference = (await params).reference
  const row = authorizedGuestCheckout(reference, key)
  if (!row || row.payment_method !== 'crypto') notFound()
  const initial = await getGuestCryptoStatus(reference, key)
  if (!initial) notFound()
  return <GuestCryptoPayment initial={initial} accessKey={key}
    backUrl={`/checkout?product=${encodeURIComponent(row.product_code)}&method=crypto`} />
}
