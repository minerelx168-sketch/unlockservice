'use client'
import {useCopy} from '@/lib/i18n/client'

import type { ServiceInputType } from '@/lib/service-identifier'
import { useState } from 'react'
import { ServiceDescription } from './service-description'
import { formatUsd } from '@/lib/money'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { GuestCheckoutForm } from './guest-checkout-form'
import croStyles from '@/styles/cro.module.css'

/** CRO-05 variant B: the Pro upgrade offered on a Lite order, labels already translated by the server. */
export type OrderBump = { name: string; priceCents: number; label: string; detail: string }

export function GuestCheckoutPanel({ product, deliveryLabel, initialImei, initialEmail, cardEnabled, cryptoEnabled, cryptoRoutes, initialMethod, bump }: {
  product: { inputType: ServiceInputType; code: string; name: string; summary: string; priceCents: number; domain: 'unlock' | 'imei_check' }
  deliveryLabel: string; initialImei: string; initialEmail: string
  cardEnabled: boolean; cryptoEnabled: boolean; cryptoRoutes: { id: string; label: string; asset: string }[]
  initialMethod: 'card' | 'crypto'
  bump?: OrderBump
}) {
  const t=useCopy()
  const [method, setMethod] = useState(initialMethod)
  const isCrypto = method === 'crypto'
  const [bumped, setBumped] = useState(false)
  /* The order keeps the Lite code and the IMEI; the server swaps it to Pro only
     for a visitor in CRO-05 variant B, and checks the Pro price it expects. */
  const effective = bump && bumped ? { ...product, name: bump.name, priceCents: bump.priceCents } : product
  const cardQuote = guestCardQuote(effective.priceCents)
  return <div className="guest-grid guest-grid--single"><article className="guest-card guest-summary"><span className="eyebrow">{t("Your order")}</span><h2>{effective.name}</h2>
    <dl aria-live="polite"><div><dt>{t("Estimated delivery")}</dt><dd>{deliveryLabel}</dd></div><div className="guest-total"><dt>{isCrypto ? t("Crypto total") : t("Card total")}</dt><dd>{formatUsd(isCrypto ? effective.priceCents : cardQuote.totalCents)}</dd></div></dl>
    {bump ? <label className={croStyles.bump} data-cro="CRO-05"><input type="checkbox" checked={bumped} onChange={(event) => setBumped(event.currentTarget.checked)} /><span><strong>{bump.label}</strong><small>{bump.detail}</small></span></label> : null}
    <GuestCheckoutForm product={effective} orderBump={Boolean(bump && bumped)} initialImei={initialImei} initialEmail={initialEmail} enabled={cardEnabled} method={method} onMethodChange={setMethod} cryptoEnabled={cryptoEnabled} cryptoRoutes={cryptoRoutes} />
    {product.summary ? <details className="guest-policy"><summary>{t("Service details & requirements")}</summary><ServiceDescription value={product.summary} /></details> : null}
    <details className="guest-policy"><summary>{t("If we cannot deliver")}</summary><p>{isCrypto ? t("Our team will arrange your crypto refund and confirm a safe receiving wallet with you. Crypto refunds require a manual review; do not send another payment.") : t("We request a full refund to your original payment method, including the card fee. Bank processing time may vary.")}</p><p>{t("Delivery times are estimates. Device eligibility and service requirements apply.")}</p></details>
  </article></div>
}
