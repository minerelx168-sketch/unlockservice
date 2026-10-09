import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { ATTRIBUTION_COOKIE, CONSENT_COOKIE } from './cookie-names'
import { ATTRIBUTION_MAX_AGE_SECONDS, CLICK_ID_FIELDS, validateClickId, type AttributionSnapshot } from './attribution'
export { ATTRIBUTION_MAX_AGE_SECONDS, validateClickId } from './attribution'
export type { AttributionSnapshot } from './attribution'
export const ATTRIBUTION_TYPES = ['order', 'paid_report_order'] as const
export type AttributionOrderType = (typeof ATTRIBUTION_TYPES)[number]
export type ConsentState = 'granted' | 'denied'
function signature(payload: string): Buffer {
  const key = process.env.IUNLOCKMOBILE_ATTRIBUTION_SECRET?.trim() || process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET?.trim()
  if (!key || key.length < 32) throw new Error('Attribution signing unavailable')
  return createHmac('sha256', key).update(`website-attribution-v1:${payload}`).digest()
}
export function encodeSignedConsent(consent: ConsentState, input: Partial<AttributionSnapshot> = {}, now = Date.now()): string {
  const payload: Record<string, string | number> = { version: 1, consent, issuedAt: now, expiresAt: now + ATTRIBUTION_MAX_AGE_SECONDS * 1000 }
  if (consent === 'granted') for (const field of CLICK_ID_FIELDS) {
    const value = validateClickId(input[field]); if (value) payload[field] = value
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${signature(encoded).toString('base64url')}`
}
export function parseSignedConsent(value: unknown, now = Date.now()): (Partial<Omit<AttributionSnapshot, 'consent'>> & { consent: ConsentState }) | null {
  try {
    if (typeof value !== 'string' || value.length > 1024) return null
    const parts = value.split('.')
    if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) return null
    const actual = Buffer.from(parts[1], 'base64url'), expected = signature(parts[0])
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null
    const data = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8')) as Record<string, unknown>
    if (data.version !== 1 || !['granted', 'denied'].includes(String(data.consent))) return null
    if (typeof data.issuedAt !== 'number' || typeof data.expiresAt !== 'number' || !Number.isSafeInteger(data.issuedAt) || !Number.isSafeInteger(data.expiresAt)) return null
    if (data.issuedAt > now || data.expiresAt <= now || data.expiresAt <= data.issuedAt || data.expiresAt - data.issuedAt > ATTRIBUTION_MAX_AGE_SECONDS * 1000) return null
    const result: Partial<Omit<AttributionSnapshot, 'consent'>> & { consent: ConsentState } = { consent: data.consent as ConsentState }
    if (result.consent === 'granted') for (const field of CLICK_ID_FIELDS) {
      if (data[field] !== undefined && !validateClickId(data[field])) return null
      const id = validateClickId(data[field]); if (id) result[field] = id
    }
    return result
  } catch { return null }
}
export function parseAttributionCookie(value: unknown, now = Date.now()): AttributionSnapshot | null {
  const payload = parseSignedConsent(value, now)
  return payload?.consent === 'granted' && CLICK_ID_FIELDS.some((field) => payload[field]) ? payload as AttributionSnapshot : null
}
export async function readWebsiteAttribution(): Promise<AttributionSnapshot | null> {
  const jar = await cookies()
  if (parseSignedConsent(jar.get(CONSENT_COOKIE)?.value)?.consent !== 'granted') return null
  return parseAttributionCookie(jar.get(ATTRIBUTION_COOKIE)?.value)
}
/** Includes missing request context: observability must never fail an accepted order. */
export async function snapshotWebsiteAttribution(orderType: AttributionOrderType, orderId: number, source: string): Promise<void> {
  try {
    if (!ATTRIBUTION_TYPES.includes(orderType) || source !== 'website' || !Number.isSafeInteger(orderId) || orderId < 1) return
    const snapshot = await readWebsiteAttribution()
    if (!snapshot) return
    const { db } = await import('./db')
    db().prepare(`INSERT INTO order_attribution (order_type, order_id, gclid, gbraid, wbraid, consent_state)
      VALUES (?, ?, ?, ?, ?, 'granted') ON CONFLICT(order_type, order_id) DO NOTHING`)
      .run(orderType, orderId, snapshot.gclid ?? null, snapshot.gbraid ?? null, snapshot.wbraid ?? null)
  } catch { /* Cookie, configuration and database failures are non-fatal. */ }
}
