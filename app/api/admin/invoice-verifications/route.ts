import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { hasAdminRole } from '@/lib/auth'
import {
  decideInvoiceVerification,
  PaymentVerificationError,
} from '@/lib/payment-verification'

export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  if (!hasAdminRole(found.user)) {
    return NextResponse.json({ success: false, error: 'Administrator access is required.' }, { status: 403 })
  }

  try {
    const decision = body.decision === 'approve' || body.decision === 'reject' ? body.decision : null
    if (!decision) {
      return NextResponse.json({ success: false, error: 'Choose approve or reject.' }, { status: 400 })
    }
    const result = decideInvoiceVerification(found.user.id, {
      invoiceReference: String(body.invoiceReference ?? ''),
      decision,
      reason: String(body.reason ?? ''),
      idempotencyKey: String(body.idempotencyKey ?? ''),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof PaymentVerificationError) {
      const status =
        error.code === 'forbidden'
          ? 403
          : error.code === 'not_found'
            ? 404
            : error.code === 'rate_limited'
              ? 429
              : ['idempotency_conflict', 'invalid_state', 'duplicate_transaction'].includes(error.code)
                ? 409
                : 400
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    throw error
  }
}
