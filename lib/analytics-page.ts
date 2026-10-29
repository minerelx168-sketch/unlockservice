export type AnalyticsPage = {
  page_location: string
  page_referrer: string
  page_title: string
  campaign_source?: string
  campaign_medium?: string
  campaign_name?: string
  campaign_id?: string
  campaign_content?: string
}

/**
 * Pure and self-contained: the root tag embeds this same function before its
 * existing initial page view. Never include raw query strings, private paths,
 * free-text search terms or identifier-shaped campaign values.
 */
export function safeAnalyticsPage(href: string, referrer: string): AnalyticsPage {
  const result: AnalyticsPage = { page_location: 'https://iunlockmobile.com/', page_referrer: '', page_title: 'iUnlockMobile' }
  try {
    const current = new URL(href)
    const host = current.hostname.toLowerCase().replace(/\.$/, '')
    if (!['http:', 'https:'].includes(current.protocol) || !['iunlockmobile.com', 'www.iunlockmobile.com'].includes(host)) return result
    const privatePath = ['user', 'admin', 'api', 'checkout'].includes(current.pathname.split('/')[1])
    const path = privatePath ? '/account'
      : /^\/[a-z0-9/_-]*$/i.test(current.pathname) && !/\d{13,}|[a-f0-9]{32,}/i.test(current.pathname) ? current.pathname : '/'
    result.page_location = current.origin + path
    const fields = { utm_source: 'campaign_source', utm_medium: 'campaign_medium', utm_campaign: 'campaign_name', utm_id: 'campaign_id', utm_content: 'campaign_content' } as const
    for (const [query, field] of Object.entries(fields)) {
      const value = current.searchParams.get(query)
      // Campaign owners should use nonpersonal labels, e.g. autumn-unlock-2026.
      if (value && /^[a-z0-9][a-z0-9_.-]{0,79}$/i.test(value) && !/\d{13,}|[a-f0-9]{32,}/i.test(value.replace(/[_.-]/g, ''))) result[field] = value
    }
    if (referrer) {
      const source = new URL(referrer)
      const sourceHost = source.hostname.toLowerCase().replace(/\.$/, '')
      if (['http:', 'https:'].includes(source.protocol) && !source.username && !source.password
          && /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(sourceHost)
          && !['iunlockmobile.com', 'www.iunlockmobile.com', 'accounts.google.com', 'tagassistant.google.com', 'whop.com', 'checkout.whop.com'].includes(sourceHost)) result.page_referrer = source.origin
    }
  } catch { /* Malformed input cannot break a page or enter analytics. */ }
  return result
}
