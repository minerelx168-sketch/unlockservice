import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { ChainError } from '@/lib/bsc'
import { PaymentError } from '@/lib/payments'
import { claimTransfer } from '@/lib/usdt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** The fallback: the customer points at a transfer and the chain is asked about it now. */
export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  try {
    const result = await claimTransfer(String(body.reference ?? ''), found.user.id, String(body.txHash ?? ''))
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    if (error instanceof ChainError) {
      console.error('[usdt] claim lookup failed', error.message)
      return NextResponse.json(
        { success: false, error: 'We could not reach BNB Smart Chain just now. Try again in a minute.' },
        { status: 503 },
      )
    }
    throw error
  }
}
