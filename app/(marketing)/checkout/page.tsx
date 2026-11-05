import { storefrontDomain } from '@/lib/service-groups'
import Link from 'next/link'
import { currentSession } from '@/lib/auth'
import { notFound, redirect } from 'next/navigation'
import { getPaidReportProduct } from '@/lib/paid-reports'
import { readDeviceIntent } from '@/lib/device-intent'
import { guestCheckoutEnabled } from '@/lib/guest-checkout'
import { guestCryptoEnabled, guestCryptoRoutes } from '@/lib/guest-crypto'
import { CUSTOMER_IMEI_CHECK_PRODUCTS, CUSTOMER_UNLOCK_PRODUCTS } from '@/lib/customer-provider-products'
import { GuestCheckoutPanel } from '@/components/guest-checkout-panel'
import { checkoutReminderConfigured } from '@/lib/checkout-reminders'
import '@/styles/guest-checkout.css'
export const dynamic='force-dynamic'
export const metadata={title:'Secure service checkout | iUnlockMobile',robots:{index:false,follow:false},referrer:'no-referrer' as const}
export default async function CheckoutPage({searchParams}:{searchParams:Promise<{product?:string;method?:string}>}) {
  const params=await searchParams
  const product=getPaidReportProduct(params.product??'')
  if(!product || !product.providerReady || product.priceCents<=0) notFound()
  const found=await currentSession()
  if (found?.user.account_type === 'reseller') redirect(`/user/reports/new?product=${encodeURIComponent(product.code)}`)
  const reminderAllowed=checkoutReminderConfigured() && !!found && ['customer','reseller'].includes(found.user.account_type)
    && found.user.status==='active' && !found.user.banned_at && !!found.user.email_verified_at
  const intent = await readDeviceIntent()
  const deliveryLabel=[...CUSTOMER_IMEI_CHECK_PRODUCTS,...CUSTOMER_UNLOCK_PRODUCTS].find(entry=>entry.productCode===product.code)?.etaLabel ?? 'Confirmed for your selected service'
  return <section className="guest-shell">
    <Link className="guest-back" href={storefrontDomain(product)==='unlock'?'/services/unlock':'/services/imei-check'}>← Back to services</Link>
    <div className="guest-heading"><span className="eyebrow">SECURE CHECKOUT</span><h1>Review and pay</h1><p>No account needed. Your result and private tracking link arrive by email.</p></div>
    <GuestCheckoutPanel product={{code:product.code,name:product.name,summary:product.summary,inputType:product.inputType,priceCents:product.priceCents,domain:product.domain}} deliveryLabel={deliveryLabel} initialImei={intent?.productCode===product.code?intent.imei:''} initialEmail={intent?.productCode===product.code?intent.email??'':''} cardEnabled={guestCheckoutEnabled()} cryptoEnabled={guestCryptoEnabled()} cryptoRoutes={guestCryptoRoutes()} initialMethod={params.method==='crypto'?'crypto':'card'} reminderAllowed={reminderAllowed} />
  </section>
}
