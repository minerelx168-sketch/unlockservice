import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { db } from './db'

/**
 * Session cookie plus a per-session CSRF token, matching the observed
 * system's shape: every mutating form and every AJAX call carries the
 * token, and the cookie itself is same-origin only.
 */

export const SESSION_COOKIE = 'openline_session'
const SESSION_DAYS = 14

export type User = {
  id: number
  username: string
  email: string
  credit_cents: number
  held_cents: number
  account_type: string
  membership_tier: string
  status: string
  created_at: string
}

/* ---- passwords ------------------------------------------------------- */

export function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const derived = scryptSync(password, salt, 64)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split('$')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false
  const expected = Buffer.from(hashHex, 'hex')
  const actual = scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length)
  return timingSafeEqual(expected, actual)
}

/* ---- accounts -------------------------------------------------------- */

export class AuthError extends Error {}

export function register(username: string, email: string, password: string): User {
  const clean = username.trim()
  const mail = email.trim().toLowerCase()
  if (clean.length < 3) throw new AuthError('Pick a username of at least 3 characters.')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new AuthError('Enter a valid email address.')
  if (password.length < 8) throw new AuthError('Use a password of at least 8 characters.')

  const taken = db()
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(clean, mail)
  if (taken) throw new AuthError('That username or email is already registered.')

  const info = db()
    .prepare('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)')
    .run(clean, mail, hashPassword(password))
  return getUser(Number(info.lastInsertRowid))!
}

export function authenticate(identity: string, password: string): User {
  const key = identity.trim().toLowerCase()
  const row = db()
    .prepare('SELECT * FROM users WHERE lower(username) = ? OR email = ?')
    .get(key, key) as (User & { password_hash: string }) | undefined
  if (!row || !verifyPassword(password, row.password_hash)) {
    throw new AuthError('Those details do not match an account.')
  }
  if (row.status !== 'active') throw new AuthError('This account is paused. Contact support.')
  return getUser(row.id)!
}

export function getUser(id: number): User | undefined {
  return db()
    .prepare(
      `SELECT id, username, email, credit_cents, held_cents, account_type,
              membership_tier, status, created_at
         FROM users WHERE id = ?`,
    )
    .get(id) as User | undefined
}

/* ---- sessions -------------------------------------------------------- */

export type Session = { id: string; userId: number; csrfToken: string }

export function createSession(userId: number): Session {
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

export async function setSessionCookie(session: Session) {
  const jar = await cookies()
  jar.set(SESSION_COOKIE, session.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_DAYS * 86_400,
  })
}

export async function clearSessionCookie() {
  const jar = await cookies()
  jar.delete(SESSION_COOKIE)
}

/** Resolves the caller, or null when signed out or expired. */
export async function currentSession(): Promise<{ session: Session; user: User } | null> {
  const jar = await cookies()
  const id = jar.get(SESSION_COOKIE)?.value
  if (!id) return null

  const row = db()
    .prepare('SELECT id, user_id, csrf_token, expires_at FROM sessions WHERE id = ?')
    .get(id) as { id: string; user_id: number; csrf_token: string; expires_at: string } | undefined
  if (!row) return null
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(row.id)
    return null
  }

  const user = getUser(row.user_id)
  if (!user) return null
  return { session: { id: row.id, userId: row.user_id, csrfToken: row.csrf_token }, user }
}

export async function requireSession() {
  const found = await currentSession()
  if (!found) throw new AuthError('Sign in to continue.')
  return found
}
