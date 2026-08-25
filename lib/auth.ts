import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { db } from './db'

/**
 * Server-side authentication adapted from imeihub's production model.
 * Session IDs and one-time codes are opaque; only hashes of OTPs are stored.
 */

export const SESSION_COOKIE = 'iunlockmobile_session'
const SESSION_DAYS = 14
const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const OTP_SEND_WINDOW_SECONDS = 300
const OTP_SEND_LIMIT = 3

export type User = {
  id: number
  username: string
  email: string
  display_name: string | null
  email_verified_at: string | null
  credit_cents: number
  held_cents: number
  account_type: string
  membership_tier: string
  status: string
  is_admin: number
  banned_at: string | null
  created_at: string
}

export type RegistrationResult = {
  user: User
  verificationRequired: boolean
}

export type Session = {
  id: string
  userId: number
  csrfToken: string
}

export class AuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuthError'
  }
}

/* ---- configuration ---------------------------------------------------- */

export function emailVerificationRequired(): boolean {
  return process.env.IUNLOCKMOBILE_REQUIRE_EMAIL_VERIFICATION === '1'
}

function resendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.IUNLOCKMOBILE_EMAIL_FROM)
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function nowIso(): string {
  return new Date().toISOString()
}

function addSecondsIso(seconds: number): string {
  return new Date(Date.now() + seconds * 1000).toISOString()
}

/* ---- passwords -------------------------------------------------------- */

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

function validatePassword(password: string) {
  if (password.length < 8) throw new AuthError('Use a password of at least 8 characters.')
  if (password.length > 256) throw new AuthError('Password is too long.')
}

/* ---- rate limits ------------------------------------------------------ */

function clearRateLimit(bucket: string, subject: string) {
  db()
    .prepare('DELETE FROM auth_rate_limits WHERE bucket = ? AND subject_hash = ?')
    .run(bucket, sha256(subject.trim().toLowerCase()))
}

function consumeRateLimit(bucket: string, subject: string, maxAttempts: number, windowSeconds: number) {
  const subjectHash = sha256(subject.trim().toLowerCase())
  const now = Date.now()

  const allowed = db().transaction(() => {
    const row = db()
      .prepare('SELECT window_start, attempts FROM auth_rate_limits WHERE bucket = ? AND subject_hash = ?')
      .get(bucket, subjectHash) as { window_start: string; attempts: number } | undefined

    if (!row || now - new Date(row.window_start).getTime() >= windowSeconds * 1000) {
      db()
        .prepare(
          `INSERT INTO auth_rate_limits (bucket, subject_hash, window_start, attempts)
           VALUES (?, ?, ?, 1)
           ON CONFLICT(bucket, subject_hash)
           DO UPDATE SET window_start = excluded.window_start, attempts = 1`,
        )
        .run(bucket, subjectHash, nowIso())
      return true
    }

    if (row.attempts >= maxAttempts) return false
    db()
      .prepare('UPDATE auth_rate_limits SET attempts = attempts + 1 WHERE bucket = ? AND subject_hash = ?')
      .run(bucket, subjectHash)
    return true
  })()

  if (!allowed) throw new AuthError('Too many attempts. Please wait a few minutes and try again.')
}

/* ---- email delivery --------------------------------------------------- */

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<void> {
  if (!resendConfigured()) {
    throw new AuthError('Email verification is not configured. Contact support.')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.IUNLOCKMOBILE_EMAIL_FROM,
      to: [to],
      subject,
      html,
      text,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    console.error('[auth] email delivery failed', response.status, (await response.text()).slice(0, 300))
    throw new AuthError('We could not send the email right now. Please try again.')
  }
}

async function sendOtpEmail(email: string, code: string, purpose: 'signup' | 'reset') {
  const appName = 'iUnlockMobile'
  const action = purpose === 'signup' ? 'verify your email' : 'reset your password'
  const subject = purpose === 'signup' ? `${appName} verification code: ${code}` : `${appName} reset code: ${code}`
  const text = `Use ${code} to ${action}. It expires in ${OTP_TTL_MINUTES} minutes.`
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:32px"><h2>${appName}</h2><p>Use this code to ${action}. It expires in ${OTP_TTL_MINUTES} minutes.</p><div style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:.3em;padding:20px;background:#f3f4f6;border-radius:12px;text-align:center">${code}</div><p>If you did not request this, you can ignore this email.</p></div>`
  await sendEmail(email, subject, html, text)
}

function issueOtp(userId: number, purpose: 'signup' | 'reset'): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  db()
    .prepare(
      `INSERT INTO email_verifications (user_id, code_hash, purpose, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(userId, sha256(code), purpose, addSecondsIso(OTP_TTL_MINUTES * 60))
  return code
}

/* ---- accounts --------------------------------------------------------- */

export async function register(username: string, email: string, password: string): Promise<RegistrationResult> {
  const clean = username.trim()
  const mail = normalizeEmail(email)
  if (!/^[A-Za-z0-9._-]{3,32}$/.test(clean)) {
    throw new AuthError('Use 3–32 letters, numbers, dots, underscores or dashes for the username.')
  }
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(mail)) throw new AuthError('Enter a valid email address.')
  validatePassword(password)

  const verificationRequired = emailVerificationRequired()
  if (verificationRequired && !resendConfigured()) {
    throw new AuthError('Registration is temporarily unavailable because email delivery is not configured.')
  }
  if (verificationRequired) consumeRateLimit('signup-send', mail, OTP_SEND_LIMIT, OTP_SEND_WINDOW_SECONDS)

  const result = db().transaction(() => {
    const emailAccount = db()
      .prepare('SELECT id, username, email_verified_at FROM users WHERE email = ? LIMIT 1')
      .get(mail) as { id: number; username: string; email_verified_at: string | null } | undefined
    const usernameAccount = db()
      .prepare('SELECT id FROM users WHERE lower(username) = lower(?) LIMIT 1')
      .get(clean) as { id: number } | undefined

    if (emailAccount?.email_verified_at) throw new AuthError('That email is already registered. Try signing in.')
    if (usernameAccount && usernameAccount.id !== emailAccount?.id) {
      throw new AuthError('That username is already registered.')
    }

    let userId: number
    if (emailAccount) {
      db()
        .prepare(
          `UPDATE users
              SET username = ?, password_hash = ?, status = 'active',
                  email_verified_at = CASE WHEN ? = 1 THEN NULL ELSE COALESCE(email_verified_at, ?) END
            WHERE id = ?`,
        )
        .run(clean, hashPassword(password), verificationRequired ? 1 : 0, nowIso(), emailAccount.id)
      userId = emailAccount.id
    } else {
      const info = db()
        .prepare(
          `INSERT INTO users (username, email, password_hash, email_verified_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(clean, mail, hashPassword(password), verificationRequired ? null : nowIso())
      userId = Number(info.lastInsertRowid)
    }

    const code = verificationRequired ? issueOtp(userId, 'signup') : null
    return { userId, code }
  })()

  if (result.code) await sendOtpEmail(mail, result.code, 'signup')
  return { user: getUser(result.userId)!, verificationRequired }
}

export function authenticate(identity: string, password: string): User {
  const key = identity.trim().toLowerCase()
  consumeRateLimit('login', key || 'empty', 10, 15 * 60)

  const row = db()
    .prepare('SELECT * FROM users WHERE lower(username) = ? OR email = ? LIMIT 1')
    .get(key, key) as (User & { password_hash: string }) | undefined
  if (!row || !verifyPassword(password, row.password_hash)) {
    if (!row) verifyPassword(password, hashPassword('constant-time-placeholder'))
    throw new AuthError('Incorrect username/email or password.')
  }
  if (row.email_verified_at === null) {
    throw new AuthError('Please verify your email first. You can request a new code from the verification page.')
  }
  if (row.status !== 'active' || row.banned_at) throw new AuthError('This account is paused. Contact support.')
  clearRateLimit('login', key || 'empty')
  return getUser(row.id)!
}

export function getUser(id: number): User | undefined {
  return db()
    .prepare(
      `SELECT id, username, email, display_name, email_verified_at,
              credit_cents, held_cents, account_type, membership_tier,
              status, is_admin, banned_at, created_at
         FROM users WHERE id = ?`,
    )
    .get(id) as User | undefined
}

export async function verifyEmail(email: string, code: string): Promise<User> {
  const mail = normalizeEmail(email)
  if (!/^\d{6}$/.test(code)) throw new AuthError('Code must be 6 digits.')
  consumeRateLimit('verify-code', mail, 10, 15 * 60)

  const result = db().transaction(() => {
    const row = db()
      .prepare(
        `SELECT u.id AS user_id, u.email_verified_at, ev.id AS verification_id,
                ev.code_hash, ev.attempts, ev.expires_at
           FROM users u
           LEFT JOIN email_verifications ev
             ON ev.user_id = u.id AND ev.purpose = 'signup' AND ev.consumed_at IS NULL
          WHERE u.email = ?
          ORDER BY ev.id DESC LIMIT 1`,
      )
      .get(mail) as
      | {
          user_id: number
          email_verified_at: string | null
          verification_id: number | null
          code_hash: string | null
          attempts: number | null
          expires_at: string | null
        }
      | undefined

    if (!row) return { error: 'No active verification code for this email.' }
    if (row.email_verified_at) return { userId: row.user_id }
    if (!row.verification_id || !row.code_hash || !row.expires_at) {
      return { error: 'No active verification code for this email. Request a new one.' }
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      db().prepare('UPDATE email_verifications SET consumed_at = ? WHERE id = ?').run(nowIso(), row.verification_id)
      return { error: 'Code expired. Request a new one.' }
    }
    if (!timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(sha256(code), 'hex'))) {
      const attempts = (row.attempts ?? 0) + 1
      db()
        .prepare(
          `UPDATE email_verifications
              SET attempts = ?, consumed_at = CASE WHEN ? >= ? THEN ? ELSE consumed_at END
            WHERE id = ?`,
        )
        .run(attempts, attempts, OTP_MAX_ATTEMPTS, nowIso(), row.verification_id)
      return {
        error:
          attempts >= OTP_MAX_ATTEMPTS
            ? 'Too many wrong attempts. Request a new code.'
            : 'Incorrect verification code.',
      }
    }

    db().prepare('UPDATE email_verifications SET consumed_at = ?, attempts = attempts + 1 WHERE id = ?').run(nowIso(), row.verification_id)
    db().prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?').run(nowIso(), row.user_id)
    return { userId: row.user_id }
  })()

  if ('error' in result && result.error) throw new AuthError(result.error)
  const userId = 'userId' in result ? result.userId : null
  if (typeof userId !== 'number') throw new AuthError('Verification failed.')
  return getUser(userId)!
}

export async function resendVerification(email: string): Promise<void> {
  const mail = normalizeEmail(email)
  if (!emailVerificationRequired()) return
  if (!resendConfigured()) throw new AuthError('Email delivery is not configured. Contact support.')
  consumeRateLimit('signup-send', mail, OTP_SEND_LIMIT, OTP_SEND_WINDOW_SECONDS)

  const user = db()
    .prepare('SELECT id, email_verified_at FROM users WHERE email = ? LIMIT 1')
    .get(mail) as { id: number; email_verified_at: string | null } | undefined
  if (!user) return
  if (user.email_verified_at) throw new AuthError('This email is already verified. Try signing in.')

  const code = issueOtp(user.id, 'signup')
  await sendOtpEmail(mail, code, 'signup')
}

export async function requestPasswordReset(email: string): Promise<void> {
  const mail = normalizeEmail(email)
  if (!resendConfigured()) throw new AuthError('Password reset email is not configured. Contact support.')
  consumeRateLimit('reset-send', mail, OTP_SEND_LIMIT, OTP_SEND_WINDOW_SECONDS)

  const user = db().prepare('SELECT id FROM users WHERE email = ? LIMIT 1').get(mail) as { id: number } | undefined
  if (!user) return
  const code = issueOtp(user.id, 'reset')
  await sendOtpEmail(mail, code, 'reset')
}

export function resetPassword(email: string, code: string, password: string): void {
  const mail = normalizeEmail(email)
  if (!/^\d{6}$/.test(code)) throw new AuthError('Code must be 6 digits.')
  validatePassword(password)
  consumeRateLimit('reset-code', mail, 10, 15 * 60)

  const error = db().transaction(() => {
    const row = db()
      .prepare(
        `SELECT u.id AS user_id, ev.id AS verification_id, ev.code_hash,
                ev.attempts, ev.expires_at
           FROM users u
           LEFT JOIN email_verifications ev
             ON ev.user_id = u.id AND ev.purpose = 'reset' AND ev.consumed_at IS NULL
          WHERE u.email = ?
          ORDER BY ev.id DESC LIMIT 1`,
      )
      .get(mail) as
      | {
          user_id: number
          verification_id: number | null
          code_hash: string | null
          attempts: number | null
          expires_at: string | null
        }
      | undefined

    if (!row?.verification_id || !row.code_hash || !row.expires_at) {
      return 'No active reset code for this email. Request a new one.'
    }
    if (new Date(row.expires_at).getTime() <= Date.now()) {
      db().prepare('UPDATE email_verifications SET consumed_at = ? WHERE id = ?').run(nowIso(), row.verification_id)
      return 'Code expired. Request a new one.'
    }
    if (!timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(sha256(code), 'hex'))) {
      const attempts = (row.attempts ?? 0) + 1
      db()
        .prepare(
          `UPDATE email_verifications
              SET attempts = ?, consumed_at = CASE WHEN ? >= ? THEN ? ELSE consumed_at END
            WHERE id = ?`,
        )
        .run(attempts, attempts, OTP_MAX_ATTEMPTS, nowIso(), row.verification_id)
      return attempts >= OTP_MAX_ATTEMPTS
        ? 'Too many wrong attempts. Request a new code.'
        : 'Incorrect reset code.'
    }

    db().prepare('UPDATE email_verifications SET consumed_at = ?, attempts = attempts + 1 WHERE id = ?').run(nowIso(), row.verification_id)
    db()
      .prepare(
        `UPDATE users
            SET password_hash = ?, email_verified_at = COALESCE(email_verified_at, ?)
          WHERE id = ?`,
      )
      .run(hashPassword(password), nowIso(), row.user_id)
    db().prepare('DELETE FROM sessions WHERE user_id = ?').run(row.user_id)
    return null
  })()

  if (error) throw new AuthError(error)
}

/* ---- sessions --------------------------------------------------------- */

export function createSession(
  userId: number,
  metadata: { userAgent?: string; ipAddress?: string } = {},
): Session {
  const id = randomBytes(32).toString('hex')
  const csrfToken = randomBytes(32).toString('hex')
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000).toISOString()
  db()
    .prepare(
      `INSERT INTO sessions
         (id, user_id, csrf_token, expires_at, last_seen_at, user_agent, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      id,
      userId,
      csrfToken,
      expires,
      nowIso(),
      metadata.userAgent?.slice(0, 255) || null,
      metadata.ipAddress?.slice(0, 64) || null,
    )
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

/** Resolves the caller, or null when signed out, banned or expired. */
export async function currentSession(): Promise<{ session: Session; user: User } | null> {
  const jar = await cookies()
  const id = jar.get(SESSION_COOKIE)?.value
  if (!id || !/^[0-9a-f]{64}$/.test(id)) return null

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
  db().prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(nowIso(), row.id)
  return { session: { id: row.id, userId: row.user_id, csrfToken: row.csrf_token }, user }
}

export async function requireSession() {
  const found = await currentSession()
  if (!found) redirect('/login')
  return found
}
