'use client'

import type { ServiceInputType } from '@/lib/service-identifier'
import { useState } from 'react'
import { ServiceDescription } from './service-description'
import { formatUsd } from '@/lib/money'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { GuestCheckoutForm } from './guest-checkout-form'

export function GuestCheckoutPanel({ product, deliveryLabel, initialImei, initialEmail, cardEnabled, cryptoEnabled, cryptoRoutes, initialMethod }: {
  product: { inputType: ServiceInputType; code: string; name: string; summary: string; priceCents: number; domain: 'unlock' | 'imei_check' }
  deliveryLabel: string; initialImei: string; initialEmail: string
  cardEnabled: boolean; cryptoEnabled: boolean; cryptoRoutes: { id: string; label: string; asset: string }[]
  initialMethod: 'card' | 'crypto'
}) {
  const [method, setMethod] = useState(initialMethod)
  const isCrypto = method === 'crypto'
  const cardQuote = guestCardQuote(product.priceCents)
  return <div className="guest-grid guest-grid--single"><article className="guest-card guest-summary"><span className="eyebrow">YOUR ORDER</span><h2>{product.name}</h2>
    <dl aria-live="polite"><div><dt>Estimated delivery</dt><dd>{deliveryLabel}</dd></div><div className="guest-total"><dt>{isCrypto ? 'Crypto total' : 'Card total'}</dt><dd>{formatUsd(isCrypto ? product.priceCents : cardQuote.totalCents)}</dd></div></dl>
    <GuestCheckoutForm product={product} initialImei={initialImei} initialEmail={initialEmail} enabled={cardEnabled} method={method} onMethodChange={setMethod} cryptoEnabled={cryptoEnabled} cryptoRoutes={cryptoRoutes} />
    {product.summary ? <details className="guest-policy"><summary>Service details &amp; requirements</summary><ServiceDescription value={product.summary} /></details> : null}
    <details className="guest-policy"><summary>If we cannot deliver</summary><p>{isCrypto ? 'Our team will arrange your crypto refund and confirm a safe receiving wallet with you. Crypto refunds require a manual review; do not send another payment.' : 'We request a full refund to your original payment method, including the card fee. Bank processing time may vary.'}</p><p>Delivery times are estimates. Device eligibility and service requirements apply.</p></details>
  </article></div>
}
