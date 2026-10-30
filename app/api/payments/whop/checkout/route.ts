import { snapshotPaymentAnalytics } from '@/lib/payment-analytics-request'
import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { createWhopCheckout, safeWhopCheckoutUrl, WhopPaymentError } from '@/lib/whop'
import { requestCheckoutReminderOptIn } from '@/lib/checkout-reminders'

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
    if (body.paymentReminderOptIn === true && ['customer','reseller'].includes(found.user.account_type)) {
      try { requestCheckoutReminderOptIn('topup', topup.invoice_reference, found.user.email, found.user.id) }
      catch { console.warn('[checkout-reminders] optional opt-in unavailable') }
    }
    await snapshotPaymentAnalytics(topup.invoice_reference, found.user.id, body.analyticsContext)
    const checkoutUrl = topup.checkout_url && !topup.credited && topup.status !== 'refunded' && !topup.review_reason
      ? safeWhopCheckoutUrl(topup.checkout_url, topup.environment) : null
    return NextResponse.json({ success: true, invoiceUrl: `/user/invoice/${topup.invoice_reference}`, checkoutUrl },
      { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof WhopPaymentError ? error.message : 'Card checkout is temporarily unavailable. Please retry this request.' },
      { status: error instanceof WhopPaymentError ? error.status : 502 })
  }
}
