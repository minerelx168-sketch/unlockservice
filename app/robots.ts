import type { MetadataRoute } from 'next'
import { publicOrigin } from '@/lib/site'

/**
 * Reduce crawling of account and API routes. These directives are not access
 * control and do not guarantee exclusion from search results. The unlock
 * catalog deliberately remains crawlable so its noindex header can be read;
 * its server-side IMEI step applies equally to every visitor.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/user/', '/admin', '/api/', '/auth/', '/design-system'] }],
    sitemap: `${publicOrigin()}/sitemap.xml`,
  }
}
