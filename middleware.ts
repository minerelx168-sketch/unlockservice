import { NextResponse, type NextRequest } from 'next/server'
import { QUOTE_COOKIE } from '@/lib/cookie-names'

/**
 * Content-Security-Policy.
 *
 * The workspace writes its CSRF token into the DOM so the page's own script
 * can read it before a poll, which is the shape the backend reference set.
 * That is only safe while nothing else can run on the page, and a policy is
 * the thing that makes that true — so this is the other half of that design,
 * not an ornament on top of it.
 *
 * It has to be a nonce rather than a set of hashes: the App Router streams
 * its flight payload through inline script tags whose contents differ per
 * request. Next.js picks the nonce up off this header on its own and stamps
 * it onto those tags; the theme guard in the root layout takes it by hand.
 *
 * Reading the nonce in the root layout opts every page into dynamic
 * rendering. Nothing here is served through a CDN — Caddy proxies straight
 * to the Node process — so what that costs is a render per request on the
 * two pages that were static, and what it buys is a page where an injected
 * script cannot execute.
 */
function policy(nonce: string, secure: boolean): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // The development bundler compiles with eval; production never does.
    process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : '',
  ].filter(Boolean)

  return [
    "default-src 'self'",
    `script-src ${scriptSrc.join(' ')}`,
    // Server-rendered style attributes are inline by definition, and every
    // colour in them resolves to a token rather than arriving from a request.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "object-src 'none'",
    /* Only where the page already arrived over TLS. On a plain-http local
       rehearsal it would rewrite same-origin navigations to https and the
       browser would then refuse its own site. */
    secure ? 'upgrade-insecure-requests' : '',
  ]
    .filter(Boolean)
    .join('; ')
}

export function middleware(request: NextRequest) {
  const nonce = crypto.randomUUID().replaceAll('-', '')
  const forwardedProtocol = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  const secure = (forwardedProtocol ?? request.nextUrl.protocol.replace(':', '')) === 'https'
  const csp = policy(nonce, secure)

  const headers = new Headers(request.headers)
  headers.set('x-nonce', nonce)
  headers.set('content-security-policy', csp)

  const response = NextResponse.next({ request: { headers } })
  response.headers.set('content-security-policy', csp)

  /* The homepage quote is dropped as soon as the visitor is somewhere that
     does not need it. It cannot be dropped by the order form itself: a
     render is not allowed to write cookies, and clearing it here on that
     request would take it out of the request forwarded downstream too, so
     the form would never see the quote it is being handed. Anywhere else in
     the workspace is past the hand-off, and clearing it there means the
     order form starts clean the next time it is opened. */
  const path = request.nextUrl.pathname
  if (path !== '/user/unlock' && path.startsWith('/user/') && request.cookies.has(QUOTE_COOKIE)) {
    response.cookies.set(QUOTE_COOKIE, '', { path: '/', maxAge: 0, httpOnly: true, secure })
  }

  return response
}

export const config = {
  matcher: [
    /* Everything a browser renders. Static assets carry no script and are
       served straight off disk, so they are left alone. */
    {
      source: '/((?!_next/static|_next/image|fonts/|favicon.ico|icon.svg|logo-mark.svg).*)',
      missing: [{ type: 'header', key: 'next-router-prefetch' }],
    },
  ],
}
