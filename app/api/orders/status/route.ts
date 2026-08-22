import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { OrderError, pollOrder } from '@/lib/orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Checks in on an order the supplier has accepted but not yet delivered. */
export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  const orderId = Number(body.orderId)
  if (!Number.isInteger(orderId)) {
    return NextResponse.json({ success: false, error: 'Missing order id.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await pollOrder(found.user.id, orderId))
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 })
    }
    throw error
  }
}
