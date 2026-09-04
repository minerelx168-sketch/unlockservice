import { db } from './db'

/**
 * Credit is escrowed, never deducted straight away.
 *
 *   available --hold--> held --charge--> spent
 *                        └---refund----> available
 *
 * users.credit_cents and users.held_cents remain the runtime balance contract.
 * The append-only ledger audits every transition and prevents duplicate
 * balance-changing effects for the same reference.
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
  if (row.held_cents < 0 || row.held_cents > row.credit_cents) {
    throw new Error(`credit invariant failed for user ${userId}`)
  }
  return {
    creditCents: row.credit_cents,
    heldCents: row.held_cents,
    availableCents: row.credit_cents - row.held_cents,
  }
}

/**
 * The balance as stored, with no assertion.
 *
 * getBalance refuses to answer when held exceeds credit, which is right
 * when money is about to move — the caller must not act on a balance that
 * cannot be true. But a customer looking at an order is not moving money,
 * and refusing to render their order because a number elsewhere is wrong
 * takes away the one page that would show them what happened. Reads take
 * this; anything that writes takes getBalance.
 */
export function readBalance(userId: number): Balance {
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

function affectsOwnedBalance(type: LedgerType): boolean {
  return type === 'topup' || type === 'charge' || type === 'adjustment'
}

function writeLedger(
  userId: number,
  amountCents: number,
  type: LedgerType,
  refType: string | null,
  refId: string | null,
  balanceAfter: number,
  description: string | null = null,
) {
  db()
    .prepare(
      `INSERT INTO credit_ledger
         (user_id, amount_cents, type, ref_type, ref_id,
          balance_after_cents, description, affects_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      amountCents,
      type,
      refType,
      refId,
      balanceAfter,
      description,
      affectsOwnedBalance(type) ? 1 : 0,
    )
}

export function hasCreditTransition(refType: string, refId: string, type: LedgerType): boolean {
  return Boolean(
    db()
      .prepare(
        `SELECT 1 FROM credit_ledger
          WHERE ref_type = ? AND ref_id = ? AND type = ?
          LIMIT 1`,
      )
      .get(refType, refId, type),
  )
}

/**
 * Raised when a hold is applied twice for the same reference.
 *
 * Charging and refunding are settlements, and a settlement that arrives
 * twice means the order already settled — returning the balance unchanged
 * is the right answer there, and it is what makes a retried poll harmless.
 * A hold is different: it happens once, against an order id that has just
 * been created, so a second one cannot be a retry of anything. Letting it
 * pass silently would hand out an order nobody reserved credit for.
 */
export class DuplicateLedgerEffect extends Error {
  constructor(
    readonly refType: string,
    readonly refId: string,
    readonly effect: LedgerType,
  ) {
    super(`a ${effect} effect already exists for ${refType} ${refId}`)
    this.name = 'DuplicateLedgerEffect'
  }
}

function refuseReplay(refType: string, refId: string, type: LedgerType) {
  if (hasCreditTransition(refType, refId, type)) throw new DuplicateLedgerEffect(refType, refId, type)
}

export class InsufficientCredit extends Error {
  constructor(readonly availableCents: number, readonly requiredCents: number) {
    super('Not enough credit for this service.')
    this.name = 'InsufficientCredit'
  }
}

export function hold(userId: number, amountCents: number, refType: string, refId: string): Balance {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('hold amount must be positive cents')
  return db().transaction(() => {
    refuseReplay(refType, refId, 'hold')
    const before = getBalance(userId)
    if (before.availableCents < amountCents) {
      throw new InsufficientCredit(before.availableCents, amountCents)
    }
    db().prepare('UPDATE users SET held_cents = held_cents + ? WHERE id = ?').run(amountCents, userId)
    const after = getBalance(userId)
    writeLedger(userId, -amountCents, 'hold', refType, refId, after.availableCents)
    return after
  })()
}

export function charge(userId: number, amountCents: number, refType: string, refId: string): Balance {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('charge amount must be positive cents')
  return db().transaction(() => {
    if (hasCreditTransition(refType, refId, 'charge')) return getBalance(userId)
    const before = getBalance(userId)
    if (before.heldCents < amountCents || before.creditCents < amountCents) {
      throw new Error('cannot charge more credit than is reserved')
    }
    db()
      .prepare('UPDATE users SET held_cents = held_cents - ?, credit_cents = credit_cents - ? WHERE id = ?')
      .run(amountCents, amountCents, userId)
    const after = getBalance(userId)
    writeLedger(userId, -amountCents, 'charge', refType, refId, after.availableCents)
    return after
  })()
}

export function refund(userId: number, amountCents: number, refType: string, refId: string): Balance {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('refund amount must be positive cents')
  return db().transaction(() => {
    if (hasCreditTransition(refType, refId, 'refund')) return getBalance(userId)
    const before = getBalance(userId)
    if (before.heldCents < amountCents) throw new Error('cannot release more credit than is reserved')
    db().prepare('UPDATE users SET held_cents = held_cents - ? WHERE id = ?').run(amountCents, userId)
    const after = getBalance(userId)
    writeLedger(userId, amountCents, 'refund', refType, refId, after.availableCents)
    return after
  })()
}

/** Adds credit once for a stable external reference. Duplicate settlement is a no-op. */
export function credit(
  userId: number,
  amountCents: number,
  type: Extract<LedgerType, 'topup' | 'adjustment'>,
  refType: string,
  refId: string,
): Balance {
  if (!Number.isSafeInteger(amountCents) || amountCents === 0) {
    throw new Error('credit amount must be a non-zero integer number of cents')
  }

  return db().transaction(() => {
    if (hasCreditTransition(refType, refId, type)) return getBalance(userId)
    const before = getBalance(userId)
    if (before.creditCents + amountCents < before.heldCents) {
      throw new InsufficientCredit(before.availableCents, Math.abs(amountCents))
    }
    db().prepare('UPDATE users SET credit_cents = credit_cents + ? WHERE id = ?').run(amountCents, userId)
    const after = getBalance(userId)
    writeLedger(userId, amountCents, type, refType, refId, after.availableCents)
    return after
  })()
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

export function listLedger(userId: number, limit = 50, offset = 0): LedgerRow[] {
  return db()
    .prepare(
      `SELECT id, amount_cents,
              CASE type WHEN 'bonus' THEN 'topup' ELSE type END AS type,
              CASE ref_type WHEN 'topup_order' THEN 'invoice' ELSE ref_type END AS ref_type,
              ref_id, balance_after_cents, created_at
         FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?`,
    )
    .all(userId, limit, offset) as LedgerRow[]
}

export function countLedger(userId: number): number {
  const row = db()
    .prepare('SELECT COUNT(*) AS count FROM credit_ledger WHERE user_id = ?')
    .get(userId) as { count: number }
  return row.count
}

export function creditSummary(userId: number) {
  const rows = db()
    .prepare(
      `SELECT CASE type WHEN 'bonus' THEN 'topup' ELSE type END AS type,
              SUM(amount_cents) AS total
         FROM credit_ledger
        WHERE user_id = ?
        GROUP BY CASE type WHEN 'bonus' THEN 'topup' ELSE type END`,
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

/** Read-only integrity signal used by the deployment health endpoint. */
export function creditIntegrity(): { users: number; mismatches: number; invalidHolds: number } {
  const row = db()
    .prepare(
      `SELECT
         COUNT(*) AS users,
         SUM(CASE WHEN u.credit_cents != COALESCE(l.balance, 0) THEN 1 ELSE 0 END) AS mismatches,
         SUM(CASE WHEN u.held_cents < 0 OR u.held_cents > u.credit_cents THEN 1 ELSE 0 END) AS invalid_holds
       FROM users u
       LEFT JOIN (
         SELECT user_id, SUM(amount_cents) AS balance
           FROM credit_ledger
          WHERE affects_balance = 1
          GROUP BY user_id
       ) l ON l.user_id = u.id`,
    )
    .get() as { users: number; mismatches: number | null; invalid_holds: number | null }
  return {
    users: Number(row.users),
    mismatches: Number(row.mismatches ?? 0),
    invalidHolds: Number(row.invalid_holds ?? 0),
  }
}
