import Link from 'next/link'
import { ARTICLE_REPORT_CODE } from '@/lib/article-report-offer'
import { guestCheckoutEnabled } from '@/lib/guest-checkout'
import { guestCryptoEnabled } from '@/lib/guest-crypto'
import { QuickImeiCheckCard } from '../QuickImeiCheckCard'
import { ArticleCarrierWidget } from '../article-carrier-widget'
import { croAssignment } from '@/lib/cro/server'
import { getPaidReportProduct } from '@/lib/paid-reports'
import { msg } from '@/lib/i18n/messages'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { formatUsd } from '@/lib/money'
import { p2 } from '@/lib/i18n/phase2'
import { routeFor } from '@/lib/i18n/route-map'
import type { GeoLocale } from '@/lib/geo-locales'
import { CroImpression } from './cro-impression'
import styles from '@/styles/cro.module.css'

/**
 * CRO-01. Variant B is the single-step IMEI form already used on articles
 * with each locale's own form; control A links to the same product at checkout.
 */
export async function ArticleCta({ locale }: { locale: GeoLocale }) {
  const assignment = await croAssignment('CRO-01')
  const product = getPaidReportProduct(ARTICLE_REPORT_CODE)
  const card = guestCheckoutEnabled(), crypto = guestCryptoEnabled()
  const available = product && product.providerReady && product.priceCents > 0 && (card || crypto)
  const priceLabel = available ? [
    crypto && `${formatUsd(product.priceCents)} (${msg(locale, 'Crypto total')})`,
    card && `${formatUsd(guestCardQuote(product.priceCents).totalCents)} (${msg(locale, 'Card total')})`,
  ].filter(Boolean).join(' / ') : ''
  const form = locale === 'en' ? <ArticleCarrierWidget productCode={ARTICLE_REPORT_CODE} /> :
    <div className="hero-panel"><QuickImeiCheckCard locale={locale} priceLabel={priceLabel} paymentMethod={card ? 'card' : 'crypto'}
      products={available ? [{code:product.code, name:product.name, domain:product.domain, cents:product.priceCents}] : []} /></div>
  return <>
    <CroImpression {...assignment} />
    {assignment.variant === 'B' || !available ? form : <div className={'hero-panel ' + styles.control} data-cro="CRO-01">
      <h2>{product.name}</h2>
      <p>{p2(locale, 'See which network an iPhone is locked to for {price}, then choose the right service.', { price: priceLabel })}</p>
      <Link className="button button--primary" href={routeFor('/checkout', locale) + '?product=' + encodeURIComponent(product.code) + (card ? '' : '&method=crypto')}>{p2(locale, 'Open the carrier check')}</Link>
    </div>}
  </>
}
