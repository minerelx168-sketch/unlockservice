import { NextResponse } from 'next/server'
import { currentSession } from './auth'

/**
 * Shared guard for the JSON endpoints: resolve the session, then check the
 * CSRF token that was minted with it. Both endpoints are called from the
 * page's own script, so a same-origin session cookie plus a matching token
 * is the whole contract.
 */

export type Guarded = Awaited<ReturnType<typeof currentSession>>

export async function guard(request: Request) {
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
