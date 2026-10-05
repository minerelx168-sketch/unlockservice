import { randomInt } from 'node:crypto'
import { db } from './db'

/**
 * Payment codes: every invoice asks for a slightly different amount —
 * $25.00 becomes 25.0037 USDT. The two digits after the cents are the
 * invoice's code. The payment watcher reads every transfer into the wallet
 * and ties one carrying that code to this invoice, so the customer sends
 * and walks away; nobody has to find and paste a transaction ID.
 *
 * The code sits below the cents on purpose. Exchanges that take their
 * withdrawal fee out of the amount change the cents (25.0037 − 0.29 =
 * 24.7137) but leave the code alone, so the transfer still finds its
 * invoice and the shortfall is handled as a shortfall, not a mystery.
 *
 * The rules that keep money from landing on the wrong account:
 *  - two open invoices on the same route never share a code within reach of
 *    one transfer (two match bands apart);
 *  - a transfer only pays an invoice created strictly before its block — a
 *    grace period would be a window to open an invoice that catches someone
 *    else's transfer;
 *  - a code stays reserved for a while after its invoice closes, so a late
 *    or duplicate send is never credited to a stranger.
 */

/** A transfer within ±3 tokens of the asked amount can match. */
export const MATCH_BAND_E4 = 30_000
/** An unpaid coded invoice accepts transfers sent within this long of its creation. */
export const INVOICE_TTL_DAYS = 7
/** It is closed a day later, so a payment sent in its last minutes still finds it open. */
const EXPIRY_GRACE_DAYS = 1
const SETTLED_CODE_QUARANTINE_DAYS = 2
const CLOSED_CODE_QUARANTINE_DAYS = 7
/** Transfers below one token are never matched or recorded (address-poisoning spam). */
export const DUST_FLOOR_E4 = 10_000

export function paymentCode(amountE4: number): number {
  return amountE4 % 100
}

/** Raw token units → 1/10,000 of a token, floored. Never rounds up. */
export function rawToE4(raw: bigint, decimals: number): number | null {
  if (raw < 0n || !Number.isSafeInteger(decimals) || decimals < 4 || decimals > 36) return null
  const e4 = raw / 10n ** BigInt(decimals - 4)
  return e4 <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(e4) : null
}

/** 250037 → "25.0037" */
export function formatE4(amountE4: number): string {
  return `${Math.floor(amountE4 / 10_000)}.${String(amountE4 % 10_000).padStart(4, '0')}`
}

/** SQLite's datetime('now') has no zone marker; it is UTC. */
export function sqliteTime(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`)
}

function envInteger(name: string, fallback: number, max: number): number {
  const value = Number(process.env[name] ?? fallback)
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : fallback
}

/**
 * Default to the amount actually verified on-chain, including a shortfall
 * caused by an exchange fee. A separately reviewed explicit operator opt-in
 * is required to absorb any shortfall (capped in cents and basis points).
 */
export function shortfallToleranceCents(totalDueCents: number): number {
  const cents = envInteger('IUNLOCKMOBILE_PAYMENT_SHORTFALL_TOLERANCE_CENTS', 0, 500)
  const bps = envInteger('IUNLOCKMOBILE_PAYMENT_SHORTFALL_TOLERANCE_BPS', 0, 1_000)
  return Math.min(cents, Math.floor((totalDueCents * bps) / 10_000))
}

export type CodedInvoiceTerms = {
  credit_amount_cents: number
  total_due_cents: number
  payment_amount_e4: number
}

/** True when this amount is the invoice's: same code, inside the band. */
export function carriesInvoiceCode(invoice: Pick<CodedInvoiceTerms, 'payment_amount_e4'>, receivedE4: number): boolean {
  return (
    paymentCode(receivedE4) === paymentCode(invoice.payment_amount_e4)
    && Math.abs(receivedE4 - invoice.payment_amount_e4) <= MATCH_BAND_E4
  )
}

/**
 * What a coded transfer is worth in credit. The asked amount credits the
 * invoice exactly; a shortfall credits what actually arrived, floored to the
 * cent, unless both operator tolerance settings were explicitly enabled.
 */
export function creditForCodedTransfer(invoice: CodedInvoiceTerms, receivedE4: number): number {
  const askedE4 = invoice.payment_amount_e4
  if (receivedE4 >= askedE4) return invoice.credit_amount_cents + Math.floor((receivedE4 - askedE4) / 100)
  const shortCents = Math.ceil((askedE4 - receivedE4) / 100)
  if (shortCents <= shortfallToleranceCents(invoice.total_due_cents)) return invoice.credit_amount_cents
  return Math.floor(receivedE4 / 100)
}

/**
 * Picks a code no other recent invoice on this route near this amount
 * holds. Returns null when every code is taken; that invoice falls back to
 * a pasted transaction ID and a person.
 */
export function allocatePaymentAmount(routeId: string, totalDueCents: number): number | null {
  const base = totalDueCents * 100
  /* paid_at and updated_at may be ISO or SQLite text; julianday reads both,
     where a plain string comparison would not. */
  const taken = new Set(
    (
      db()
        .prepare(
          `SELECT payment_amount_e4 % 100 AS code FROM invoices
            WHERE payment_amount_e4 IS NOT NULL AND payment_route_id = ?
              AND ABS(payment_amount_e4 - ?) <= ?
              AND julianday(created_at) >= julianday('now') - 60
              AND (
                status IN ('pending', 'review')
                OR (status = 'success'
                    AND julianday(COALESCE(paid_at, updated_at)) >= julianday('now') - ?)
                OR (status NOT IN ('pending', 'review', 'success')
                    AND julianday(updated_at) >= julianday('now') - ?)
              )`,
        )
        .all(
          routeId,
          base,
          // Two bands plus the code itself: invoices exactly two bands apart
          // could otherwise both claim a transfer landing halfway between.
          MATCH_BAND_E4 * 2 + 100,
          SETTLED_CODE_QUARANTINE_DAYS,
          CLOSED_CODE_QUARANTINE_DAYS,
        ) as Array<{ code: number }>
    ).map((row) => row.code),
  )
  const free: number[] = []
  for (let code = 1; code <= 99; code += 1) if (!taken.has(code)) free.push(code)
  if (free.length === 0) {
    console.error(`[payments] no free payment code near ${base / 10_000} on ${routeId} — invoice created without one`)
    return null
  }
  return base + free[randomInt(free.length)]
}

/** Closes coded invoices nobody paid. Cheap; called wherever invoices are matched or created. */
export function expireStaleCodedInvoices(): number {
  return db()
    .prepare(
      `UPDATE invoices
          SET status = 'failed',
              note = 'Expired unpaid after ${INVOICE_TTL_DAYS} days.',
              updated_at = datetime('now')
        WHERE status = 'pending' AND payment_amount_e4 IS NOT NULL
          AND julianday(created_at) < julianday('now') - ${INVOICE_TTL_DAYS + EXPIRY_GRACE_DAYS}`,
    )
    .run().changes
}

/** Past the window in which a transfer can still pay it, even if not yet marked closed. */
export function codedInvoiceExpired(
  invoice: { status: string; payment_amount_e4: number | null; created_at: string },
  now = Date.now(),
): boolean {
  return (
    invoice.status === 'pending'
    && invoice.payment_amount_e4 !== null
    && now > sqliteTime(invoice.created_at).getTime() + INVOICE_TTL_DAYS * 86_400_000
  )
}

export function codedInvoiceClosesAt(invoice: { created_at: string }): Date {
  return new Date(sqliteTime(invoice.created_at).getTime() + INVOICE_TTL_DAYS * 86_400_000)
}
