/** Fixed page categories only: never store query strings or customer/order identifiers. */
export const ENGAGEMENT_PAGES = ['/', '/services/unlock', '/services/imei-check', '/contact', '/pricing', '/articles', '/articles/detail', '/unlock/service', '/account/dashboard', '/account/check', '/account/services', '/account/orders', '/account/reports', '/account/free-checks', '/account/add-funds', '/account/payments', '/account/payment-details', '/account/order-details'] as const
export function engagementPage(path: string): string | null {
  const clean = path.split(/[?#]/,1)[0]
  const exact: Record<string,string> = { '/user/dashboard':'/account/dashboard','/user/check':'/account/check','/user/services/unlock':'/account/services','/user/orders':'/account/orders','/user/reports':'/account/reports','/user/reports/new':'/account/services','/user/checks':'/account/free-checks','/user/add-funds':'/account/add-funds','/user/payments':'/account/payments' }
  if (exact[clean]) return exact[clean]
  if (clean.startsWith('/user/invoice/')) return '/account/payment-details'
  if (clean.startsWith('/user/orders/') || clean.startsWith('/user/reports/')) return '/account/order-details'
  if (clean.startsWith('/articles/')) return '/articles/detail'
  if (clean.startsWith('/unlock/')) return '/unlock/service'
  return ['/', '/services/unlock','/services/imei-check','/contact','/pricing','/articles'].includes(clean) ? clean : null
}
export function activeTimeIncrement(delta: number, visible: boolean, focused: boolean, idleMs: number) {
  return visible && focused && idleMs < 60_000 ? Math.max(0,Math.min(delta,5_000)) : 0
}
