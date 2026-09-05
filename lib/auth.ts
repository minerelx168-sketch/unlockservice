import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { redirect } from 'next/navigation'
import { SESSION_COOKIE } from './cookie-names'
import { db } from './db'
import { clearAttempts, consumeAttempt } from './rate-limit'

/**
 * Passwords, accounts and server-side sessions. Optional OTP verification and
 * password recovery live in account-security.ts so this module keeps the
 * original unlockservice contract.
 */

export { SESSION_COOKIE }

const SESSION_DAYS = 14

export type User = {
  id: number
  username: string
  email: string
  email_verified_at: string | null
  credit_cents: number
  held_cents: number
  account_type: string
  membership_tier: string
  status: string
  banned_at: string | null
  created_at: string
}

/* ---- passwords ------------------------------------------------------- */

export class AuthError extends Error {}

export function validatePassword(password: string) {
  if (password.length < 8) throw new AuthError('Use a password of at least 8 characters.')
  if (password.length > 256) throw new AuthError('Password is too long.')
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  if (expected.length === 0) return false
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(expected, actual)
}

/* ---- accounts -------------------------------------------------------- */

export function register(username: string, email: string, password: string): User {
  const clean = username.trim()
  const mail = email.trim().toLowerCase()
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(clean)) {
    throw new AuthError('Use 3–32 letters, numbers, dots, underscores or dashes for the username.')
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new AuthError('Enter a valid email address.')
  validatePassword(password)

  const verificationRequired = process.env.IUNLOCKMOBILE_REQUIRE_EMAIL_VERIFICATION === '1'
  if (verificationRequired && !(process.env.RESEND_API_KEY && process.env.IUNLOCKMOBILE_EMAIL_FROM)) {
    throw new AuthError('Registration is temporarily unavailable because email delivery is not configured.')
  }

  /* Separated so the message can name the username — which is public, and
     which the person has to change to get past this — without confirming
     that a given email address has an account here, which it cannot. */
  const usernameTaken = db().prepare('SELECT id FROM users WHERE lower(username) = lower(?)').get(clean)
  if (usernameTaken) throw new AuthError('That username is taken. Try another.')
  const emailTaken = db().prepare('SELECT id FROM users WHERE email = ?').get(mail)
  if (emailTaken) {
    throw new AuthError('That email cannot be used to register. Try signing in, or reset your password.')
  }

  const info = db()
    .prepare(
      `INSERT INTO users (username, email, password_hash, email_verified_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(clean, mail, hashPassword(password), verificationRequired ? null : new Date().toISOString())
  return getUser(Number(info.lastInsertRowid))!
}

export function authenticate(identity: string, password: string): User {
  const key = identity.trim().toLowerCase()
  if (!consumeAttempt('login', key || 'empty', 10, 15 * 60)) {
    throw new AuthError('Too many attempts. Please wait a few minutes and try again.')
  }

  const row = db()
    .prepare('SELECT * FROM users WHERE lower(username) = ? OR email = ? LIMIT 1')
    .get(key, key) as (User & { password_hash: string }) | undefined
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new AuthError('Those details do not match an account.')
  }
  const user = getUser(row.id)!
  assertSignInAllowed(user)
  clearAttempts('login', key || 'empty')
  return user
}

export function getUser(id: number): User | undefined {
  return db()
    .prepare(
      `SELECT id, username, email, email_verified_at, credit_cents, held_cents,
              account_type, membership_tier, status, banned_at, created_at
         FROM users WHERE id = ?`,
    )
    .get(id) as User | undefined
}

export function assertSignInAllowed(user: User): User {
  if (user.email_verified_at === null) {
    throw new AuthError('Please verify your email first. You can request a new code from the verification page.')
  }
  if (user.status !== 'active' || user.banned_at) throw new AuthError('This account is paused. Contact support.')
  return user
}

export function hasAdminRole(user: Pick<User, 'account_type'>): boolean {
  return user.account_type === 'admin'
}

/* ---- sessions -------------------------------------------------------- */

export type Session = { id: string; userId: number; csrfToken: string }

/**
 * Rows whose time has passed. Nothing read them any more — currentSession
 * checks expiry itself — but the tables only grew, and a signed-in session
 * is the natural moment to sweep: it is already a write, and it happens
 * often enough to keep up without a timer to install and forget.
 */
function sweepExpired() {
  const now = new Date().toISOString()
  db().prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now)
  db()
    .prepare(
      `DELETE FROM email_verifications
        WHERE expires_at <= ? OR (consumed_at IS NOT NULL AND consumed_at <= ?)`,
    )
    .run(now, new Date(Date.now() - 7 * 86_400_000).toISOString())
}

export function createSession(userId: number): Session {
  sweepExpired()
  const id = randomBytes(24).toString('hex')
  const csrfToken = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
  db()
    .prepare('INSERT INTO sessions (id, user_id, csrf_token, expires_at) VALUES (?, ?, ?, ?)')
    .run(id, userId, csrfToken, expires)
  return { id, userId, csrfToken }
}

export function destroySession(id: string) {
  db().prepare('DELETE FROM sessions WHERE id = ?').run(id)
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  }
}

export async function setSessionCookie(session: Session) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, session.id, sessionCookieOptions())
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

async function readSession(): Promise<{ session: Session; user: User } | null> {
  const jar = await cookies()
  const id = jar.get(SESSION_COOKIE)?.value
  if (!id || !/^[0-9a-f]{48,64}$/.test(id)) return null

  const row = db()
    .prepare('SELECT id, user_id, csrf_token, expires_at FROM sessions WHERE id = ?')
    .get(id) as { id: string; user_id: number; csrf_token: string; expires_at: string } | undefined
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(row.id)
    return null
  }

  const user = getUser(row.user_id)
  if (!user || user.status !== 'active' || user.banned_at || user.email_verified_at === null) return null
  return { session: { id: row.id, userId: row.user_id, csrfToken: row.csrf_token }, user }
}

/**
 * Resolves the caller, or null when signed out, paused, unverified or expired.
 *
 * Wrapped in React's per-request `cache` because a single page asks more
 * than once: the layout resolves it for the header and the footer, and the
 * page resolves it again for whatever it needs the CSRF token for — a
 * layout cannot hand a prop to a page. The scope is one request, so a
 * sign-in or sign-out is never answered from a previous one, and nothing
 * here writes a session and then reads it back inside the same request.
 */
export const currentSession = cache(readSession)

export async function requireSession() {
  const found = await currentSession()
  if (!found) redirect('/login')
  return found
}

/** Server-side RBAC guard. Regular users never receive administrator data. */
export async function requireAdmin() {
  const found = await requireSession()
  if (!hasAdminRole(found.user)) redirect('/user/dashboard')
  return found
}
