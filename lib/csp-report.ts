const allowedOrigins = new Set([
  'https://www.googletagmanager.com', 'https://www.googleadservices.com',
  'https://www.google.com', 'https://analytics.google.com',
  'https://googleads.g.doubleclick.net', 'https://stats.g.doubleclick.net',
  'https://ad.doubleclick.net', 'https://pagead2.googlesyndication.com',
])
const allowedDirectives = new Set(['connect-src', 'img-src', 'script-src', 'script-src-elem', 'frame-src'])
export function summarizeCspReport(input: unknown): { directive: string; blockedOrigin: string } | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null
  const report = (input as Record<string, unknown>)['csp-report']
  if (!report || typeof report !== 'object' || Array.isArray(report)) return null
  const data = report as Record<string, unknown>
  const directive = data['effective-directive']
  if (typeof directive !== 'string' || !allowedDirectives.has(directive)) return null
  if (typeof data['document-uri'] !== 'string' || typeof data['blocked-uri'] !== 'string') return null
  try {
    const document = new URL(data['document-uri'])
    const blocked = new URL(data['blocked-uri'])
    if (document.protocol !== 'https:' || !['iunlockmobile.com', 'www.iunlockmobile.com'].includes(document.hostname)) return null
    if (blocked.protocol !== 'https:' || blocked.port || blocked.username || blocked.password) return null
    const analyticsCollector = blocked.hostname.endsWith('.google-analytics.com') || blocked.hostname.endsWith('.analytics.google.com')
    if (!allowedOrigins.has(blocked.origin) && !analyticsCollector) return null
    // Never retain page paths, query strings, identifiers, script samples or referrers.
    return { directive, blockedOrigin: blocked.origin }
  } catch { return null }
}
