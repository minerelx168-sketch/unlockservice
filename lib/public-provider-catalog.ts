import { CUSTOMER_IMEI_CHECK_PRODUCTS, CUSTOMER_UNLOCK_PRODUCTS } from './customer-provider-products'
import { listPaidReportProducts } from './paid-reports'
import { hasServiceOutputExample } from './service-output-examples'
import type { ProviderProduct, ProviderProductDomain } from './provider-products'

/** The storefront never needs supplier identifiers or wholesale prices. */
export type PublicProviderProduct = Pick<ProviderProduct,
  'productCode' | 'slug' | 'name' | 'summary' | 'group' | 'domain' |
  'inputType' | 'status' | 'priceCents' | 'etaLabel' | 'sortOrder'
> & { hasExample: boolean }

/** Publish the owner's active products. Transport configuration is checked at
 * checkout, not converted into a misleading prelaunch label on the storefront. */
export function listPublicProviderProducts(domain: ProviderProductDomain): PublicProviderProduct[] {
  const products = domain === 'imei_check' ? CUSTOMER_IMEI_CHECK_PRODUCTS : CUSTOMER_UNLOCK_PRODUCTS
  const orderable = new Map(
    listPaidReportProducts().map((product) => [product.code, product]),
  )
  return products.flatMap((product) => {
    const live = orderable.get(product.productCode)
    if (product.status !== 'available' || !live?.isActive) return []
    return [{
      productCode: product.productCode,
      slug: live.slug,
      name: live.name,
      summary: live.summary,
      group: product.group,
      domain: product.domain,
      inputType: product.inputType,
      status: 'available' as const,
      priceCents: live.priceCents,
      etaLabel: product.etaLabel,
      sortOrder: live.sortOrder,
      hasExample: hasServiceOutputExample(product.productCode),
    }]
  }).sort((left, right) => left.sortOrder - right.sortOrder || left.productCode.localeCompare(right.productCode, 'en'))
}
