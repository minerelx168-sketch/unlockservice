import { cookies } from 'next/headers'
import { CARRIERS } from './catalog'
import { QUOTE_COOKIE } from './cookie-names'
import { isValidImei, maskIdentifier, normalizeImei } from './imei'

/**
 * The unlock a visitor asked for on the homepage, carried to the order form
 * they have to sign in to reach.
 *
 * It used to travel as a query string. An IMEI in a URL is written to the
 * Caddy access log, sent to every third party the next page talks to in the
 * Referer header, and left in the visitor's history for whoever else uses
 * the machine — for a number the rest of this codebase goes out of its way
 * never to store in the clear. A short-lived httpOnly cookie goes to the
 * same place and appears in none of them.
 *
 * It is not signed. Nothing here is a claim about the visitor: it is their
 * own IMEI being handed back to their own order form, and every value is
 * re-validated on the way out. Forging it gains an attacker a prefilled
 * field on their own screen.
 */

export { QUOTE_COOKIE }

/* Long enough to read a sign-up email, short enough that an abandoned
   quote does not sit on a shared machine. middleware.ts drops it earlier
   than this as soon as the visitor moves past the order form. */
const QUOTE_TTL_SECONDS = 15 * 60

export type UnlockQuote = {
  imei: string
  carrierId: number
  carrierName: string
  country: string
}

function carrier(carrierId: number) {
  return CARRIERS.find((entry) => entry.id === carrierId)
}

export async function writeQuote(imei: string, carrierId: number) {
  const jar = await cookies()
  jar.set(QUOTE_COOKIE, JSON.stringify({ imei, carrierId }), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: QUOTE_TTL_SECONDS,
  })
}

/** Reads the quote back, or null if there is none and if it no longer resolves. */
export async function readQuote(): Promise<UnlockQuote | null> {
  const raw = (await cookies()).get(QUOTE_COOKIE)?.value
  if (!raw) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const { imei, carrierId } = parsed as { imei?: unknown; carrierId?: unknown }
  const digits = normalizeImei(String(imei ?? ''))
  if (!isValidImei(digits)) return null

  const found = carrier(Number(carrierId))
  if (!found) return null

  return { imei: digits, carrierId: found.id, carrierName: found.name, country: found.country }
}

/** What the visitor is shown while the quote is being carried. Never the whole number. */
export function describeQuote(quote: UnlockQuote): string {
  return `${quote.carrierName} · IMEI ${maskIdentifier(quote.imei)}`
}
