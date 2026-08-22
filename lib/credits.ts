import { db } from './db'

/**
 * Credit is escrowed, never deducted straight away.
 *
 *   available --hold--> held --charge--> spent
 *                        └---refund----> available
 *
 * This is the single most important thing carried over from the observed
 * system: a provider that times out or errors must never cost the customer
 * anything, and the balance must never dip while a check is in flight.
 * Every transition writes a ledger row, so "credit purchased", "credit
 * used" and "credit restored" can be reported without guessing.
 */

export type LedgerType = 'topup' | 'hold' | 'charge' | 'refund' | 'adjustment'

export type Balance = {
  creditCents: number
  heldCents: number
  availableCents: number
}

export function getBalance(userId: number): Balance {
  const row = db()
    .prepare('SELECT credit_cents, held_cents FROM users WHERE id = ?')
    .get(userId) as { credit_cents: number; held_cents: number } | undefined
  if (!row) throw new Error(`no such user: ${userId}`)
  return {
    creditCents: row.credit_cents,
    heldCents: row.held_cents,
    availableCents: row.credit_cents - row.held_cents,
  }
}

function writeLedger(
  userId: number,
  amountCents: number,
  type: LedgerType,
  refType: string | null,
  refId: string | null,
  balanceAfter: number,
) {
  db()
    .prepare(
      `INSERT INTO credit_ledger
         (user_id, amount_cents, type, ref_type, ref_id, balance_after_cents)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(userId, amountCents, type, refType, refId, balanceAfter)
}

export class InsufficientCredit extends Error {
  constructor(readonly availableCents: number, readonly requiredCents: number) {
    super('Not enough credit for this service.')
    this.name = 'InsufficientCredit'
  }
}

/**
 * Reserves `amountCents`. Throws InsufficientCredit rather than letting the
 * balance go negative; the guard is inside the transaction so two checks
 * submitted at once cannot both pass it.
 */
export function hold(userId: number, amountCents: number, refType: string, refId: string): Balance {
  const run = db().transaction(() => {
    const before = getBalance(userId)
    if (before.availableCents < amountCents) {
      throw new InsufficientCredit(before.availableCents, amountCents)
    }
    db().prepare('UPDATE users SET held_cents = held_cents + ? WHERE id = ?').run(amountCents, userId)
    const after = getBalance(userId)
    writeLedger(userId, -amountCents, 'hold', refType, refId, after.availableCents)
    return after
  })
  return run()
}

/** Turns a hold into a real spend: the money leaves the account. */
export function charge(userId: number, amountCents: number, refType: string, refId: string): Balance {
  const run = db().transaction(() => {
    db()
      .prepare('UPDATE users SET held_cents = held_cents - ?, credit_cents = credit_cents - ? WHERE id = ?')
      .run(amountCents, amountCents, userId)
    const after = getBalance(userId)
    writeLedger(userId, -amountCents, 'charge', refType, refId, after.availableCents)
    return after
  })
  return run()
}

/** Releases a hold untouched — the customer is made whole. */
export function refund(userId: number, amountCents: number, refType: string, refId: string): Balance {
  const run = db().transaction(() => {
    db().prepare('UPDATE users SET held_cents = held_cents - ? WHERE id = ?').run(amountCents, userId)
    const after = getBalance(userId)
    writeLedger(userId, amountCents, 'refund', refType, refId, after.availableCents)
    return after
  })
  return run()
}

/** Adds credit — an approved top-up or an admin adjustment. */
export function credit(
  userId: number,
  amountCents: number,
  type: Extract<LedgerType, 'topup' | 'adjustment'>,
  refType: string,
  refId: string,
): Balance {
  const run = db().transaction(() => {
    db().prepare('UPDATE users SET credit_cents = credit_cents + ? WHERE id = ?').run(amountCents, userId)
    const after = getBalance(userId)
    writeLedger(userId, amountCents, type, refType, refId, after.availableCents)
    return after
  })
  return run()
}

export type LedgerRow = {
  id: number
  amount_cents: number
  type: LedgerType
  ref_type: string | null
  ref_id: string | null
  balance_after_cents: number
  created_at: string
}

export function listLedger(userId: number, limit = 50): LedgerRow[] {
  return db()
    .prepare('SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit) as LedgerRow[]
}

/** Totals the Payments page reports, split the way the observed one splits them. */
export function creditSummary(userId: number) {
  const rows = db()
    .prepare(
      `SELECT type, SUM(amount_cents) AS total
         FROM credit_ledger WHERE user_id = ? GROUP BY type`,
    )
    .all(userId) as Array<{ type: LedgerType; total: number }>
  const by = new Map(rows.map((row) => [row.type, row.total]))
  return {
    purchasedCents: by.get('topup') ?? 0,
    usedCents: -(by.get('charge') ?? 0),
    restoredCents: by.get('refund') ?? 0,
    adjustedCents: by.get('adjustment') ?? 0,
  }
}
