import { NextResponse } from 'next/server'
import { currentSession } from './auth'

/**
 * Shared guard for the JSON endpoints: resolve the session, then check the
 * CSRF token that was minted with it. Both endpoints are called from the
 * page's own script, so a same-origin session cookie plus a matching token
 * is the whole contract.
 */

export type Guarded = Awaited<ReturnType<typeof currentSession>>

/**
 * Browsers send Origin on every POST, so a mismatch is a cross-site call and
 * nothing else. Absence is left to the CSRF token: a non-browser client has
 * no Origin to send, and the token is the control either way — this is the
 * check that does not depend on the token staying out of the page.
 */
function crossOrigin(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false
  const host = request.headers.get('host')
  if (!host) return true
  try {
    return new URL(origin).host !== host
  } catch {
    return true
  }
}

export async function guard(request: Request) {
  if (crossOrigin(request)) {
    return {
      error: NextResponse.json({ success: false, error: 'Cross-site request refused.' }, { status: 403 }),
    }
  }

  const found = await currentSession()
  if (!found) {
    return { error: NextResponse.json({ success: false, error: 'Sign in to continue.' }, { status: 401 }) }
  }

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return { error: NextResponse.json({ success: false, error: 'Malformed request.' }, { status: 400 }) }
  }

  if (body.csrfToken !== found.session.csrfToken) {
    return { error: NextResponse.json({ success: false, error: 'Stale form. Reload and try again.' }, { status: 403 }) }
  }

  return { found, body }
}
