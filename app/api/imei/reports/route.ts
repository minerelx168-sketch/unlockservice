import { NextResponse } from 'next/server'
import { currentSession } from '@/lib/auth'
import { guard } from '@/lib/api'
import { createPaidReport, listPaidReports, PaidReportError } from '@/lib/paid-reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const found = await currentSession()
  if (!found) return NextResponse.json({ success: false, error: 'Sign in to continue.' }, { status: 401 })
  return NextResponse.json({ success: true, reports: listPaidReports(found.user.id) })
}

export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  try {
    const payload = await createPaidReport(found.user.id, {
      productCode: String(body.productCode ?? ''),
      imei: String(body.imei ?? ''),
      idempotencyKey: String(body.idempotencyKey ?? ''),
    })
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof PaidReportError) {
      const status =
        error.code === 'insufficient_credit'
          ? 402
          : error.code === 'rate_limited'
            ? 429
            : error.code === 'provider_not_ready'
              ? 503
              : error.code === 'idempotency_conflict'
                ? 409
                : error.code === 'product_unknown' || error.code === 'product_inactive'
                  ? 404
                  : 422
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    throw error
  }
}
