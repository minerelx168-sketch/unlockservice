import { AVAILABLE_PROVIDER_PRODUCTS, etaMinutesFromLabel } from './provider-products'

export type PaidReportProductSeed = {
  code: string
  slug: string
  name: string
  summary: string
  inputType: 'imei'
  priceCents: number
  providerCostMicros: number
  etaMinutes: number
  isActive: boolean
  sortOrder: number
}

/**
 * Paid-report seeds are generated from the owner-approved Provider catalog.
 *
 * Availability in the canonical catalog means the product has a positive
 * margin, 15-digit IMEI input, a confirmed PHP Instant API service ID, an
 * instant synchronous delivery contract, a stable product code and a
 * service-specific report allowlist. Database activation and Provider mapping
 * remain separate operational gates; code seeding never activates a product.
 */
export const PAID_REPORT_PRODUCTS: PaidReportProductSeed[] = AVAILABLE_PROVIDER_PRODUCTS.map((product) => {
  if (product.inputType !== 'imei' || product.domain !== 'imei_check') {
    throw new Error(`invalid paid report seed: ${product.productCode}`)
  }
  return {
    code: product.productCode,
    slug: product.slug,
    name: product.name,
    summary: product.summary,
    inputType: 'imei',
    priceCents: product.priceCents,
    providerCostMicros: product.providerCostMicros,
    etaMinutes: etaMinutesFromLabel(product.etaLabel),
    isActive: false,
    sortOrder: product.sortOrder,
  }
})
