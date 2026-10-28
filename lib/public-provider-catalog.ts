import directory from '@/catalog/storefront-service-directory.json'
import { serviceGroupLabel } from './service-groups'
import { CUSTOMER_IMEI_CHECK_PRODUCTS, CUSTOMER_UNLOCK_PRODUCTS } from './customer-provider-products'
import { getPaidReportProduct, listPaidReportProducts } from './paid-reports'
import { hasServiceOutputExample } from './service-output-examples'
import { PROVIDER_PRODUCTS, type ProviderProduct, type ProviderProductDomain } from './provider-products'

/** The storefront never needs supplier identifiers or wholesale prices. */
export type PublicProviderProduct = Pick<ProviderProduct,
  'productCode' | 'slug' | 'name' | 'summary' | 'group' | 'domain' |
  'inputType' | 'status' | 'priceCents' | 'etaLabel' | 'sortOrder'
> & { hasExample: boolean; priceAvailable?: boolean }

/** Resolve availability and retail prices from the same gates as checkout. */
export function listPublicProviderProducts(domain: ProviderProductDomain): PublicProviderProduct[] {
  const products = domain === 'imei_check' ? CUSTOMER_IMEI_CHECK_PRODUCTS : CUSTOMER_UNLOCK_PRODUCTS
  const orderable = new Map(
    listPaidReportProducts().map((product) => [product.code, product]),
  )
  return products.map((product) => {
    const live = orderable.get(product.productCode)
    return {
      productCode: product.productCode,
      slug: product.slug,
      name: product.name,
      summary: product.summary,
      group: product.group,
      domain: product.domain,
      inputType: product.inputType,
      status: product.status === 'available' && live?.providerReady ? 'available' : 'coming_soon',
      priceCents: live?.priceCents ?? product.priceCents,
      etaLabel: product.etaLabel,
      sortOrder: product.sortOrder,
      hasExample: hasServiceOutputExample(product.productCode),
    }
  })
}

/**
 * All supplier-listed names and groups, using only our own selling prices.
 * Listing a service never enables a provider mapping, a new input flow or payment.
 * Newly listed services without a retail price remain view-only, with no invented quote.
 */
export function listStorefrontProviderProducts(domain: ProviderProductDomain): PublicProviderProduct[] {
  const byId = new Map(PROVIDER_PRODUCTS.map((product) => [product.serviceId, product]))
  return directory.services.filter((entry) => entry.domain === domain).map((entry) => {
    const configured = byId.get(entry.serviceId)
    const productCode = configured?.productCode ?? `${domain === 'unlock' ? 'UNLOCK' : 'CHECK'}_${entry.serviceId}`
    const live = getPaidReportProduct(productCode)
    const retail = live?.priceCents ?? configured?.priceCents
    const priceAvailable = typeof retail === 'number' && retail > 0
    return {
      productCode,
      slug: configured?.slug ?? productCode.toLowerCase().replaceAll('_', '-'),
      name: serviceGroupLabel(entry.name),
      summary: configured?.summary ?? 'Contact us to confirm the requirements, price and delivery time for this service.',
      group: serviceGroupLabel(entry.group),
      // Display section is separate from the existing processing and billing domain.
      domain: configured?.domain ?? domain,
      inputType: configured?.inputType ?? 'imei',
      status: configured?.status === 'available' && live?.providerReady && priceAvailable ? 'available' : 'coming_soon',
      priceCents: priceAvailable ? retail : 0,
      priceAvailable,
      etaLabel: configured?.etaLabel ?? 'Confirm with support',
      sortOrder: entry.sortOrder,
      hasExample: hasServiceOutputExample(productCode),
    }
  })
}
