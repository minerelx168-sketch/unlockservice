import { listPublicProviderProducts } from './public-provider-catalog'
import type { ProviderProductDomain } from './provider-products'

/** Customer catalog readiness; never opens the separate legacy order API. */
export function storefrontAvailability(domain: ProviderProductDomain) {
  const products = listPublicProviderProducts(domain)
  const availableCount = products.filter((product) => product.status === 'available').length
  return { publishedCount: products.length, availableCount, accepting: availableCount > 0 }
}
