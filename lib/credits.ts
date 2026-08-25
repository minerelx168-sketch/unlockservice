import { db } from './db'

/**
 * Credit architecture adapted from imeihub while preserving unlockservice's
 * escrow model:
 *
 *   owned balance -> reserve -> charge on success
 *                            -> release on failure
 *
 * Balance-affecting ledger entries are append-only and are the source of
 * truth. Hold/release entries are audit events only and do not change owned
 * credit. The users.credit_cents column is a reconciled cache.
 */

export type LedgerType = 'topup' | 'bonus' | 'hold' | 'charge' | 'refund' | 'adjustment'

export type Balance = {
  creditCents: number
  heldCents: number
  availableCents: number
}

export type LedgerRow = {
  id: number
  amount_cents: number
  type: LedgerType
  ref_type: string | null
  ref_id: string | null
  balance_after_cents: number
  description: string | null
  affects_balance: number
  created_at: string
}

export class InsufficientCredit extends Error {
  constructor(readonly availableCents: number, readonly requiredCents: number) {
    super('Not enough credit for this service.')
    this.name = 'InsufficientCredit'
  }
}

function userBalances(userId: number): { cached: number; held: number } {
  const row = db()
    .prepare('SELECT credit_cents, held_cents FROM users WHERE id = ?')
    .get(userId) as { credit_cents: number; held_cents: number } | undefined
  if (!row) throw new Error(`no such user: ${userId}`)
  return { cached: row.credit_cents, held: row.held_cents }
}

function ledgerBalance(userId: number): number {
  const row = db()
    .prepare(
      `SELECT COALESCE(SUM(amount_cents), 0) AS balance
         FROM credit_ledger
        WHERE user_id = ? AND affects_balance = 1`,
    )
    .get(userId) as { balance: number }
  return Number(row.balance)
}

/** Reconciles the cache from the append-only ledger before returning it. */
export function getBalance(userId: number): Balance {
  const current = userBalances(userId)
  const sourceOfTruth = ledgerBalance(userId)
  if (current.cached !== sourceOfTruth) {
    db().prepare('UPDATE users SET credit_cents = ? WHERE id = ?').run(sourceOfTruth, userId)
  }
  if (current.held < 0 || current.held > sourceOfTruth) {
    throw new Error(`credit invariant failed for user ${userId}`)
  }
  return {
    creditCents: sourceOfTruth,
    heldCents: current.held,
    availableCents: sourceOfTruth - current.held,
  }
}

function appendLedger(input: {
  userId: number
  amountCents: number
  type: LedgerType
  refType: string | null
  refId: string | null
  balanceAfterCents: number
  description?: string | null
  affectsBalance: boolean
}) {
  db()
    .prepare(
      `INSERT INTO credit_ledger
         (user_id, amount_cents, type, ref_type, ref_id,
          balance_after_cents, description, affects_balance)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.userId,
      input.amountCents,
      input.type,
      input.refType,
      input.refId,
      input.balanceAfterCents,
      input.description ?? null,
      input.affectsBalance ? 1 : 0,
    )
}

/**
 * Adds owned credit exactly once per (reference type, reference id, ledger
 * type). This is the only primitive payment settlement should call.
 */
export function creditOnce(
  userId: number,
  amountCents: number,
  type: Extract<LedgerType, 'topup' | 'bonus' | 'adjustment'>,
  refType: string,
  refId: string,
  description?: string,
): { balance: Balance; creditedNow: boolean } {
  if (!Number.isSafeInteger(amountCents) || amountCents === 0) {
    throw new Error('credit amount must be a non-zero integer number of cents')
  }

  return db().transaction(() => {
    const existing = db()
      .prepare(
        `SELECT id FROM credit_ledger
          WHERE ref_type = ? AND ref_id = ? AND type = ? AND affects_balance = 1
          LIMIT 1`,
      )
      .get(refType, refId, type)
    if (existing) return { balance: getBalance(userId), creditedNow: false }

    const before = getBalance(userId)
    const afterOwned = before.creditCents + amountCents
    if (afterOwned < 0 || before.heldCents > afterOwned) {
      throw new InsufficientCredit(before.availableCents, Math.abs(amountCents))
    }

    appendLedger({
      userId,
      amountCents,
      type,
      refType,
      refId,
      balanceAfterCents: afterOwned,
      description,
      affectsBalance: true,
    })
    db().prepare('UPDATE users SET credit_cents = ? WHERE id = ?').run(afterOwned, userId)
    return {
      balance: { creditCents: afterOwned, heldCents: before.heldCents, availableCents: afterOwned - before.heldCents },
      creditedNow: true,
    }
  })()
}

/** Reserve available credit so concurrent orders cannot overspend it. */
export function hold(userId: number, amountCents: number, refType: string, refId: string): Balance {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('hold amount must be positive cents')
  return db().transaction(() => {
    const before = getBalance(userId)
    if (before.availableCents < amountCents) {
      throw new InsufficientCredit(before.availableCents, amountCents)
    }
    db().prepare('UPDATE users SET held_cents = held_cents + ? WHERE id = ?').run(amountCents, userId)
    const after: Balance = {
      creditCents: before.creditCents,
      heldCents: before.heldCents + amountCents,
      availableCents: before.availableCents - amountCents,
    }
    appendLedger({
      userId,
      amountCents: -amountCents,
      type: 'hold',
      refType,
      refId,
      balanceAfterCents: after.availableCents,
      description: 'Credit reserved for order',
      affectsBalance: false,
    })
    return after
  })()
}

/** Converts a reservation into an owned-credit deduction. */
export function charge(userId: number, amountCents: number, refType: string, refId: string): Balance {
  return db().transaction(() => {
    const before = getBalance(userId)
    if (before.heldCents < amountCents || before.creditCents < amountCents) {
      throw new Error('cannot charge more credit than is reserved')
    }
    const afterOwned = before.creditCents - amountCents
    const afterHeld = before.heldCents - amountCents
    appendLedger({
      userId,
      amountCents: -amountCents,
      type: 'charge',
      refType,
      refId,
      balanceAfterCents: afterOwned,
      description: 'Completed unlock order',
      affectsBalance: true,
    })
    db()
      .prepare('UPDATE users SET held_cents = ?, credit_cents = ? WHERE id = ?')
      .run(afterHeld, afterOwned, userId)
    return { creditCents: afterOwned, heldCents: afterHeld, availableCents: afterOwned - afterHeld }
  })()
}

/** Releases a reservation without changing owned credit. */
export function refund(userId: number, amountCents: number, refType: string, refId: string): Balance {
  return db().transaction(() => {
    const before = getBalance(userId)
    if (before.heldCents < amountCents) throw new Error('cannot release more credit than is reserved')
    const afterHeld = before.heldCents - amountCents
    db().prepare('UPDATE users SET held_cents = ? WHERE id = ?').run(afterHeld, userId)
    appendLedger({
      userId,
      amountCents,
      type: 'refund',
      refType,
      refId,
      balanceAfterCents: before.creditCents - afterHeld,
      description: 'Order reservation released',
      affectsBalance: false,
    })
    return {
      creditCents: before.creditCents,
      heldCents: afterHeld,
      availableCents: before.creditCents - afterHeld,
    }
  })()
}

/** Backward-compatible wrapper for existing call sites. */
export function credit(
  userId: number,
  amountCents: number,
  type: Extract<LedgerType, 'topup' | 'adjustment'>,
  refType: string,
  refId: string,
): Balance {
  return creditOnce(userId, amountCents, type, refType, refId).balance
}

export function listLedger(userId: number, limit = 50): LedgerRow[] {
  return db()
    .prepare('SELECT * FROM credit_ledger WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit) as LedgerRow[]
}

export function creditSummary(userId: number) {
  const rows = db()
    .prepare(
      `SELECT type, SUM(amount_cents) AS total
         FROM credit_ledger WHERE user_id = ? GROUP BY type`,
    )
    .all(userId) as Array<{ type: LedgerType; total: number }>
  const by = new Map(rows.map((row) => [row.type, row.total]))
  return {
    purchasedCents: (by.get('topup') ?? 0) + (by.get('bonus') ?? 0),
    usedCents: -(by.get('charge') ?? 0),
    restoredCents: by.get('refund') ?? 0,
    adjustedCents: by.get('adjustment') ?? 0,
  }
}

export function creditIntegrity(): { users: number; mismatches: number; invalidHolds: number } {
  const row = db()
    .prepare(
      `SELECT
         COUNT(*) AS users,
         SUM(CASE WHEN u.credit_cents != COALESCE(l.balance, 0) THEN 1 ELSE 0 END) AS mismatches,
         SUM(CASE WHEN u.held_cents < 0 OR u.held_cents > COALESCE(l.balance, 0) THEN 1 ELSE 0 END) AS invalid_holds
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

export function reconcileAllBalances(): { checked: number; repaired: number } {
  const users = db().prepare('SELECT id, credit_cents FROM users ORDER BY id').all() as Array<{
    id: number
    credit_cents: number
  }>
  let repaired = 0
  db().transaction(() => {
    for (const user of users) {
      const truth = ledgerBalance(user.id)
      if (truth !== user.credit_cents) {
        db().prepare('UPDATE users SET credit_cents = ? WHERE id = ?').run(truth, user.id)
        repaired += 1
      }
    }
  })()
  return { checked: users.length, repaired }
}
