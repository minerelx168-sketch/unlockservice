import { connection } from 'next/server'
import Link from 'next/link'
import { getPaidReportProduct } from '@/lib/paid-reports'
import { guestCheckoutEnabled } from '@/lib/guest-checkout'
import { guestCryptoEnabled } from '@/lib/guest-crypto'
import { guestCardQuote } from '@/lib/guest-card-quote'
import { formatUsd } from '@/lib/money'
import { ArticleCarrierForm } from './article-carrier-form'
import styles from '@/styles/article-carrier-widget.module.css'

export async function ArticleCarrierWidget() {
  await connection() // Availability and retail prices must be read at request time.
  const product = getPaidReportProduct('APPLE_CARRIER_LITE')
  const card = guestCheckoutEnabled(), crypto = guestCryptoEnabled()
  if (!product?.providerReady || !product.isActive || product.priceCents <= 0 || !(card || crypto)) {
    return <aside><p>The quick carrier check is currently unavailable. <Link href="/services/imei-check/apple-carrier-lock-status">Compare carrier reports and free checks.</Link></p></aside>
  }
  const base = formatUsd(product.priceCents)
  return <section className={styles.card} aria-labelledby="quick-carrier-title">
    <div className={styles.top}><span>Apple Carrier Lite</span><strong>{[crypto && base+' crypto',card && formatUsd(guestCardQuote(product.priceCents).totalCents)+' card'].filter(Boolean).join(' / ')} · USD</strong></div>
    <h2 id="quick-carrier-title">Check your iPhone’s carrier and SIM lock</h2>
    <p>See the network policy and lock status reported for your IMEI before choosing an unlock service.</p>
    <ArticleCarrierForm method={card?'card':'crypto'} />
    <small>Already unlocked? You don’t need to buy an unlock. If the report shows a restriction, <Link href="/services/unlock">compare eligible unlock services</Link>.</small>
  </section>
}
