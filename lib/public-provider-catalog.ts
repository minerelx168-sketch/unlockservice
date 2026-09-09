import { CUSTOMER_IMEI_CHECK_PRODUCTS, CUSTOMER_UNLOCK_PRODUCTS } from './customer-provider-products'
import { listPaidReportProducts } from './paid-reports'
import { hasServiceOutputExample } from './service-output-examples'
import type { ProviderProduct, ProviderProductDomain } from './provider-products'

/** The storefront never needs supplier identifiers or wholesale prices. */
export type PublicProviderProduct = Pick<ProviderProduct,
  'productCode' | 'slug' | 'name' | 'summary' | 'group' | 'domain' |
  'inputType' | 'status' | 'priceCents' | 'etaLabel' | 'sortOrder'
> & { hasExample: boolean }

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
