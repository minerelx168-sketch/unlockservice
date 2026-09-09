/** Public navigation intent only. Never carry IMEI, credentials or arbitrary URLs. */
export function safeContinuation(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 512 || !value.startsWith('/') || value.startsWith('//') || /[\\\s#]/.test(value)) return null
  const url = new URL(value, 'https://continuation.invalid')
  if (url.origin !== 'https://continuation.invalid') return null
  const allowed = /^\/(?:check|user\/(?:dashboard|check|services\/unlock|unlock|payments|add-funds|orders(?:\/[1-9]\d*)?|checks(?:\/[1-9]\d*)?|reports(?:\/new|\/[1-9]\d*)?|invoice\/[a-f0-9]{32}))$/
  if (!allowed.test(url.pathname)) return null
  const product = url.searchParams.get('product')
  if (['/user/reports/new', '/user/add-funds'].includes(url.pathname) && product && /^[A-Z0-9_]{2,64}$/.test(product)) {
    return `${url.pathname}?product=${encodeURIComponent(product)}`
  }
  if (url.pathname.startsWith('/user/invoice/')) {
    const next = url.searchParams.get('next')
    const report = next?.startsWith('/user/reports/new') ? safeContinuation(next) : null
    if (report) return `${url.pathname}?next=${encodeURIComponent(report)}`
  }
  return url.pathname
}

export function withContinuation(path: string, value: unknown): string {
  const next = safeContinuation(value)
  return next ? `${path}${path.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}` : path
}
