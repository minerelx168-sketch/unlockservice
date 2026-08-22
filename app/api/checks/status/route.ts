import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { CheckError, pollCheck } from '@/lib/checks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Polls an order the provider accepted but has not answered yet. */
export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  const logId = Number(body.logId)
  if (!Number.isInteger(logId)) {
    return NextResponse.json({ success: false, error: 'Missing order id.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await pollCheck(found.user.id, logId))
  } catch (error) {
    if (error instanceof CheckError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 })
    }
    throw error
  }
}
