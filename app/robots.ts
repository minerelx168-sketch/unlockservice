import type { MetadataRoute } from 'next'
import { publicOrigin } from '@/lib/site'

/** Search and assistant crawlers that must always reach the public site. */
export const AI_CRAWLERS = [
  'OAI-SearchBot', 'ChatGPT-User', 'GPTBot',
  'PerplexityBot', 'Perplexity-User',
  'ClaudeBot', 'Claude-SearchBot', 'Claude-User',
  'Googlebot', 'Google-Extended', 'Applebot', 'bingbot',
] as const

/** Public machine-readable surfaces under /api that crawlers and agents may read. */
export const PUBLIC_ALLOW = ['/', '/llms.txt', '/llms-full.txt', '/openapi.json', '/api/agent/', '/api/mcp$', '/tools/', '/reports/', '/articles/', '/services/', '/check/', '/feeds/', '/api/product-card/']

/**
 * Reduce crawling of account, admin and transactional routes. These directives
 * are not access control and do not guarantee exclusion from search results.
 * The unlock catalog deliberately remains crawlable so its noindex header can
 * be read; its server-side IMEI step applies equally to every visitor.
 */
export const PRIVATE_DISALLOW = [
  '/api/', '/api/user/', '/api/admin/', '/api/checkout/', '/api/payments/', '/api/webhooks/', '/api/orders/', '/api/imei/', '/api/reseller/',
  '/user/', '/admin', '/auth/', '/account', '/checkout', '/order/',
  '/login', '/register', '/forgot-password', '/reset-password', '/verify-email', '/design-system',
]

export default function robots(): MetadataRoute.Robots {
  return {
    rules: (['*', ...AI_CRAWLERS] as string[]).map(userAgent => ({ userAgent, allow: PUBLIC_ALLOW, disallow: PRIVATE_DISALLOW })),
    sitemap: [`${publicOrigin()}/sitemap.xml`, `${publicOrigin()}/sitemap-models.xml`],
  }
}
