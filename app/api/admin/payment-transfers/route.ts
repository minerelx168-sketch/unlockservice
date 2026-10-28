import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { hasAdminRole } from '@/lib/auth'
import { decideUnmatchedTransfer } from '@/lib/admin-payment-transfers'
import { PaymentVerificationError } from '@/lib/payment-verification'

/** An administrator associates, rejects or dismisses one recorded on-chain transfer. */
export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded
  if (!hasAdminRole(found.user)) {
    return NextResponse.json({ success: false, error: 'Administrator access is required.' }, { status: 403 })
  }
  try {
    const decision = ['confirm', 'reject', 'dismiss'].includes(String(body.decision))
      ? body.decision as 'confirm' | 'reject' | 'dismiss' : null
    if (!decision) return NextResponse.json({ success: false, error: 'Choose a transfer decision.' }, { status: 400 })
    const result = await decideUnmatchedTransfer(found.user.id, {
      transferId: Number(body.transferId),
      invoiceReference: String(body.invoiceReference ?? ''),
      decision,
      reason: String(body.reason ?? ''),
      idempotencyKey: String(body.idempotencyKey ?? ''),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      const status = error.code === 'forbidden' ? 403 : error.code === 'not_found' ? 404
        : error.code === 'rate_limited' ? 429
        : ['invalid_state', 'duplicate_transaction', 'idempotency_conflict'].includes(error.code) ? 409 : 400
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    throw error
  }
}
