import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { createImeiCheck, ImeiCheckError, listImeiChecks } from '@/lib/imei-checks'
import { FingerprintUnavailable } from '@/lib/imei-privacy'
import { currentSession } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Lists the signed-in user's IMEI checks. */
export async function GET() {
  const found = await currentSession()
  if (!found) return NextResponse.json({ success: false, error: 'Sign in to continue.' }, { status: 401 })
  return NextResponse.json({ success: true, checks: listImeiChecks(found.user.id) })
}

/** Creates a free IMEI report without an invoice or credit movement. */
export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  try {
    const check = await createImeiCheck(found.user.id, {
      imei: String(body.imei ?? ''),
      idempotencyKey: body.idempotencyKey === undefined ? undefined : String(body.idempotencyKey),
    })
    return NextResponse.json({ success: true, check }, { status: 201 })
  } catch (error) {
    /* Not the customer's fault and not fixable by retrying with a different
       IMEI — the service has not been given its fingerprint key. */
    if (error instanceof FingerprintUnavailable) {
      return NextResponse.json(
        { success: false, error: error.message, code: 'provider_not_ready' },
        { status: 503 },
      )
    }
    if (error instanceof ImeiCheckError) {
      const status =
        error.code === 'rate_limited' ? 429 : error.code === 'provider_not_ready' ? 503 : 400
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    throw error
  }
}
