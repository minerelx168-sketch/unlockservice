import { getPaidReportProduct } from '../paid-reports'
import { formatUsd } from '../money'
import { p2, type Phase2Key } from '../i18n/phase2'
import type { GeoLocale } from '../geo-locales'

/** CRO-04's four highest-value one-tap picks. A pick whose service is not orderable right now is left out. */
const PICKS: Array<{ code: string; domain: 'unlock' | 'imei_check'; label: Phase2Key }> = [
  { code: 'APPLE_CARRIER_LITE', domain: 'imei_check', label: 'Check locked carrier ({price})' },
  { code: 'UNLOCK_346', domain: 'unlock', label: 'AT&T USA clean unlock ({price})' },
  { code: 'UNLOCK_39', domain: 'unlock', label: 'Telus / Koodo Canada ({price})' },
  { code: 'UNLOCK_36', domain: 'unlock', label: 'Rogers / Fido Canada ({price})' },
]

export function croQuickPills(locale: GeoLocale) {
  return PICKS.flatMap((pick) => {
    const product = getPaidReportProduct(pick.code)
    if (!product?.providerReady || product.priceCents <= 0) return []
    return [{ code: pick.code, domain: pick.domain, label: p2(locale, pick.label, { price: formatUsd(product.priceCents) }) }]
  })
}
