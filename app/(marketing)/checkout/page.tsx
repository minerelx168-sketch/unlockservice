import { storefrontDomain } from '@/lib/service-groups'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPaidReportProduct } from '@/lib/paid-reports'
import { readDeviceIntent } from '@/lib/device-intent'
import { guestCheckoutEnabled } from '@/lib/guest-checkout'
import { guestCryptoEnabled, guestCryptoRoutes } from '@/lib/guest-crypto'
import { currentSession } from '@/lib/auth'
import { CUSTOMER_IMEI_CHECK_PRODUCTS, CUSTOMER_UNLOCK_PRODUCTS } from '@/lib/customer-provider-products'
import { GuestCheckoutPanel } from '@/components/guest-checkout-panel'
import '@/styles/guest-checkout.css'
export const dynamic='force-dynamic'
export const metadata={title:'Secure service checkout | iUnlockMobile',robots:{index:false,follow:false},referrer:'no-referrer' as const}
export default async function CheckoutPage({searchParams}:{searchParams:Promise<{product?:string;method?:string}>}) {
  const params=await searchParams
  const product=getPaidReportProduct(params.product??'')
  if(!product || !product.providerReady || product.priceCents<=0) notFound()
  const [intent, session] = await Promise.all([readDeviceIntent(), currentSession()])
  const accountReady=Boolean(session?.user.account_type==='customer' && session.user.status==='active' && !session.user.banned_at && session.user.email_verified_at)
  const deliveryLabel=[...CUSTOMER_IMEI_CHECK_PRODUCTS,...CUSTOMER_UNLOCK_PRODUCTS].find(entry=>entry.productCode===product.code)?.etaLabel ?? 'Confirmed for your selected service'
  return <section className="guest-shell">
    <Link className="guest-back" href={storefrontDomain(product)==='unlock'?'/services/unlock':'/services/imei-check'}>← Back to services</Link>
    <div className="guest-heading"><span className="eyebrow">SECURE CHECKOUT</span><h1>Your service.<br/>One simple payment.</h1><p>Pay securely. Follow your order online and receive the result by email.</p></div>
    <GuestCheckoutPanel product={{code:product.code,name:product.name,summary:product.summary,priceCents:product.priceCents,domain:product.domain}} deliveryLabel={deliveryLabel} initialImei={intent?.productCode===product.code?intent.imei:''} initialEmail={intent?.productCode===product.code?intent.email??'':''} cardEnabled={guestCheckoutEnabled()} cryptoEnabled={guestCryptoEnabled()} cryptoRoutes={guestCryptoRoutes()} initialMethod={params.method==='crypto'?'crypto':'card'} accountReady={accountReady} accountEmail={accountReady?session!.user.email:''} />
  </section>
}
