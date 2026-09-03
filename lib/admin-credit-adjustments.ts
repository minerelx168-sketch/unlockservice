import { randomUUID } from 'node:crypto'
import { db } from './db'
import { credit, getBalance, type Balance, InsufficientCredit } from './credits'
import { getUser, hasAdminRole } from './auth'
import { consumeAttempt } from './rate-limit'

const MAX_ADJUSTMENT_CENTS = 1_000_000
const IDEMPOTENCY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/

export type AdminCreditAdjustmentCode =
  | 'forbidden'
  | 'invalid_amount'
  | 'invalid_reason'
  | 'invalid_idempotency'
  | 'user_not_found'
  | 'held_credit_conflict'
  | 'idempotency_conflict'
  | 'rate_limited'

export class AdminCreditAdjustmentError extends Error {
  constructor(
    message: string,
    readonly code: AdminCreditAdjustmentCode,
  ) {
    super(message)
    this.name = 'AdminCreditAdjustmentError'
  }
}

export type AdminCreditAdjustmentInput = {
  targetUserId: number
  amountCents: number
  reason: string
  idempotencyKey: string
}

export type AdminCreditAdjustmentRow = {
  id: number
  public_id: string
  admin_user_id: number
  admin_username: string
  target_user_id: number
  target_username: string
  target_email: string
  amount_cents: number
  reason: string
  idempotency_key: string
  credit_before_cents: number
  held_before_cents: number
  credit_after_cents: number
  held_after_cents: number
  created_at: string
}

export type AdminCreditAdjustmentResult = {
  adjustment: AdminCreditAdjustmentRow
  balance: Balance
  replayed: boolean
}

const ADJUSTMENT_SELECT = `
  SELECT a.id, a.public_id, a.admin_user_id, admin.username AS admin_username,
         a.target_user_id, target.username AS target_username, target.email AS target_email,
         a.amount_cents, a.reason, a.idempotency_key,
         a.credit_before_cents, a.held_before_cents,
         a.credit_after_cents, a.held_after_cents, a.created_at
    FROM admin_credit_adjustments a
    JOIN users admin ON admin.id = a.admin_user_id
    JOIN users target ON target.id = a.target_user_id`

function cleanReason(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}

function getAdjustmentByAdminKey(adminUserId: number, idempotencyKey: string) {
  return db()
    .prepare(`${ADJUSTMENT_SELECT} WHERE a.admin_user_id = ? AND a.idempotency_key = ? LIMIT 1`)
    .get(adminUserId, idempotencyKey) as AdminCreditAdjustmentRow | undefined
}

function validateInput(input: AdminCreditAdjustmentInput) {
  if (!Number.isSafeInteger(input.targetUserId) || input.targetUserId <= 0) {
    throw new AdminCreditAdjustmentError('Choose a valid user account.', 'user_not_found')
  }
  if (
    !Number.isSafeInteger(input.amountCents)
    || input.amountCents === 0
    || Math.abs(input.amountCents) > MAX_ADJUSTMENT_CENTS
  ) {
    throw new AdminCreditAdjustmentError('Enter a non-zero amount up to USD 10,000.00.', 'invalid_amount')
  }
  const reason = cleanReason(input.reason)
  if (reason.length < 8 || reason.length > 240) {
    throw new AdminCreditAdjustmentError('Enter a reason between 8 and 240 characters.', 'invalid_reason')
  }
  const idempotencyKey = input.idempotencyKey.trim()
  if (!IDEMPOTENCY_PATTERN.test(idempotencyKey)) {
    throw new AdminCreditAdjustmentError('The request key is invalid. Reload and try again.', 'invalid_idempotency')
  }
  return { reason, idempotencyKey }
}

export function adjustUserCredit(
  adminUserId: number,
  input: AdminCreditAdjustmentInput,
): AdminCreditAdjustmentResult {
  const admin = getUser(adminUserId)
  if (!admin || !hasAdminRole(admin)) {
    throw new AdminCreditAdjustmentError('Administrator access is required.', 'forbidden')
  }

  const { reason, idempotencyKey } = validateInput(input)
  const existing = getAdjustmentByAdminKey(adminUserId, idempotencyKey)
  if (existing) {
    if (
      existing.target_user_id !== input.targetUserId
      || existing.amount_cents !== input.amountCents
      || existing.reason !== reason
    ) {
      throw new AdminCreditAdjustmentError(
        'That request key was already used for a different adjustment.',
        'idempotency_conflict',
      )
    }
    return { adjustment: existing, balance: getBalance(existing.target_user_id), replayed: true }
  }

  if (!consumeAttempt('admin-credit-adjustment', String(adminUserId), 20, 10 * 60)) {
    throw new AdminCreditAdjustmentError('Too many credit adjustments. Wait and try again.', 'rate_limited')
  }

  try {
    return db().transaction(() => {
      const replay = getAdjustmentByAdminKey(adminUserId, idempotencyKey)
      if (replay) {
        if (
          replay.target_user_id !== input.targetUserId
          || replay.amount_cents !== input.amountCents
          || replay.reason !== reason
        ) {
          throw new AdminCreditAdjustmentError(
            'That request key was already used for a different adjustment.',
            'idempotency_conflict',
          )
        }
        return { adjustment: replay, balance: getBalance(replay.target_user_id), replayed: true }
      }

      const target = getUser(input.targetUserId)
      if (!target) throw new AdminCreditAdjustmentError('No such user account.', 'user_not_found')

      const before = getBalance(target.id)
      if (before.creditCents + input.amountCents < before.heldCents) {
        throw new AdminCreditAdjustmentError(
          'This debit would reduce total credit below the amount currently held for orders.',
          'held_credit_conflict',
        )
      }

      const publicId = `aca_${randomUUID().replaceAll('-', '')}`
      const after = credit(
        target.id,
        input.amountCents,
        'adjustment',
        'admin_credit_adjustment',
        publicId,
      )
      db()
        .prepare(
          `INSERT INTO admin_credit_adjustments
             (public_id, admin_user_id, target_user_id, amount_cents, reason,
              idempotency_key, credit_before_cents, held_before_cents,
              credit_after_cents, held_after_cents)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          publicId,
          admin.id,
          target.id,
          input.amountCents,
          reason,
          idempotencyKey,
          before.creditCents,
          before.heldCents,
          after.creditCents,
          after.heldCents,
        )
      const adjustment = db()
        .prepare(`${ADJUSTMENT_SELECT} WHERE a.public_id = ? LIMIT 1`)
        .get(publicId) as AdminCreditAdjustmentRow
      return { adjustment, balance: after, replayed: false }
    })()
  } catch (error) {
    if (error instanceof InsufficientCredit) {
      throw new AdminCreditAdjustmentError(
        'This debit would reduce total credit below the amount currently held for orders.',
        'held_credit_conflict',
      )
    }
    throw error
  }
}

export function listAdminCreditAdjustments(limit = 25): AdminCreditAdjustmentRow[] {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
  return db()
    .prepare(`${ADJUSTMENT_SELECT} ORDER BY a.id DESC LIMIT ?`)
    .all(safeLimit) as AdminCreditAdjustmentRow[]
}
