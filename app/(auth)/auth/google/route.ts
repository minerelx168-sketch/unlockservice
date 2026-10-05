import { NextResponse } from 'next/server'
import { GOOGLE_RETURN_COOKIE } from '@/lib/cookie-names'
import { safeContinuation, withContinuation } from '@/lib/continuation'
import {
  beginGoogleOAuth,
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_COOKIE_MAX_AGE,
} from '@/lib/google-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  const returnTo = safeContinuation(new URL(request.url).searchParams.get('next'))
  try {
    const { authorizationUrl, transactionId } = beginGoogleOAuth()
    const response = NextResponse.redirect(authorizationUrl)
    response.cookies.set(GOOGLE_OAUTH_COOKIE, transactionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/auth/google',
      maxAge: GOOGLE_OAUTH_COOKIE_MAX_AGE,
    })
    response.cookies.set(GOOGLE_RETURN_COOKIE, returnTo ?? '', {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/auth/google',
      maxAge: returnTo ? GOOGLE_OAUTH_COOKIE_MAX_AGE : 0,
    })
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch {
    return NextResponse.redirect(new URL(withContinuation('/login?oauth=unavailable', returnTo), request.url))
  }
}
