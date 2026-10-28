import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { db } from './db'
import { AuthError, getUser, hashPassword, validatePassword, type User } from './auth'
import { consumeAttempt } from './rate-limit'

const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000
const NO_PASSWORD = '!guest-email-activation'
type Access = {
  reference: string; email: string; nonce: string; expires_at: string
  created_user_id: number | null; verified_user_id: number | null; consumed_at: string | null
}
type PaidOrder = { reference: string; email: string; state: string; paid_at: string | null; payment_id: string | null; review_reason: string | null }
type Account = User & { password_hash: string }

function paidOrder(reference: string) {
  return db().prepare('SELECT reference,email,state,paid_at,payment_id,review_reason FROM guest_checkouts WHERE reference=?').get(reference) as PaidOrder | undefined
}
function eligibleOrder(order: PaidOrder | undefined): order is PaidOrder {
  return !!order && !!order.paid_at && !!order.payment_id && !order.review_reason
    && ['paid', 'processing', 'completed', 'refund_pending', 'refunded'].includes(order.state)
}
function customer(email: string) {
  return db().prepare('SELECT * FROM users WHERE lower(email)=?').get(email) as Account | undefined
}
function eligibleCustomer(account: Account | undefined): account is Account {
  return !!account && account.account_type === 'customer' && account.status === 'active' && !account.banned_at
}
function tokenFor(row: Access) {
  const secret = process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET?.trim()
  if (!secret || secret.length < 32) throw new Error('Account activation unavailable.')
  return createHmac('sha256', secret).update(`guest-inbox-activation:v1:${row.reference}:${row.email}:${row.nonce}:${row.expires_at}`).digest('hex')
}
function access(reference: string) {
  return db().prepare('SELECT * FROM guest_account_access WHERE reference=?').get(reference) as Access | undefined
}

/** Called only after authoritative full payment. No session or existing-account ownership is granted here. */
export function prepareGuestAccount(reference: string): string | null {
  return db().transaction(() => {
    const order = paidOrder(reference)
    let row = access(reference)
    // Keep an already-issued email payload stable across delivery retries. An
    // expired/consumed link remains unusable in guestAccountActivation below.
    if (row) return order && row.email === order.email
      ? `/checkout/account/${row.reference}?token=${tokenFor(row)}` : null
    if (!eligibleOrder(order)) return null
    if (!row) {
      const account = customer(order.email)
      // Email text must never turn a guest payment into administrator or paused-account access.
      if (account && !eligibleCustomer(account)) return null
      let createdUserId: number | null = null
      if (!account) {
        // A disabled password and unverified address make this a pending customer profile.
        createdUserId = Number(db().prepare(`INSERT INTO users (username,email,password_hash,email_verified_at)
          VALUES (?,?,?,NULL)`).run(`customer-${randomBytes(10).toString('hex')}`, order.email, NO_PASSWORD).lastInsertRowid)
      }
      db().prepare(`INSERT INTO guest_account_access (reference,email,nonce,expires_at,created_user_id)
        VALUES (?,?,?,?,?)`).run(reference, order.email, randomBytes(32).toString('hex'), new Date(Date.now()+TOKEN_TTL_MS).toISOString(), createdUserId)
      row = access(reference)!
    }
    return `/checkout/account/${row.reference}?token=${tokenFor(row)}`
  }).immediate()
}

/** Read-only: email scanners and previews cannot consume a token or sign in. */
export function guestAccountActivation(reference: string, token: string, authenticatedUserId?: number) {
  if (!/^[a-f0-9]{32}$/.test(reference) || !/^[a-f0-9]{64}$/.test(token)) return null
  const row = access(reference), order = paidOrder(reference)
  if (!row || row.consumed_at || Date.parse(row.expires_at) <= Date.now() || !eligibleOrder(order) || order.email !== row.email) return null
  if (!timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(tokenFor(row), 'hex'))) return null
  const account = customer(row.email)
  if (!eligibleCustomer(account)) return null
  const createdHere = account.password_hash === NO_PASSWORD && !account.email_verified_at
    && !!db().prepare('SELECT 1 FROM guest_account_access WHERE created_user_id=? LIMIT 1').get(account.id)
  return { reference, email: row.email, canSetPassword: !account.email_verified_at || account.password_hash === NO_PASSWORD,
    requiresSignIn: !createdHere && authenticatedUserId !== account.id }
}

/** Inbox possession, not the browser checkout key, authorizes this atomic claim. */
export function activateGuestAccount(reference: string, token: string, password?: string, authenticatedUserId?: number) {
  if (!consumeAttempt('guest-account-activation', reference.slice(0,64), 10, 15*60)) throw new AuthError('Too many attempts. Please try again later.')
  if (password) validatePassword(password)
  return db().transaction(() => {
    const context = guestAccountActivation(reference, token, authenticatedUserId)
    if (!context) throw new AuthError('This account link has expired or has already been used. Your private order link still works.')
    if (context.requiresSignIn) throw new AuthError('Sign in to your existing account, or reset its password by email, before saving this order. Tracking does not require sign-in.')
    const row = access(reference)!, account = customer(row.email)!
    if (password && !context.canSetPassword) throw new AuthError('Use account settings to change your existing password.')
    // Prevent account pre-hijacking: a password entered before inbox ownership was
    // verified must not survive another person's successful email activation.
    if (!account.email_verified_at) {
      db().prepare('DELETE FROM sessions WHERE user_id=?').run(account.id)
      db().prepare("UPDATE email_verifications SET consumed_at=datetime('now') WHERE user_id=? AND consumed_at IS NULL").run(account.id)
      db().prepare('UPDATE users SET password_hash=?,email_verified_at=?,pending_email=NULL WHERE id=?')
        .run(password ? hashPassword(password) : NO_PASSWORD, new Date().toISOString(), account.id)
    } else if (password) {
      db().prepare('UPDATE users SET password_hash=? WHERE id=?').run(hashPassword(password), account.id)
      db().prepare('DELETE FROM sessions WHERE user_id=?').run(account.id)
    }
    const changed = db().prepare('UPDATE guest_account_access SET consumed_at=?,verified_user_id=? WHERE reference=? AND consumed_at IS NULL')
      .run(new Date().toISOString(), account.id, reference)
    if (changed.changes !== 1) throw new AuthError('This account link has already been used.')
    return getUser(account.id)!
  }).immediate()
}

export function listClaimedGuestOrders(userId: number) {
  const user = getUser(userId)
  if (!user || !user.email_verified_at || user.account_type !== 'customer' || user.status !== 'active' || user.banned_at) return []
  return db().prepare(`SELECT g.reference,g.product_name,g.price_cents,g.fee_cents,g.wallet_credit_cents,g.state,g.created_at
    FROM guest_checkouts g
    WHERE EXISTS (SELECT 1 FROM guest_account_access a WHERE a.reference=g.reference
      AND a.verified_user_id=? AND a.consumed_at IS NOT NULL)
      OR (g.customer_user_id=? AND g.paid_at IS NOT NULL AND g.payment_id IS NOT NULL
        AND g.state IN ('paid','processing','completed','refund_pending','refunded'))
    ORDER BY g.created_at DESC LIMIT 100`).all(userId,userId) as Array<{
      reference: string; product_name: string; price_cents: number; fee_cents: number; wallet_credit_cents: number; state: string; created_at: string
    }>
}
