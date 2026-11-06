import type { PublicProviderProduct } from './public-provider-catalog'
import type { ServiceSpoke } from './service-spokes'
import { guestCardQuote } from './guest-card-quote'

/** Only publish offers for services that checkout can currently accept. */
export function serviceSpokeSchema(spoke: ServiceSpoke, products: PublicProviderProduct[], origin: string) {
  const url = origin + spoke.path
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Services', item: origin + '/services' },
          { '@type': 'ListItem', position: 2, name: spoke.hubTitle, item: origin + spoke.hub },
          { '@type': 'ListItem', position: 3, name: spoke.title, item: url },
        ],
      },
      ...products.map(product => ({
        '@type': 'Service',
        '@id': url + '#' + product.productCode,
        name: product.name,
        url,
        description: product.summary,
        provider: { '@type': 'Organization', name: 'iUnlockMobile', url: origin },
        ...(product.status === 'available' && product.priceAvailable ? {
          offers: {
            '@type': 'Offer',
            url: url + '#order',
            price: (guestCardQuote(product.priceCents).totalCents / 100).toFixed(2),
            priceCurrency: 'USD',
            description: 'Direct card total including the current card fee. Other payment methods are shown before payment.',
          },
        } : {}),
      })),
    ],
  }
}

/** Keep catalog text from closing the JSON-LD script element. */
export function serializeServiceSchema(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c')
}
