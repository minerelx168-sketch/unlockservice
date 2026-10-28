'use client'

import type { ServiceInputType } from '@/lib/service-identifier'
import { useState } from 'react'
import Link from 'next/link'
import { formatUsd } from '@/lib/money'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { GuestCheckoutForm } from './guest-checkout-form'

export function GuestCheckoutPanel({ product, deliveryLabel, initialImei, initialEmail, cardEnabled, cryptoEnabled, cryptoRoutes, initialMethod, accountReady, accountEmail }: {
  product: { inputType: ServiceInputType; code: string; name: string; summary: string; priceCents: number; domain: 'unlock' | 'imei_check' }
  deliveryLabel: string; initialImei: string; initialEmail: string
  cardEnabled: boolean; cryptoEnabled: boolean; cryptoRoutes: { id: string; label: string; asset: string }[]
  initialMethod: 'card' | 'crypto'; accountReady: boolean; accountEmail: string
}) {
  const [method, setMethod] = useState(initialMethod)
  const isCrypto = method === 'crypto'
  const cardQuote = guestCardQuote(product.priceCents)
  const accountCard = !isCrypto && cardQuote.requiresAccount
  return <div className="guest-grid"><article className="guest-card guest-summary"><span className="eyebrow">YOUR ORDER</span><h2>{product.name}</h2>{product.summary ? <details><summary>Service details &amp; requirements</summary><p style={{ whiteSpace: 'pre-line' }}>{product.summary}</p></details> : null}
    <dl aria-live="polite"><div><dt>Estimated delivery</dt><dd>{deliveryLabel}</dd></div><div><dt>Service</dt><dd>{formatUsd(product.priceCents)}</dd></div>{accountCard ? <div><dt>Saved as account credit</dt><dd>{formatUsd(cardQuote.walletCreditCents)}</dd></div> : null}<div><dt>{isCrypto ? 'Crypto processing fee' : 'Card fee (5%)'}</dt><dd>{isCrypto ? 'No fee' : formatUsd(cardQuote.feeCents)}</dd></div><div className="guest-total"><dt>{isCrypto ? 'Service total' : 'Total before tax'}</dt><dd>{formatUsd(isCrypto ? product.priceCents : cardQuote.totalCents)}</dd></div></dl>
    {isCrypto ? <p className="guest-note">No minimum. Pay with USDT or USDC on BNB Smart Chain. The payment screen gives you an exact transfer amount with tiny identifying decimal digits. Network or exchange fees may apply.</p> : null}
    <div className="guest-assurance"><strong>If we cannot deliver</strong><p>{isCrypto ? 'Our team will arrange your crypto refund and confirm a safe receiving wallet with you. Crypto refunds require a manual review; do not send another payment.' : accountCard ? 'We arrange a refund to your card. Used account credit may need review.' : 'For this direct card order, we request a full refund to your original payment method, including the card fee. It is not returned as wallet credit. Bank processing time may vary.'}</p></div>
    <p className="guest-note">Delivery times are estimates. Device eligibility and the selected service’s requirements apply.</p>
  </article><article className="guest-card"><h2>{initialImei && initialEmail ? 'Review your details and pay' : 'Where should we send your result?'}</h2>
    <GuestCheckoutForm product={product} initialImei={initialImei} initialEmail={initialEmail} enabled={cardEnabled} method={method} onMethodChange={setMethod} cryptoEnabled={cryptoEnabled} cryptoRoutes={cryptoRoutes} accountReady={accountReady} accountEmail={accountEmail} />
    <p className="guest-existing">Already have credit? <Link href={`/user/reports/new?product=${encodeURIComponent(product.code)}`}>Pay with your account balance</Link></p>
  </article></div>
}

