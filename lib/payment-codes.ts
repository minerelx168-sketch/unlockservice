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
 *  - a code is never reissued near the same amount on the same route; once
 *    exhausted, an uncoded request requires manual review instead.
 */

/** A transfer within ±3 tokens of the asked amount can match. */
export const MATCH_BAND_E4 = 30_000
/** An unpaid coded invoice accepts transfers sent within this long of its creation. */
export const INVOICE_TTL_DAYS = 7
/** It is closed a day later, so a payment sent in its last minutes still finds it open. */
const EXPIRY_GRACE_DAYS = 1
/** Default dust floor; below it only a coded open invoice inside the shortfall cap may match. */
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
 * An exchange-withdrawal shortfall up to the smaller of $1 or 3% of the
 * requested total is absorbed by the merchant. Outside this cap, only the
 * actual verified amount is credited. Both caps can be lowered by an operator.
 */
export function shortfallToleranceCents(totalDueCents: number): number {
  const cents = envInteger('IUNLOCKMOBILE_PAYMENT_SHORTFALL_TOLERANCE_CENTS', 100, 500)
  const bps = envInteger('IUNLOCKMOBILE_PAYMENT_SHORTFALL_TOLERANCE_BPS', 300, 1_000)
  return Math.min(100, cents, Math.floor((totalDueCents * Math.min(300, bps)) / 10_000))
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

/** Hold a late transfer carrying any prior invoice's code, permanently. */
export function reservedCodeOwners(routeId: string, receivedE4: number, sentAt: string, excludingReference: string): Array<{
  reference: string; user_id: number; status: string; payment_reference: string | null
}> {
  const rows = db().prepare(`SELECT reference, user_id, status, payment_reference, payment_amount_e4
      FROM invoices WHERE payment_route_id = ? AND reference != ?
        AND payment_amount_e4 IS NOT NULL AND payment_amount_e4 % 100 = ?
        AND ABS(payment_amount_e4 - ?) <= ?
        AND julianday(created_at) < julianday(?)`)
    .all(routeId, excludingReference, paymentCode(receivedE4), receivedE4, MATCH_BAND_E4,
      sentAt) as Array<{
      reference: string; user_id: number; status: string; payment_reference: string | null; payment_amount_e4: number
    }>
  return rows.filter((row) => carriesInvoiceCode(row, receivedE4))
}

/**
 * What a coded transfer is worth in credit. The asked amount credits the
 * invoice exactly; a shortfall within the merchant's cap credits the invoice
 * in full, otherwise the verified amount is credited, floored to the cent.
 */
export function creditForCodedTransfer(invoice: CodedInvoiceTerms, receivedE4: number): number {
  const askedE4 = invoice.payment_amount_e4
  if (receivedE4 >= askedE4) return invoice.credit_amount_cents + Math.floor((receivedE4 - askedE4) / 100)
  const shortCents = Math.ceil((askedE4 - receivedE4) / 100)
  if (shortCents <= shortfallToleranceCents(invoice.total_due_cents)) return invoice.credit_amount_cents
  return Math.floor(receivedE4 / 100)
}

/**
 * Picks a code no invoice on this route near this amount has ever held.
 * Returns null when the codes are exhausted; no code is ever reused.
 */
export function allocatePaymentAmount(routeId: string, totalDueCents: number): number | null {
  const base = totalDueCents * 100
  const taken = new Set(
    (
      db()
        .prepare(
          `SELECT payment_amount_e4 % 100 AS code FROM invoices
            WHERE payment_amount_e4 IS NOT NULL AND payment_route_id = ?
              AND ABS(payment_amount_e4 - ?) <= ?`,
        )
        .all(
          routeId,
          base,
          // Two bands plus the code itself: invoices exactly two bands apart
          // could otherwise both claim a transfer landing halfway between.
          MATCH_BAND_E4 * 2 + 100,
        ) as Array<{ code: number }>
    ).map((row) => row.code),
  )
  const free: number[] = []
  for (let code = 1; code <= 99; code += 1) if (!taken.has(code)) free.push(code)
  if (free.length === 0) {
    console.warn(`[payments] coded amounts exhausted on ${routeId}; manual-review request required`)
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
