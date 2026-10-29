import Link from 'next/link'
import { HeroPriceCheck, type PriceCheckProduct } from '@/components/hero-price-check'
import { listStorefrontProviderProducts } from '@/lib/public-provider-catalog'
import { formatUsd } from '@/lib/money'
import { pageMetadata } from '@/lib/seo'
export const dynamic = 'force-dynamic'
export const metadata = pageMetadata('/services/unlock/us','US carrier unlock services','Compare available US carrier unlock services, current USD prices and delivery estimates before entering your device details.')
export default async function UsUnlock({searchParams}:{searchParams:Promise<{product?:string}>}) {
  const {product}=await searchParams
  const services=listStorefrontProviderProducts('unlock').filter(p=>p.group==='USA Networks' && /\(Clean\)/i.test(p.name) && p.status==='available' && p.priceAvailable)
  const selected=services.find(p=>p.productCode===product)?.productCode
  const options:PriceCheckProduct[]=services.map(p=>({code:p.productCode,domain:p.domain,name:p.name,category:p.group,summary:p.summary,hasExample:p.hasExample,available:true,inputType:p.inputType,priceCents:p.priceCents,priceAvailable:true,etaLabel:p.etaLabel}))
  return <section className="section section--tint service-entry-section unlock-landing"><div className="shell">
    <nav className="service-breadcrumb" aria-label="Breadcrumb"><Link href="/services/unlock">Unlock services</Link><span>/</span><span>United States</span></nav>
    <div className="service-hero-copy"><span className="hero-chip">US carrier unlocking</span><h1 className="service-entry-title">Check the price.<br/><span className="accent">Keep your phone.</span></h1><p className="t-lead">Choose an available service below. See its price and delivery estimate before entering your IMEI and email.</p></div>
    <div className="requirements-card"><h2>For devices you own</h2><p>These services are for fully paid-off devices that meet the listed carrier requirements. We do not accept lost, stolen or blacklisted devices on this page. iUnlockMobile is an independent service, not affiliated with any carrier. Eligibility is confirmed during processing; an IMEI format check does not guarantee an unlock.</p></div>
    <ul className="tile-grid" aria-label="Available US services">{services.map(p=><li key={p.productCode}><Link className="tile" href={`/services/unlock/us?product=${encodeURIComponent(p.productCode)}#us-order`}><span><strong>{p.name}</strong><br/>{formatUsd(p.priceCents)} · {p.etaLabel}<small>Review final payment total before paying</small></span></Link></li>)}</ul>
    {!services.length&&<p>No US carrier unlock service is currently available for online payment. <Link href="/support">Contact support before paying.</Link></p>}
    <p className="t-small">T-Mobile or Verizon? We do not currently list a clean-device unlock service for those networks here. <Link href="/services/imei-check">View paid carrier-status checks</Link> or <Link href="/support">ask about availability</Link>. A status report is not an unlock.</p>
    {services.length>0&&<div className="hero-panel" id="us-order"><HeroPriceCheck key={selected??'us'} unlock={options} check={[]} ordering fixedDomain="unlock" initialProductCode={selected}/></div>}
    <div className="requirements-card"><h2>Payment and delivery</h2><p>Pay for this order by card or crypto. No wallet top-up is required for guest checkout. Processing starts after payment is verified. Your private tracking link and results are sent by email.</p><p>If a direct card order cannot be delivered, the system initiates a refund to the original payment method. Your bank controls when it appears on your statement. If the payment needs manual review, contact support with your order reference. Crypto refunds require support; orders paid with account credit return to that balance.</p><Link href="/support">Payment and refund help</Link></div>
    <p className="service-guides"><Link href="/services/unlock">Browse all unlock services</Link> · <Link href="/track">Track your order</Link></p>
  </div></section>
}
