import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { AuthError, createSession, SESSION_COOKIE, sessionCookieOptions } from '@/lib/auth'
import { completeGoogleOAuth, GOOGLE_OAUTH_COOKIE, googleOAuthPublicUrl } from '@/lib/google-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function redirectTo(path: string) {
  const response = NextResponse.redirect(googleOAuthPublicUrl(path))
  response.cookies.delete(GOOGLE_OAUTH_COOKIE)
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const providerError = url.searchParams.get('error')
  if (providerError) {
    return redirectTo(providerError === 'access_denied' ? '/login?oauth=cancelled' : '/login?oauth=failed')
  }

  const state = url.searchParams.get('state') ?? ''
  const code = url.searchParams.get('code') ?? ''
  const transactionId = (await cookies()).get(GOOGLE_OAUTH_COOKIE)?.value ?? ''

  try {
    const user = await completeGoogleOAuth(transactionId, state, code)
    const session = createSession(user.id)
    const response = redirectTo('/user/unlock')
    response.cookies.set(SESSION_COOKIE, session.id, sessionCookieOptions())
    return response
  } catch (error) {
    if (!(error instanceof AuthError)) console.error('[google-oauth] callback failed')
    return redirectTo('/login?oauth=failed')
  }
}
