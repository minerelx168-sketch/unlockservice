import { randomBytes, randomInt } from 'node:crypto'
import { credit } from './credits'
import { db } from './db'
import { consumeAttempt } from './rate-limit'

/**
 * An invoice locks its numbers at creation. Credit lands only after trusted
 * confirmation — either the chain watcher finding the transfer that carries
 * the invoice's code (lib/usdt.ts), or an administrator. A customer may
 * still submit a payment reference, but that never credits anything alone.
 */

export type Invoice = {
  reference: string
  user_id: number
  gateway: string
  credit_amount_cents: number
  fee_cents: number
  tax_cents: number
  total_due_cents: number
  currency: string
  status: 'pending' | 'review' | 'success' | 'failed' | 'refunded'
  payment_reference: string | null
  note: string | null
  /** Exact USDT to send, in 1/10,000 USDT. Null on invoices made before codes. */
  pay_amount_e4: number | null
  received_e4: number | null
  credited_cents: number | null
  created_at: string
  updated_at: string
}

type InvoiceRow = Invoice & {
  provider: string | null
  provider_charge_id: string | null
  idempotency_key: string | null
  paid_at: string | null
  credited_at: string | null
}

export type Gateway = {
  id: string
  label: string
  asset: string
  network: string
  /** What the network is called in the exchange and wallet apps customers use. */
  networkLabel: string
  feeBasisPoints: number
  address: string
}

export const USDT_GATEWAY_ID = 'crypto_networks'

export const GATEWAYS: Gateway[] = process.env.IUNLOCKMOBILE_USDT_BEP20_ADDRESS
  ? [
      {
        id: USDT_GATEWAY_ID,
        label: 'USDT',
        asset: 'USDT',
        network: 'BEP-20',
        networkLabel: 'BNB Smart Chain (BEP20)',
        feeBasisPoints: Number(process.env.IUNLOCKMOBILE_USDT_FEE_BPS ?? '0'),
        address: process.env.IUNLOCKMOBILE_USDT_BEP20_ADDRESS,
      },
    ]
  : []

export type GatewayId = string

export class PaymentError extends Error {}

export const MIN_TOPUP_CENTS = 500
export const MAX_TOPUP_CENTS = 1_000_000

/* ---- payment codes ----------------------------------------------------
 *
 * Every invoice asks for a slightly different amount: $25.00 becomes
 * 25.0037 USDT. The two digits after the cents are the invoice's code. A
 * transfer of 25.0037 can only be this invoice, so the customer sends and
 * walks away — no transaction id to find and paste.
 *
 * The code sits below the cents on purpose. Exchanges that take their
 * withdrawal fee out of the amount change the cents (25.0037 − 0.29 =
 * 24.7137) but leave the code alone, so the transfer still finds its
 * invoice and the shortfall is handled as a shortfall, not a mystery.
 */

/** A transfer within this distance of the asked amount can match. */
export const MATCH_BAND_E4 = 30_000
/** Reopening the same top-up within this window shows the same invoice. */
export const CODE_RESERVATION_HOURS = 24
/** An unpaid coded invoice accepts transfers sent within this long of its creation. */
export const INVOICE_TTL_DAYS = 7
/**
 * It is closed a day after that, not at once, so a payment sent in its last
 * minutes but scanned just after still finds it open.
 */
const EXPIRY_GRACE_DAYS = 1
/**
 * After an invoice settles or closes its code stays out of circulation a
 * while longer, so a duplicate or late send is never credited to a stranger.
 */
const SETTLED_CODE_QUARANTINE_DAYS = 2
const CLOSED_CODE_QUARANTINE_DAYS = 7
/** Abuse limits: new invoices per account per hour, and unpaid at once. */
const NEW_INVOICES_PER_HOUR = 10
const MAX_OPEN_INVOICES = 5

export function paymentCode(payAmountE4: number): number {
  return payAmountE4 % 100
}

function envInteger(name: string, fallback: number, max: number): number {
  const value = Number(process.env[name] ?? fallback)
  return Number.isSafeInteger(value) && value >= 0 ? Math.min(value, max) : fallback
}

/**
 * How short a coded transfer may arrive and still credit the invoice in
 * full — exchanges that take their withdrawal fee out of the amount. Capped
 * both in cents and as a share of the invoice, so it can never become a
 * discount worth farming on small top-ups. 0 credits only what arrives.
 */
export function shortfallToleranceCents(totalDueCents: number): number {
  const cents = envInteger('IUNLOCKMOBILE_USDT_SHORTFALL_TOLERANCE_CENTS', 100, 500)
  const bps = envInteger('IUNLOCKMOBILE_USDT_SHORTFALL_TOLERANCE_BPS', 300, 1_000)
  return Math.min(cents, Math.floor((totalDueCents * bps) / 10_000))
}

/** Closes coded invoices nobody paid. Cheap; called wherever invoices are read in bulk. */
export function expireStaleInvoices(): number {
  return db()
    .prepare(
      `UPDATE invoices
          SET status = 'failed',
              note = 'Expired unpaid after ${INVOICE_TTL_DAYS} days.',
              updated_at = datetime('now')
        WHERE status = 'pending' AND pay_amount_e4 IS NOT NULL
          AND julianday(created_at) < julianday('now') - ${INVOICE_TTL_DAYS + EXPIRY_GRACE_DAYS}`,
    )
    .run().changes
}

/** Past the window in which a transfer can still pay it, even if not yet marked closed. */
export function invoiceExpired(invoice: Pick<Invoice, 'status' | 'pay_amount_e4' | 'created_at'>, now = Date.now()): boolean {
  return (
    invoice.status === 'pending' &&
    invoice.pay_amount_e4 !== null &&
    now > sqliteTime(invoice.created_at).getTime() + INVOICE_TTL_DAYS * 86_400_000
  )
}

/**
 * Picks a code no other recent invoice near this amount holds. Two invoices
 * may share a code only when their amounts are too far apart for one
 * transfer to fall inside both match bands. Settled invoices keep their code
 * a little longer so an accidental second send is not credited to a
 * stranger. Returns null when every code is taken; that invoice falls back
 * to a pasted transaction id and a person.
 */
function allocatePayAmount(totalDueCents: number): number | null {
  const base = totalDueCents * 100
  /* paid_at and updated_at may be ISO or SQLite text; julianday reads both,
     where a plain string comparison would not. */
  const taken = new Set(
    (
      db()
        .prepare(
          `SELECT pay_amount_e4 % 100 AS code FROM invoices
            WHERE pay_amount_e4 IS NOT NULL
              AND ABS(pay_amount_e4 - ?) <= ?
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
    console.error(`[payments] no free payment code near ${base / 10_000} USDT — invoice created without one`)
    return null
  }
  return base + free[randomInt(free.length)]
}

/**
 * What a transfer is worth in credit. Paying the asked amount credits the
 * invoice exactly; a small shortfall (an exchange's withdrawal fee) is
 * absorbed; anything else credits what actually arrived, net of the
 * invoice's fee rate, so nobody is left stuck on an unpaid invoice.
 */
export function creditForTransfer(invoice: Pick<Invoice, 'credit_amount_cents' | 'total_due_cents' | 'fee_cents' | 'pay_amount_e4'>, receivedE4: number): number {
  const askedE4 = invoice.pay_amount_e4 ?? invoice.total_due_cents * 100
  const feeShare = (cents: number) =>
    invoice.total_due_cents > 0 ? Math.floor((cents * invoice.credit_amount_cents) / invoice.total_due_cents) : cents

  if (receivedE4 >= askedE4) {
    const extraCents = Math.floor((receivedE4 - askedE4) / 100)
    return invoice.credit_amount_cents + feeShare(extraCents)
  }
  const shortCents = Math.ceil((askedE4 - receivedE4) / 100)
  if (shortCents <= shortfallToleranceCents(invoice.total_due_cents)) return invoice.credit_amount_cents
  return feeShare(Math.floor(receivedE4 / 100))
}

const INVOICE_COLUMNS = `
  reference, user_id, gateway, credit_amount_cents, fee_cents, tax_cents,
  total_due_cents, currency, status, payment_reference, note,
  pay_amount_e4, received_e4, credited_cents, created_at, updated_at
`

function invoiceRow(reference: string, userId?: number): InvoiceRow | undefined {
  const where = userId === undefined ? 'reference = ?' : 'reference = ? AND user_id = ?'
  return db()
    .prepare(`SELECT *, COALESCE(provider, gateway) AS provider FROM invoices WHERE ${where}`)
    .get(...(userId === undefined ? [reference] : [reference, userId])) as InvoiceRow | undefined
}

export function createInvoice(userId: number, gatewayId: string, creditCents: number): Invoice {
  const gateway = GATEWAYS.find((entry) => entry.id === gatewayId)
  if (!gateway) throw new PaymentError('No payment method is configured. Contact support before sending funds.')
  if (!Number.isSafeInteger(creditCents) || creditCents < MIN_TOPUP_CENTS || creditCents > MAX_TOPUP_CENTS) {
    throw new PaymentError(
      `Top-up must be between $${(MIN_TOPUP_CENTS / 100).toFixed(2)} and $${(MAX_TOPUP_CENTS / 100).toFixed(2)}.`,
    )
  }

  expireStaleInvoices()
  return db().transaction(() => {
    /* Reopening the same unpaid invoice keeps one customer from burning a
       code per page refresh. Only while its amount is still held. */
    const open = db()
      .prepare(
        `SELECT ${INVOICE_COLUMNS} FROM invoices
          WHERE user_id = ? AND gateway = ? AND credit_amount_cents = ?
            AND status = 'pending' AND payment_reference IS NULL
            AND pay_amount_e4 IS NOT NULL
            AND created_at >= datetime('now', ?)
          ORDER BY created_at DESC, rowid DESC LIMIT 1`,
      )
      .get(userId, gatewayId, creditCents, `-${CODE_RESERVATION_HOURS} hours`) as Invoice | undefined
    if (open) return open

    /* Every open invoice holds a code. Without limits one account could
       hold all 99 near an amount — enough to catch a stranger's mistyped
       transfer, or to push everyone else onto the manual path. */
    const unpaid = db()
      .prepare(
        `SELECT COUNT(*) AS count FROM invoices
          WHERE user_id = ? AND status IN ('pending', 'review') AND pay_amount_e4 IS NOT NULL`,
      )
      .get(userId) as { count: number }
    if (unpaid.count >= MAX_OPEN_INVOICES) {
      throw new PaymentError(
        `You have ${unpaid.count} top-ups waiting for payment or review. Use one of them from the Payments page, or wait for them to close.`,
      )
    }
    if (!consumeAttempt('invoice-create', String(userId), NEW_INVOICES_PER_HOUR, 3_600)) {
      throw new PaymentError('Too many new top-ups in the last hour. Use one you already created, or try again later.')
    }

    const fee = Math.round((creditCents * gateway.feeBasisPoints) / 10_000)
    const totalDue = creditCents + fee
    const reference = randomBytes(16).toString('hex')
    db()
      .prepare(
        `INSERT INTO invoices
           (reference, user_id, gateway, credit_amount_cents, fee_cents, tax_cents,
            total_due_cents, provider, idempotency_key, pay_amount_e4)
         VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
      )
      .run(
        reference,
        userId,
        gatewayId,
        creditCents,
        fee,
        totalDue,
        gatewayId,
        `${userId}-${gatewayId}-${creditCents}-${randomBytes(16).toString('hex')}`,
        allocatePayAmount(totalDue),
      )
    return getInvoice(reference, userId)!
  })()
}

export function getInvoice(reference: string, userId: number): Invoice | undefined {
  return db()
    .prepare(`SELECT ${INVOICE_COLUMNS} FROM invoices WHERE reference = ? AND user_id = ?`)
    .get(reference, userId) as Invoice | undefined
}

/** For trusted callers (the watcher, an administrator) that act across accounts. */
export function getInvoiceAnyUser(reference: string): Invoice | undefined {
  return db().prepare(`SELECT ${INVOICE_COLUMNS} FROM invoices WHERE reference = ?`).get(reference) as
    | Invoice
    | undefined
}

export function listInvoices(userId: number, limit = 50): Invoice[] {
  return db()
    .prepare(
      `SELECT ${INVOICE_COLUMNS} FROM invoices
        WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    )
    .all(userId, limit) as Invoice[]
}

/** The customer submits evidence; this never changes their balance. */
export function submitPaymentReference(
  reference: string,
  userId: number,
  paymentReference: string,
  note: string,
): Invoice {
  const invoice = invoiceRow(reference, userId)
  if (!invoice) throw new PaymentError('No such invoice.')
  if (!GATEWAYS.some((gateway) => gateway.id === invoice.gateway)) {
    throw new PaymentError('This payment method is not configured. Do not send funds.')
  }
  if (invoice.status === 'success') throw new PaymentError('This invoice is already settled.')
  if (!['pending', 'review'].includes(invoice.status)) throw new PaymentError(`This invoice is ${invoice.status}.`)

  const cleanReference = paymentReference.trim()
  if (!/^[A-Za-z0-9:_-]{6,255}$/.test(cleanReference)) {
    throw new PaymentError('Enter a valid transaction reference.')
  }

  db()
    .prepare(
      `UPDATE invoices
          SET payment_reference = ?, note = ?, status = 'review', updated_at = datetime('now')
        WHERE reference = ? AND user_id = ? AND status IN ('pending', 'review')`,
    )
    .run(cleanReference, note.trim().slice(0, 500) || null, reference, userId)
  return getInvoice(reference, userId)!
}

/**
 * This button mints credit, so it is switched on by hand or not at all.
 *
 * It used to fall back to `NODE_ENV !== 'production'`, which reads as a
 * development convenience but is a default-open switch: an unset NODE_ENV
 * — a systemd unit missing one line — handed every account the ability to
 * confirm its own invoice. A missing variable now means off.
 */
export function selfApprovalEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.IUNLOCKMOBILE_ALLOW_SELF_APPROVE === '1'
}

export type Settlement = {
  /** Credit to add. Defaults to the invoice's locked credit amount. */
  creditCents?: number
  /** What actually arrived on chain, when known. */
  receivedE4?: number
  /** The transaction hash, recorded as the invoice's payment reference. */
  paymentReference?: string
  note?: string
  confirmedByUserId?: number
}

/** Trusted confirmation. Duplicate confirmation is a no-op. */
export function approveInvoice(
  reference: string,
  userId: number,
  providerChargeId?: string,
  settlement: Settlement = {},
): Invoice {
  return db().transaction(() => {
    const invoice = invoiceRow(reference, userId)
    if (!invoice) throw new PaymentError('No such invoice.')
    if (invoice.status === 'success') return getInvoice(reference, userId)!
    if (!['pending', 'review'].includes(invoice.status)) {
      throw new PaymentError(`Invoice cannot be confirmed while ${invoice.status}.`)
    }

    const creditCents = settlement.creditCents ?? invoice.credit_amount_cents
    if (!Number.isSafeInteger(creditCents) || creditCents <= 0) {
      throw new PaymentError('Nothing to credit for this payment.')
    }

    credit(userId, creditCents, 'topup', 'invoice', reference)
    const timestamp = new Date().toISOString()
    db()
      .prepare(
        `UPDATE invoices
            SET status = 'success',
                provider_charge_id = COALESCE(provider_charge_id, ?),
                payment_reference = COALESCE(?, payment_reference),
                note = COALESCE(?, note),
                received_e4 = COALESCE(?, received_e4),
                credited_cents = ?,
                confirmed_by_user_id = COALESCE(?, confirmed_by_user_id),
                paid_at = COALESCE(paid_at, ?),
                credited_at = COALESCE(credited_at, ?),
                updated_at = ?
          WHERE reference = ? AND user_id = ?`,
      )
      .run(
        providerChargeId ?? null,
        settlement.paymentReference ?? null,
        settlement.note ?? null,
        settlement.receivedE4 ?? null,
        creditCents,
        settlement.confirmedByUserId ?? null,
        timestamp,
        timestamp,
        timestamp,
        reference,
        userId,
      )
    return getInvoice(reference, userId)!
  })()
}

export function invoiceSummary(userId: number) {
  const rows = db()
    .prepare('SELECT status, COUNT(*) AS count FROM invoices WHERE user_id = ? GROUP BY status')
    .all(userId) as Array<{ status: Invoice['status']; count: number }>
  const by = new Map(rows.map((row) => [row.status, row.count]))
  return {
    successful: by.get('success') ?? 0,
    pendingReview: (by.get('pending') ?? 0) + (by.get('review') ?? 0),
    failed: by.get('failed') ?? 0,
    refunded: by.get('refunded') ?? 0,
    all: rows.reduce((sum, row) => sum + row.count, 0),
  }
}

export function shortReference(reference: string): string {
  return `#${reference.slice(0, 10).toUpperCase()}`
}

/** When an unpaid invoice closes and its amount stops matching. */
export function reservationEndsAt(invoice: Pick<Invoice, 'created_at'>): Date {
  return new Date(sqliteTime(invoice.created_at).getTime() + INVOICE_TTL_DAYS * 86_400_000)
}

/** SQLite's datetime('now') has no zone marker; it is UTC. */
export function sqliteTime(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`)
}
