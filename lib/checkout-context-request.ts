import { cookies, headers } from 'next/headers'
import { CLICK_ID_FIELDS, validateClickId, type ClickIdField } from './attribution'
import { ATTRIBUTION_COOKIE, CONSENT_COOKIE } from './cookie-names'
import { clientIp, recordCheckoutContext, type ConsentChoice } from './ga4'
import { parseAttributionCookie, parseSignedConsent } from './order-attribution'

/** The visitor's stored choice: 'unknown' until they press Accept or close the notice. */
export async function consentChoice(): Promise<ConsentChoice> {
  try { return parseSignedConsent((await cookies()).get(CONSENT_COOKIE)?.value)?.consent ?? 'unknown' } catch { return 'unknown' }
}

/** Snapshot taken when a checkout is created. Measurement must never fail a payment or an order. */
export async function captureCheckoutContext(kind: 'topup' | 'order' | 'paid_imei_report' | 'guest', reference: string, userId: number | null, input: unknown) {
  try {
    const jar = await cookies()
    const consent = await consentChoice()
    const ip = clientIp(await headers())
    const clickIds: Partial<Record<ClickIdField, string>> = {}
    const fromCookie = consent === 'granted' ? parseAttributionCookie(jar.get(ATTRIBUTION_COOKIE)?.value) : null
    const fromPage = input && typeof input === 'object' ? input as Record<string, unknown> : {}
    for (const field of CLICK_ID_FIELDS) {
      const id = fromCookie?.[field] ?? validateClickId(fromPage[field])
      if (id) clickIds[field] = id
    }
    recordCheckoutContext(kind, reference, userId, consent, ip, clickIds, input)
  } catch { /* Optional measurement. */ }
}
