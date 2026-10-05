import catalog from '@/catalog/provider-products.json'

export type ProviderProductDomain = 'imei_check' | 'unlock'
export type ProviderProductInput = 'imei' | 'serial_or_imei' | 'phone'
export type ProviderProductStatus = 'available' | 'coming_soon' | 'hidden_reprice' | 'hidden_restricted'

export type ProviderProduct = {
  serviceId: string
  productCode: string
  slug: string
  name: string
  summary: string
  group: string
  domain: ProviderProductDomain
  inputType: ProviderProductInput
  status: ProviderProductStatus
  priceCents: number
  providerCostMicros: number
  etaLabel: string
  sortOrder: number
}

export const PROVIDER_PRODUCT_CATALOG_VERSION = catalog.version
export const PROVIDER_PRODUCTS = catalog.products as ProviderProduct[]
export const PUBLIC_PROVIDER_PRODUCTS = PROVIDER_PRODUCTS.filter(
  (product) => product.status === 'available' || product.status === 'coming_soon',
)
export const AVAILABLE_PROVIDER_PRODUCTS = PROVIDER_PRODUCTS.filter(
  (product) => product.status === 'available',
)
export const COMING_SOON_PROVIDER_PRODUCTS = PROVIDER_PRODUCTS.filter(
  (product) => product.status === 'coming_soon',
)
export const REPRICE_PROVIDER_PRODUCTS = PROVIDER_PRODUCTS.filter(
  (product) => product.status === 'hidden_reprice',
)
export const RESTRICTED_PROVIDER_PRODUCTS = PROVIDER_PRODUCTS.filter(
  (product) => product.status === 'hidden_restricted',
)

const BY_CODE = new Map(PROVIDER_PRODUCTS.map((product) => [product.productCode, product]))

export function providerProductByCode(code: string) {
  return BY_CODE.get(code)
}

export function etaMinutesFromLabel(label: string) {
  const normalized = label.trim().toLowerCase()
  if (normalized === 'instant') return 1

  const values = [...normalized.matchAll(
    /(\d+(?:\.\d+)?)\s*(seconds?|secs?|minutes?|mins?|hours?|hrs?|days?|weeks?)/g,
  )].map((match) => {
    const amount = Number(match[1])
    const unit = match[2]
    if (unit.startsWith('sec')) return amount / 60
    if (unit.startsWith('hour') || unit.startsWith('hr')) return amount * 60
    if (unit.startsWith('day')) return amount * 24 * 60
    if (unit.startsWith('week')) return amount * 7 * 24 * 60
    return amount
  })

  if (values.length > 0) return Math.max(1, Math.ceil(Math.max(...values)))
  return normalized.includes('instant') ? 1 : 24 * 60
}
