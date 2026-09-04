import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { hasAdminRole } from '@/lib/auth'
import {
  adjustUserCredit,
  AdminCreditAdjustmentError,
} from '@/lib/admin-credit-adjustments'

export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  if (!hasAdminRole(found.user)) {
    return NextResponse.json({ success: false, error: 'Administrator access is required.' }, { status: 403 })
  }

  try {
    const result = adjustUserCredit(found.user.id, {
      targetUserId: Number(body.targetUserId),
      amountCents: Number(body.amountCents),
      reason: String(body.reason ?? ''),
      idempotencyKey: String(body.idempotencyKey ?? ''),
    })
    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof AdminCreditAdjustmentError) {
      const status =
        error.code === 'forbidden'
          ? 403
          : error.code === 'user_not_found'
            ? 404
            : error.code === 'rate_limited'
              ? 429
              : error.code === 'held_credit_conflict' || error.code === 'idempotency_conflict'
                ? 409
                : 400
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    throw error
  }
}
