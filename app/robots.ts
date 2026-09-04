import type { MetadataRoute } from 'next'
import { publicOrigin } from '@/lib/site'

/**
 * The workspace and the JSON endpoints are behind a session, so a crawler
 * only ever gets a redirect from them — but saying so keeps them out of the
 * crawl budget and out of the index, and stops an order or invoice URL from
 * being fetched on a whim.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/user/', '/admin', '/api/', '/auth/', '/design-system'] }],
    sitemap: `${publicOrigin()}/sitemap.xml`,
  }
}
