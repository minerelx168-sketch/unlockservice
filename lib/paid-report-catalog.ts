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
 * live margin, 15-digit IMEI input, an exact Provider service ID, a verified
 * PHP or DHRU transport, and a stable product code. Database activation and
 * Provider mapping remain separate operational gates; code seeding never
 * activates a product.
 */
export const PAID_REPORT_PRODUCTS: PaidReportProductSeed[] = AVAILABLE_PROVIDER_PRODUCTS.map((product) => {
  if (product.inputType !== 'imei') {
    throw new Error(`invalid paid service seed: ${product.productCode}`)
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
