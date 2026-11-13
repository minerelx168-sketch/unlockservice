import { getPaidReportProduct } from './paid-reports'
import { buildFeedRows, feedEntry, publicFeedProduct, itemIdFor, productCardPath, feedPrice, type LiveResolver, type FeedRow } from './acp-feed'
import { publicOrigin } from './site'

/** Same gate as checkout: active, provider-ready, priced. */
export const liveResolver: LiveResolver = (code) => {
  const product = getPaidReportProduct(code)
  return product ? { priceCents: product.priceCents, orderable: product.isActive && product.providerReady } : null
}

export function liveFeedRows(): FeedRow[] {
  return buildFeedRows(publicOrigin(), liveResolver)
}

/** Product + Offer + MerchantReturnPolicy nodes for the given services; sku equals the feed item_id. */
export function productSchemaNodes(serviceIds: string[], pageUrl: string) {
  const origin = publicOrigin()
  return serviceIds.flatMap((serviceId) => {
    const found = publicFeedProduct(serviceId, liveResolver)
    const entry = feedEntry(serviceId)
    if (!found || !entry) return []
    return [{
      '@type': 'Product', '@id': `${pageUrl}#${itemIdFor(serviceId)}`,
      sku: itemIdFor(serviceId), name: entry.title, description: entry.description,
      image: origin + productCardPath(serviceId),
      brand: { '@type': 'Brand', name: 'iUnlockMobile' },
      offers: {
        '@type': 'Offer', url: pageUrl, price: feedPrice(found.offer.priceCents).split(' ')[0], priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
        seller: { '@type': 'Organization', name: 'iUnlockMobile', url: origin },
        hasMerchantReturnPolicy: merchantReturnPolicy(origin),
      },
    }]
  })
}

/**
 * A digital service cannot be "returned"; what the terms promise is a full
 * refund to the original card when we cannot deliver (including a carrier
 * refusal). Completed services are not refundable, which is why the category
 * is MerchantReturnNotPermitted while refundType states the undelivered case.
 */
export function merchantReturnPolicy(origin: string) {
  return {
    '@type': 'MerchantReturnPolicy',
    applicableCountry: ['US', 'CA', 'GB', 'JP', 'AT', 'MX', 'BR', 'DE'],
    returnPolicyCategory: 'https://schema.org/MerchantReturnNotPermitted',
    refundType: 'https://schema.org/FullRefund',
    returnFees: 'https://schema.org/FreeReturn',
    merchantReturnLink: `${origin}/terms#refunds`,
    description: 'Digital service: if we cannot deliver it, including when the carrier refuses an unlock request, a direct card order is refunded in full to the original payment method, card fee included. Completed services are not refundable.',
  }
}
