import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { PaymentError } from '@/lib/payments'
import { pollInvoicePayment } from '@/lib/usdt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The invoice page asks here every few seconds while it waits. Asking also
 * nudges a (throttled) chain scan, so the credit lands while they watch.
 */
export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  const reference = String(body.reference ?? '')
  if (!/^[0-9a-f]{8,64}$/.test(reference)) {
    return NextResponse.json({ success: false, error: 'Missing invoice reference.' }, { status: 400 })
  }

  try {
    return NextResponse.json({ success: true, ...(await pollInvoicePayment(reference, found.user.id)) })
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 404 })
    }
    throw error
  }
}
