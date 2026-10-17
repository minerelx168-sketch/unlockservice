import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { createWhopCheckout, WhopPaymentError } from '@/lib/whop'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded
  try {
    const topup = await createWhopCheckout(found.user.id,
      typeof body.amountCents === 'number' ? body.amountCents : NaN,
      typeof body.requestKey === 'string' ? body.requestKey : '')
    return NextResponse.json({ success: true, invoiceUrl: `/user/invoice/${topup.invoice_reference}` },
      { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof WhopPaymentError ? error.message : 'Card checkout is temporarily unavailable. Please retry this request.' },
      { status: error instanceof WhopPaymentError ? error.status : 502 })
  }
}
