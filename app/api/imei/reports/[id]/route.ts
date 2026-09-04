import { NextResponse } from 'next/server'
import { currentSession } from '@/lib/auth'
import { guard } from '@/lib/api'
import { getPaidReport, PaidReportError, pollPaidReport } from '@/lib/paid-reports'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteContext = { params: Promise<{ id: string }> }

function parseOrderId(value: string) {
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

export async function GET(_request: Request, { params }: RouteContext) {
  const found = await currentSession()
  if (!found) return NextResponse.json({ success: false, error: 'Sign in to continue.' }, { status: 401 })
  const id = parseOrderId((await params).id)
  if (!id) return NextResponse.json({ success: false, error: 'Paid report not found.' }, { status: 404 })
  const report = getPaidReport(found.user.id, id)
  if (!report) return NextResponse.json({ success: false, error: 'Paid report not found.' }, { status: 404 })
  return NextResponse.json({ success: true, report })
}

export async function POST(request: Request, { params }: RouteContext) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const id = parseOrderId((await params).id)
  if (!id) return NextResponse.json({ success: false, error: 'Paid report not found.' }, { status: 404 })

  try {
    const payload = await pollPaidReport(guarded.found.user.id, id)
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof PaidReportError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 404 })
    }
    throw error
  }
}
