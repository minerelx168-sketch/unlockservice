import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getPaidReportProduct } from '@/lib/paid-reports'
import { readDeviceIntent } from '@/lib/device-intent'
import { guestCheckoutEnabled } from '@/lib/guest-checkout'
import { cardFeeCents } from '@/lib/card-fee'
import { formatUsd } from '@/lib/money'
import { GuestCheckoutForm } from '@/components/guest-checkout-form'
import '@/styles/guest-checkout.css'
export const dynamic='force-dynamic'
export const metadata={title:'Secure service checkout | iUnlockMobile',robots:{index:false,follow:false},referrer:'no-referrer' as const}
export default async function CheckoutPage({searchParams}:{searchParams:Promise<{product?:string}>}) {
  const product=getPaidReportProduct((await searchParams).product??'')
  if(!product || !product.providerReady || product.priceCents<=0) notFound()
  const intent=await readDeviceIntent(),fee=cardFeeCents(product.priceCents)
  return <section className="guest-shell">
    <Link className="guest-back" href={product.domain==='unlock'?'/services/unlock':'/services/imei-check'}>← Back to services</Link>
    <div className="guest-heading"><span className="eyebrow">SECURE GUEST CHECKOUT</span><h1>Your service.<br/>One simple payment.</h1><p>No account needed. Follow your order online and receive the result by email.</p></div>
    <div className="guest-grid"><article className="guest-card guest-summary"><span className="eyebrow">YOUR ORDER</span><h2>{product.name}</h2><p>{product.summary}</p>
      <dl><div><dt>Estimated delivery</dt><dd>{product.etaMinutes>=60?`${Math.ceil(product.etaMinutes/60)} hours`:`${product.etaMinutes} minutes`}</dd></div><div><dt>Service</dt><dd>{formatUsd(product.priceCents)}</dd></div><div><dt>Card fee (5%)</dt><dd>{formatUsd(fee)}</dd></div><div className="guest-total"><dt>Total before tax</dt><dd>{formatUsd(product.priceCents+fee)}</dd></div></dl>
      <div className="guest-assurance"><strong>If we cannot deliver</strong><p>For this direct card order, we request a full refund to your original payment method, including the card fee. It is not returned as wallet credit. Bank processing time may vary.</p></div>
      <p className="guest-note">Delivery times are estimates. Device eligibility and the selected service’s requirements apply.</p>
    </article><article className="guest-card"><h2>Where should we send your result?</h2><GuestCheckoutForm product={product} feeCents={fee} initialImei={intent?.productCode===product.code?intent.imei:''} enabled={guestCheckoutEnabled()}/>
      <p className="guest-existing">Already have credit? <Link href={`/user/reports/new?product=${encodeURIComponent(product.code)}`}>Pay with your account balance</Link></p>
    </article></div>
  </section>
}
