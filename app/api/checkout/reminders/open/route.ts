import { NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { cookies } from 'next/headers'
import { currentSession } from '@/lib/auth'
import { readCommandJson } from '@/lib/request-json'
import { publicOrigin } from '@/lib/site'
import { CONSENT_COOKIE } from '@/lib/cookie-names'
import { parseSignedConsent } from '@/lib/order-attribution'
import { recordCheckoutReminderOpened, type CheckoutReminderKind } from '@/lib/checkout-reminders'
import { consumeAttempt } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const REFERENCE = /^[a-f0-9]{32}$/

function reply(body: unknown, status = 200) {
  if (status === 204) return new NextResponse(null, { status, headers: { 'Cache-Control': 'private, no-store' } })
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' } })
}

/**
 * This endpoint is an idempotent observation, not an enrollment or payment
 * command. The guest request key is the same capability already required to
 * create/reopen that checkout; authenticated top-ups additionally require the
 * normal session CSRF token.
 */
export async function POST(request: Request) {
  if (request.headers.get('origin') !== publicOrigin() || request.headers.get('sec-fetch-site') === 'cross-site') {
    return reply({ success: false, error: 'Cross-site request refused.' }, 403)
  }
  const ip = request.headers.get('x-real-ip') || 'unknown'
  if (process.env.IUNLOCKMOBILE_CHECKOUT_REMINDERS_ENABLED !== '1') return reply(null, 204)
  if (!consumeAttempt('checkout-reminder-open-ip', createHash('sha256').update(ip).digest('hex'), 60, 60)) return reply(null, 204)
  try {
    const body = await readCommandJson(request)
    const kind = body.kind === 'guest' || body.kind === 'topup' ? body.kind as CheckoutReminderKind : null
    const reference = typeof body.reference === 'string' ? body.reference : ''
    if (!kind || !REFERENCE.test(reference)) return reply({ success: false }, 400)

    if (kind === 'guest') {
      const session = await currentSession()
      if (!session || session.user.account_type === 'admin') return reply(null, 204)
      const consent = parseSignedConsent((await cookies()).get(CONSENT_COOKIE)?.value)?.consent
      if (consent === 'denied') return reply({ success: false }, 204)
      recordCheckoutReminderOpened(kind, reference, session.user.id, 'guest_payment_open')
      return reply({ success: true })
    }

    const session = await currentSession()
    if (!session || session.user.account_type === 'admin' || body.csrfToken !== session.session.csrfToken) return reply({ success: false }, 204)
    if (!['customer', 'reseller'].includes(session.user.account_type) || session.user.status !== 'active' || session.user.banned_at || !session.user.email_verified_at) {
      return reply({ success: false }, 204)
    }
    recordCheckoutReminderOpened(kind, reference, session.user.id, 'topup_payment_open')
    return reply({ success: true })
  } catch {
    // Opening a payment page must never block the payment itself. The worker
    // simply sees no open marker and therefore sends no reminder.
    return reply({ success: false }, 204)
  }
}
