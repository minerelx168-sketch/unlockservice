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
  const range = normalized.match(/(\d+)\s*-\s*(\d+)\s*(minute|hour|day)/)
  if (range) {
    const maximum = Number(range[2])
    if (range[3] === 'hour') return maximum * 60
    if (range[3] === 'day') return maximum * 24 * 60
    return maximum
  }
  const single = normalized.match(/(\d+)\s*(minute|hour|day)/)
  if (single) {
    const amount = Number(single[1])
    if (single[2] === 'hour') return amount * 60
    if (single[2] === 'day') return amount * 24 * 60
    return amount
  }
  return 24 * 60
}
