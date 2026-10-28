import { cookies } from 'next/headers'
import { CONSENT_COOKIE } from './cookie-names'
import { parseSignedConsent } from './order-attribution'
import { savePaymentAnalytics } from './payment-analytics'
export async function snapshotPaymentAnalytics(reference: string, userId: number, input: unknown) {
  try {
    const consent = parseSignedConsent((await cookies()).get(CONSENT_COOKIE)?.value)
    savePaymentAnalytics(reference, userId, input, consent?.consent === 'granted')
  } catch { /* Measurement must not fail a payment request. */ }
}
