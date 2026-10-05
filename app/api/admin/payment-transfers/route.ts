import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { hasAdminRole } from '@/lib/auth'
import { PaymentVerificationError } from '@/lib/payment-verification'
import { dismissTransfer } from '@/lib/payment-watcher'

/** An administrator closes a transfer that found no payment request (a refund, a test). */
export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  if (!hasAdminRole(found.user)) {
    return NextResponse.json({ success: false, error: 'Administrator access is required.' }, { status: 403 })
  }

  try {
    dismissTransfer(Number(body.transferId), String(body.reason ?? ''))
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 })
    }
    throw error
  }
}
