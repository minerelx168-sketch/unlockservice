import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { AuthError, createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { completeGoogleOAuth, GOOGLE_OAUTH_COOKIE, googleOAuthPublicUrl } from '@/lib/google-oauth'
import { GOOGLE_RETURN_COOKIE } from '@/lib/cookie-names'
import { safeContinuation, withContinuation } from '@/lib/continuation'
import { landingRoute } from '@/lib/provider'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function redirectTo(path: string) {
  const response = NextResponse.redirect(googleOAuthPublicUrl(path))
  for (const name of [GOOGLE_OAUTH_COOKIE, GOOGLE_RETURN_COOKIE]) {
    response.cookies.set(name, '', { path: '/auth/google', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' })
  }
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const jar = await cookies()
  const returnTo = safeContinuation(jar.get(GOOGLE_RETURN_COOKIE)?.value)
  const providerError = url.searchParams.get('error')
  if (providerError) {
    return redirectTo(withContinuation(providerError === 'access_denied' ? '/login?oauth=cancelled' : '/login?oauth=failed', returnTo))
  }

  const state = url.searchParams.get('state') ?? ''
  const code = url.searchParams.get('code') ?? ''
  const transactionId = jar.get(GOOGLE_OAUTH_COOKIE)?.value ?? ''

  try {
    const user = await completeGoogleOAuth(transactionId, state, code)
    const session = createSession(user.id)
    const response = redirectTo(returnTo ?? landingRoute())
    response.cookies.set(SESSION_COOKIE, session.id, sessionCookieOptions())
    return response
  } catch (error) {
    if (!(error instanceof AuthError)) console.error('[google-oauth] callback failed')
    return redirectTo(withContinuation('/login?oauth=failed', returnTo))
  }
}
