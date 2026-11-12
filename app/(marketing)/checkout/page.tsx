import {headers} from 'next/headers'
import {msg} from '@/lib/i18n/messages'
import {localeOf,routeFor} from '@/lib/i18n/route-map'
import {localProduct} from '@/lib/i18n/catalog'
import { isMemberUnlock } from '@/lib/member-unlocks'
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
import '@/styles/guest-checkout.css'
export const dynamic='force-dynamic'
export const metadata={title:'Secure service checkout | iUnlockMobile',robots:{index:false,follow:false},referrer:'no-referrer' as const}
export default async function CheckoutPage({searchParams}:{searchParams:Promise<{product?:string;method?:string}>}) {
  const l=localeOf((await headers()).get("x-continuation-path")?.split("?")[0]??"/"),t=(k:Parameters<typeof msg>[1])=>msg(l,k)
  const params=await searchParams
  const product=getPaidReportProduct(params.product??'')
  if(!product || !product.providerReady || product.priceCents<=0) notFound()
  const viewer = await currentSession()
  if (!viewer && isMemberUnlock(product.code)) redirect('/login?next=/services/unlock/more')
  if (viewer?.user.account_type === 'reseller') redirect(`/user/reports/new?product=${encodeURIComponent(product.code)}`)
  const intent = await readDeviceIntent()
  const deliveryLabel=[...CUSTOMER_IMEI_CHECK_PRODUCTS,...CUSTOMER_UNLOCK_PRODUCTS].find(entry=>entry.productCode===product.code)?.etaLabel ?? 'Confirmed for your selected service'
  const translated=localProduct({...product,etaLabel:deliveryLabel},l)
  return <section className="guest-shell">
    <Link className="guest-back" href={l==='en'?(storefrontDomain(product)==='unlock'?'/services/unlock':'/services/imei-check'):routeFor(storefrontDomain(product)==='unlock'?'/services/unlock/us/att':'/services/imei-check',l)}>← {t('Services')}</Link>
    <div className="guest-heading"><span className="eyebrow">{t('Secure checkout')}</span><h1>{t('Review and pay')}</h1><p>{t('No account needed. Your result and private tracking link arrive by email.')}</p></div>
    <GuestCheckoutPanel product={{code:product.code,name:translated.name,summary:translated.summary,inputType:product.inputType,priceCents:product.priceCents,domain:product.domain}} deliveryLabel={translated.etaLabel} initialImei={intent?.productCode===product.code?intent.imei:''} initialEmail={intent?.productCode===product.code?intent.email??'':''} cardEnabled={guestCheckoutEnabled()} cryptoEnabled={guestCryptoEnabled()} cryptoRoutes={guestCryptoRoutes()} initialMethod={params.method==='crypto'?'crypto':'card'} />
  </section>
}
