import margins from '@/catalog/service-margins.json'
import { PROVIDER_PRODUCTS } from './provider-products'

/**
 * Gross margin per provider service, from the owner's price sheet
 * (catalog/service-margins.json, cost before payment fees).
 *
 * The conversion value is the price actually charged for the service,
 * excluding card fees and tax, minus the sheet cost. For a retail sale that
 * equals the sheet's gross_margin_usd; a reseller price is lower, so its
 * margin is lower too instead of being overstated.
 */
type MarginEntry = { name: string; category: string; cost_usd: number; retail_usd: number; gross_margin_usd: number }
const SHEET = (margins as { services: Record<string, MarginEntry> }).services
const CODE_TO_SERVICE = new Map(PROVIDER_PRODUCTS.map((product) => [product.productCode, product]))

export type ServiceRef = { serviceId: string | null; name: string; category: string }

export function serviceForCode(productCode: string | null | undefined, fallbackName = 'Device service'): ServiceRef {
  const product = productCode ? CODE_TO_SERVICE.get(productCode) : undefined
  const serviceId = product?.serviceId ?? productCode?.match(/_(\d{1,6})$/)?.[1] ?? null
  const sheet = serviceId ? SHEET[serviceId] : undefined
  return { serviceId, name: product?.name ?? sheet?.name ?? fallbackName, category: product?.group ?? sheet?.category ?? 'Device services' }
}

export function serviceForProviderId(serviceId: string | null | undefined, fallbackName = 'Device service'): ServiceRef {
  const id = serviceId && /^\d{1,6}$/.test(serviceId) ? serviceId : null
  const product = id ? PROVIDER_PRODUCTS.find((entry) => entry.serviceId === id) : undefined
  const sheet = id ? SHEET[id] : undefined
  return { serviceId: id, name: product?.name ?? sheet?.name ?? fallbackName, category: product?.group ?? sheet?.category ?? 'Device services' }
}

/** Cost in cents, rounded up so a margin is never overstated. Null when unknown. */
export function serviceCostCents(serviceId: string | null): number | null {
  if (!serviceId) return null
  const sheet = SHEET[serviceId]
  if (sheet && Number.isFinite(sheet.cost_usd) && sheet.cost_usd >= 0) return Math.ceil(Math.round(sheet.cost_usd * 1e6) / 1e4)
  const product = PROVIDER_PRODUCTS.find((entry) => entry.serviceId === serviceId)
  if (product && Number.isSafeInteger(product.providerCostMicros) && product.providerCostMicros > 0) return Math.ceil(product.providerCostMicros / 10_000)
  return null
}

/** Margin for one sold service. Unknown cost sends 0 (never revenue) and is flagged margin_unknown. */
export function marginCents(serviceId: string | null, netPriceCents: number): { valueCents: number; known: boolean } {
  const cost = serviceCostCents(serviceId)
  if (cost === null) return { valueCents: 0, known: false }
  return { valueCents: Math.max(0, netPriceCents - cost), known: true }
}
