import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { AuthError, getUser, hashPassword, type User, validatePassword } from './auth'
import { db } from './db'
import { consumeAttempt } from './rate-limit'

/** Optional account-security extensions around unlockservice's core auth model. */

const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const OTP_SEND_LIMIT = 3
const OTP_SEND_WINDOW_SECONDS = 5 * 60

type OtpPurpose = 'signup' | 'reset'

type VerificationRow = {
  user_id: number
  email_verified_at?: string | null
  verification_id: number | null
  code_hash: string | null
  attempts: number | null
  expires_at: string | null
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

function requireAttempt(bucket: string, subject: string, maxAttempts = 10, windowSeconds = 15 * 60) {
  if (!consumeAttempt(bucket, subject, maxAttempts, windowSeconds)) {
    throw new AuthError('Too many attempts. Please wait a few minutes and try again.')
  }
}

export function emailVerificationRequired(): boolean {
  return process.env.IUNLOCKMOBILE_REQUIRE_EMAIL_VERIFICATION === '1'
}

export function emailDeliveryConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.IUNLOCKMOBILE_EMAIL_FROM)
}

function requireEmailDelivery() {
  if (!emailDeliveryConfigured()) {
    throw new AuthError('Email delivery is not configured. Contact support.')
  }
}

async function sendEmail(to: string, subject: string, html: string, text: string) {
  requireEmailDelivery()
  const replyTo = process.env.IUNLOCKMOBILE_EMAIL_REPLY_TO?.trim()
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.IUNLOCKMOBILE_EMAIL_FROM,
      to: [to],
      ...(replyTo ? { reply_to: replyTo } : {}),
      subject,
      html,
      text,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    console.error('[account-security] email delivery failed', response.status, (await response.text()).slice(0, 300))
    throw new AuthError('We could not send the email right now. Please try again.')
  }
}

function issueOtp(userId: number, purpose: OtpPurpose): string {
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const expires = new Date(Date.now() + OTP_TTL_MINUTES * 60_000).toISOString()
  db()
    .prepare(
      `INSERT INTO email_verifications (user_id, code_hash, purpose, expires_at)
       VALUES (?, ?, ?, ?)`,
    )
    .run(userId, sha256(code), purpose, expires)
  return code
}

async function sendOtpEmail(email: string, code: string, purpose: OtpPurpose) {
  const action = purpose === 'signup' ? 'verify your email' : 'reset your password'
  const subject =
    purpose === 'signup'
      ? `iUnlockMobile verification code: ${code}`
      : `iUnlockMobile reset code: ${code}`
  const text = `Use ${code} to ${action}. It expires in ${OTP_TTL_MINUTES} minutes.`
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:32px"><h2>iUnlockMobile</h2><p>Use this code to ${action}. It expires in ${OTP_TTL_MINUTES} minutes.</p><div style="font-family:monospace;font-size:32px;font-weight:700;letter-spacing:.3em;padding:20px;background:#f3f4f6;border-radius:12px;text-align:center">${code}</div><p>If you did not request this, you can ignore this email.</p></div>`
  await sendEmail(email, subject, html, text)
}

export async function startEmailVerification(userId: number, email: string) {
  if (!emailVerificationRequired()) return
  requireEmailDelivery()
  const mail = normalizeEmail(email)
  requireAttempt('signup-send', mail, OTP_SEND_LIMIT, OTP_SEND_WINDOW_SECONDS)
  const code = issueOtp(userId, 'signup')
  await sendOtpEmail(mail, code, 'signup')
}

export async function resendVerification(email: string) {
  if (!emailVerificationRequired()) return
  requireEmailDelivery()
  const mail = normalizeEmail(email)
  requireAttempt('signup-send', mail, OTP_SEND_LIMIT, OTP_SEND_WINDOW_SECONDS)

  const user = db()
    .prepare('SELECT id, email_verified_at FROM users WHERE email = ? LIMIT 1')
    .get(mail) as { id: number; email_verified_at: string | null } | undefined
  if (!user) return
  if (user.email_verified_at) throw new AuthError('This email is already verified. Try signing in.')

  await sendOtpEmail(mail, issueOtp(user.id, 'signup'), 'signup')
}

function activeVerification(email: string, purpose: OtpPurpose): VerificationRow | undefined {
  return db()
    .prepare(
      `SELECT u.id AS user_id, u.email_verified_at, ev.id AS verification_id,
              ev.code_hash, ev.attempts, ev.expires_at
         FROM users u
         LEFT JOIN email_verifications ev
           ON ev.user_id = u.id AND ev.purpose = ? AND ev.consumed_at IS NULL
        WHERE u.email = ?
        ORDER BY ev.id DESC LIMIT 1`,
    )
    .get(purpose, normalizeEmail(email)) as VerificationRow | undefined
}

function consumeCode(row: VerificationRow, code: string): string | null {
  if (!row.verification_id || !row.code_hash || !row.expires_at) {
    return 'No active code for this email. Request a new one.'
  }
  if (new Date(row.expires_at).getTime() <= Date.now()) {
    db().prepare('UPDATE email_verifications SET consumed_at = ? WHERE id = ?').run(nowIso(), row.verification_id)
    return 'Code expired. Request a new one.'
  }

  const matches = timingSafeEqual(Buffer.from(row.code_hash, 'hex'), Buffer.from(sha256(code), 'hex'))
  if (!matches) {
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
      : 'Incorrect verification code.'
  }

  db()
    .prepare('UPDATE email_verifications SET consumed_at = ?, attempts = attempts + 1 WHERE id = ?')
    .run(nowIso(), row.verification_id)
  return null
}

export function verifyEmail(email: string, code: string): User {
  const mail = normalizeEmail(email)
  if (!/^\d{6}$/.test(code)) throw new AuthError('Code must be 6 digits.')
  requireAttempt('verify-code', mail)

  const result = db().transaction(() => {
    const row = activeVerification(mail, 'signup')
    if (!row) return { error: 'No active verification code for this email.' }
    if (row.email_verified_at) return { error: 'This email is already verified. Sign in with your password.' }

    const error = consumeCode(row, code)
    if (error) return { error }
    db()
      .prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?')
      .run(nowIso(), row.user_id)
    return { userId: row.user_id }
  })()

  if ('error' in result && result.error) throw new AuthError(result.error)
  const userId = 'userId' in result ? result.userId : null
  const user = typeof userId === 'number' ? getUser(userId) : undefined
  if (!user) throw new AuthError('Verification failed.')
  return user
}

export async function requestPasswordReset(email: string) {
  requireEmailDelivery()
  const mail = normalizeEmail(email)
  requireAttempt('reset-send', mail, OTP_SEND_LIMIT, OTP_SEND_WINDOW_SECONDS)

  const user = db().prepare('SELECT id FROM users WHERE email = ? LIMIT 1').get(mail) as { id: number } | undefined
  if (!user) return
  await sendOtpEmail(mail, issueOtp(user.id, 'reset'), 'reset')
}

export function resetPassword(email: string, code: string, password: string) {
  const mail = normalizeEmail(email)
  if (!/^\d{6}$/.test(code)) throw new AuthError('Code must be 6 digits.')
  validatePassword(password)
  requireAttempt('reset-code', mail)

  const error = db().transaction(() => {
    const row = activeVerification(mail, 'reset')
    if (!row) return 'No active reset code for this email. Request a new one.'
    const verificationError = consumeCode(row, code)
    if (verificationError) return verificationError

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
