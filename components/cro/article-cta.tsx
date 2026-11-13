import Link from 'next/link'
import { croAssignment } from '@/lib/cro/server'
import { getPaidReportProduct } from '@/lib/paid-reports'
import { formatUsd } from '@/lib/money'
import { p2 } from '@/lib/i18n/phase2'
import { routeFor } from '@/lib/i18n/route-map'
import type { GeoLocale } from '@/lib/geo-locales'
import { CroImpression } from './cro-impression'
import styles from '@/styles/cro.module.css'

/**
 * CRO-01. Variant B is the single-step IMEI form already used on articles
 * (passed in as children so each locale keeps its own form); control A is a
 * plain card linking to the carrier-check service page.
 */
export async function ArticleCta({ locale, children }: { locale: GeoLocale; children: React.ReactNode }) {
  const assignment = await croAssignment('CRO-01')
  const product = getPaidReportProduct('APPLE_CARRIER_LITE')
  const price = product && product.priceCents > 0 ? formatUsd(product.priceCents) : null
  return <>
    <CroImpression {...assignment} />
    {assignment.variant === 'B' || !price ? children : <div className={'hero-panel ' + styles.control} data-cro="CRO-01">
      <h2>{p2(locale, 'Check the carrier before you pay for an unlock')}</h2>
      <p>{p2(locale, 'See which network an iPhone is locked to for {price}, then choose the right service.', { price })}</p>
      <Link className="button button--primary" href={routeFor('/services/imei-check/apple-carrier-lock-status', locale) + '?product=APPLE_CARRIER_LITE'}>{p2(locale, 'Open the carrier check')}</Link>
    </div>}
  </>
}
