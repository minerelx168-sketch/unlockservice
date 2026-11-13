import { aiReferral, croAssignment } from '@/lib/cro/server'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { formatUsd } from '@/lib/money'
import type { GeoLocale } from '@/lib/geo-locales'
import { p2 } from '@/lib/i18n/phase2'
import { CroImpression } from './cro-impression'
import styles from '@/styles/cro.module.css'

/** CRO-03: only AI-referred sessions are in the test; everyone else sees nothing. */
export async function AiPriceBanner({ locale, priceCents }: { locale: GeoLocale; priceCents: number }) {
  if (!(priceCents > 0) || !(await aiReferral())) return null
  const assignment = await croAssignment('CRO-03')
  const base = formatUsd(priceCents), card = formatUsd(guestCardQuote(priceCents).totalCents)
  return <>
    <CroImpression {...assignment} />
    {assignment.variant === 'B' ? <p className={styles.banner} role="note" data-cro="CRO-03">{p2(locale, 'Transparent single-order pricing: {base} base ({card} card total) or {base} via USDT (0% platform fee). No subscription, no second fee, and a full refund to your card if we cannot deliver the service.', { base, card })}</p> : null}
  </>
}
