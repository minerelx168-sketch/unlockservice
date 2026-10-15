import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { ATTRIBUTION_COOKIE, CONSENT_COOKIE } from '@/lib/cookie-names'
import { CLICK_ID_FIELDS, validateClickId, type AttributionSnapshot } from '@/lib/attribution'
import { ATTRIBUTION_MAX_AGE_SECONDS, encodeSignedConsent, parseAttributionCookie, parseSignedConsent } from '@/lib/order-attribution'
import { readCommandJson } from '@/lib/request-json'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export async function GET() {
  const jar = await cookies()
  const consentPayload = parseSignedConsent(jar.get(CONSENT_COOKIE)?.value)
  const attribution = consentPayload?.consent === 'granted'
    ? parseAttributionCookie(jar.get(ATTRIBUTION_COOKIE)?.value)
    : null
  const clickIds = attribution
    ? Object.fromEntries(CLICK_ID_FIELDS.flatMap((field) => attribution[field] ? [[field, attribution[field]]] : []))
    : {}
  return NextResponse.json({ consent: consentPayload?.consent ?? 'unknown', clickIds }, { headers: { 'Cache-Control': 'no-store' } })
}
export async function POST(request: Request) {
  let sameOrigin = false
  try { const origin = new URL(request.headers.get('origin') ?? ''); sameOrigin = origin.host === (request.headers.get('host') ?? new URL(request.url).host) && ['http:', 'https:'].includes(origin.protocol) } catch { /* Missing or malformed origin is denied. */ }
  if (!sameOrigin || request.headers.get('x-requested-with') !== 'XMLHttpRequest') {
    return NextResponse.json({ error: 'Invalid request origin.' }, { status: 403 })
  }
  let body: Record<string, unknown>
  try { body = await readCommandJson(request) } catch { return NextResponse.json({ error: 'Invalid request.' }, { status: 400 }) }
  if (body.consent !== 'granted' && body.consent !== 'denied') return NextResponse.json({ error: 'Invalid consent.' }, { status: 400 })
  const snapshot: Partial<AttributionSnapshot> = {}
  if (body.consent === 'granted') for (const field of CLICK_ID_FIELDS) {
    if (body[field] !== undefined && !validateClickId(body[field])) return NextResponse.json({ error: 'Invalid click identifier.' }, { status: 400 })
    const id = validateClickId(body[field]); if (id) snapshot[field] = id
  }
  const jar = await cookies()
  const options = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge: ATTRIBUTION_MAX_AGE_SECONDS }
  try {
    const signed = encodeSignedConsent(body.consent)
    const existing = parseSignedConsent(jar.get(ATTRIBUTION_COOKIE)?.value)
    jar.set(CONSENT_COOKIE, signed, options)
    if (body.consent === 'denied') jar.set(ATTRIBUTION_COOKIE, '', { ...options, maxAge: 0 })
    else if (CLICK_ID_FIELDS.some((field) => snapshot[field])) jar.set(ATTRIBUTION_COOKIE, encodeSignedConsent('granted', snapshot), options)
    else if (existing?.consent !== 'granted') jar.set(ATTRIBUTION_COOKIE, '', { ...options, maxAge: 0 })
    const stored = body.consent === 'granted'
      ? (CLICK_ID_FIELDS.some((field) => snapshot[field]) ? snapshot : existing?.consent === 'granted' ? existing : {})
      : {}
    const clickIds = Object.fromEntries(CLICK_ID_FIELDS.flatMap((field) => stored[field] ? [[field, stored[field]]] : []))
    return NextResponse.json({ consent: body.consent, clickIds }, { headers: { 'Cache-Control': 'no-store' } })
  } catch { return NextResponse.json({ error: 'Consent storage is unavailable. Optional tracking remains disabled.' }, { status: 503 }) }
}
