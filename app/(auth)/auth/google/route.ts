import { NextResponse } from 'next/server'
import {
  beginGoogleOAuth,
  GOOGLE_OAUTH_COOKIE,
  GOOGLE_OAUTH_COOKIE_MAX_AGE,
} from '@/lib/google-oauth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
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
    response.headers.set('Cache-Control', 'no-store')
    return response
  } catch {
    return NextResponse.redirect(new URL('/login?oauth=unavailable', request.url))
  }
}
