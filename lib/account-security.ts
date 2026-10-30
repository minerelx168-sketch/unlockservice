import { createHash, randomInt, timingSafeEqual } from 'node:crypto'
import { AuthError, getUser, hashPassword, type User, validatePassword, verifyPassword } from './auth'
import { db } from './db'
import { consumeAttempt } from './rate-limit'

/** Optional account-security extensions around unlockservice's core auth model. */

const OTP_TTL_MINUTES = 10
const OTP_MAX_ATTEMPTS = 5
const OTP_SEND_LIMIT = 3
const OTP_SEND_WINDOW_SECONDS = 5 * 60

type OtpPurpose = 'signup' | 'reset' | 'email_change'

export class MarketingEmailError extends Error {
  constructor(readonly status: number | null, readonly uncertain: boolean) {
    super('Marketing email delivery failed.')
    this.name = 'MarketingEmailError'
  }
}

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

async function sendEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  options: { replyTo?: string; idempotencyKey?: string; headers?: Record<string, string>; marketing?: boolean } = {},
) {
  requireEmailDelivery()
  /* A per-message reply-to for mail that is a conversation — a contact
     form is answered by replying to the customer, not to us. */
  const replyTo = options.replyTo?.trim() || process.env.IUNLOCKMOBILE_EMAIL_REPLY_TO?.trim()
  let response: Response
  try {
    response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        ...(options.idempotencyKey ? { 'Idempotency-Key': options.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.IUNLOCKMOBILE_EMAIL_FROM,
        to: [to],
        ...(replyTo ? { reply_to: replyTo } : {}),
        subject,
        html,
        text,
        ...(options.headers ? { headers: options.headers } : {}),
      }),
      cache: 'no-store',
      ...(options.marketing ? { redirect: 'error' as const } : {}),
      // Bound delivery attempts so an email cannot hold a worker indefinitely.
      signal: AbortSignal.timeout(10_000),
    })
  } catch (error) {
    if (options.marketing) throw new MarketingEmailError(null, true)
    throw error
  }

  if (!response.ok) {
    /* The status is the diagnostic. The body echoes the recipient address
       back, and a log line is not the place for one. */
    if (options.marketing) {
      const uncertain = response.status === 408 || response.status === 409 || response.status >= 500
      throw new MarketingEmailError(response.status, uncertain)
    }
    console.error('[account-security] email delivery failed', response.status)
    throw new AuthError('We could not send the email right now. Please try again.')
  }

  if (options.marketing) {
    try {
      const receipt: unknown = await response.json()
      if (!receipt || typeof receipt !== 'object' || !('id' in receipt) || typeof receipt.id !== 'string' || !receipt.id.trim()) {
        throw new Error('provider_receipt_missing')
      }
      return { providerMessageId: receipt.id }
    } catch {
      throw new MarketingEmailError(null, true)
    }
  }
}

/**
 * Delivery for mail that is not account security.
 *
 * Exported so there is still exactly one place that knows how mail leaves
 * this system — the alternative was a second fetch to Resend somewhere
 * else, with its own idea of what happens when the key is missing.
 */
export async function sendTransactionalEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  options: { replyTo?: string; idempotencyKey?: string } = {},
) {
  await sendEmail(to, subject, html, text, options)
}

/** Marketing mail keeps the same Resend boundary and adds one-click unsubscribe headers. */
export async function sendMarketingEmail(
  to: string,
  subject: string,
  html: string,
  text: string,
  options: { idempotencyKey: string; unsubscribeUrl: string },
): Promise<{ providerMessageId: string }> {
  return (await sendEmail(to, subject, html, text, {
    idempotencyKey: options.idempotencyKey,
    marketing: true,
    headers: {
      'List-Unsubscribe': `<${options.unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })) as { providerMessageId: string }
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
  const action =
    purpose === 'signup' ? 'verify your email' : purpose === 'reset' ? 'reset your password' : 'confirm your new email address'
  const subject =
    purpose === 'signup'
      ? `iUnlockMobile verification code: ${code}`
      : purpose === 'reset'
        ? `iUnlockMobile reset code: ${code}`
        : `iUnlockMobile email change code: ${code}`
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
  /* Returns the same way whether the address is unknown or already
     verified. Saying "already verified" told anyone who asked that an
     account exists — the one thing requestPasswordReset below is careful
     not to say. */
  if (!user || user.email_verified_at) return

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
    cancelEmailChange(row.user_id)
    return null
  })()

  if (error) throw new AuthError(error)
}

/* ---- changes made while signed in ----------------------------------- */

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Step one of changing the address: the code goes to the NEW inbox, so
 * only someone who controls it can finish. The current address keeps
 * receiving everything until the code is confirmed.
 */
function requireCurrentPassword(userId: number, current: string) {
  requireAttempt('email-change-reauth', String(userId), 10, OTP_SEND_WINDOW_SECONDS)
  const row = db().prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined
  if (!row || !verifyPassword(current, row.password_hash)) throw new AuthError('The current password is not right.')
}

export async function startEmailChange(userId: number, requested: string, current: string) {
  requireEmailDelivery()
  requireCurrentPassword(userId, current)
  const mail = normalizeEmail(requested)
  if (!EMAIL_SHAPE.test(mail) || mail.length > 254) throw new AuthError('Enter a valid email address.')
  const user = getUser(userId)
  if (!user) throw new AuthError('Sign in again to change your email.')
  if (mail === normalizeEmail(user.email)) throw new AuthError('That is already the address on this account.')
  requireAttempt('email-change-send', String(userId), OTP_SEND_LIMIT, OTP_SEND_WINDOW_SECONDS)
  if (db().prepare('SELECT 1 FROM users WHERE lower(email) = ? AND id <> ?').get(mail, userId)) {
    throw new AuthError('That address cannot be used on this account.')
  }
  db()
    .prepare("UPDATE email_verifications SET consumed_at = ? WHERE user_id = ? AND purpose = 'email_change' AND consumed_at IS NULL")
    .run(nowIso(), userId)
  db().prepare('UPDATE users SET pending_email = ? WHERE id = ?').run(mail, userId)
  await sendOtpEmail(mail, issueOtp(userId, 'email_change'), 'email_change')
}

export function cancelEmailChange(userId: number) {
  db()
    .prepare("UPDATE email_verifications SET consumed_at = ? WHERE user_id = ? AND purpose = 'email_change' AND consumed_at IS NULL")
    .run(nowIso(), userId)
  db().prepare('UPDATE users SET pending_email = NULL WHERE id = ?').run(userId)
}

export function confirmEmailChange(userId: number, code: string, current: string, keepSessionId: string): User {
  if (!/^\d{6}$/.test(code)) throw new AuthError('Code must be 6 digits.')
  requireAttempt('email-change-code', String(userId))
  requireCurrentPassword(userId, current)

  const error = db().transaction(() => {
    const row = db()
      .prepare(
        `SELECT u.id AS user_id, u.pending_email, ev.id AS verification_id,
                ev.code_hash, ev.attempts, ev.expires_at
           FROM users u
           LEFT JOIN email_verifications ev
             ON ev.user_id = u.id AND ev.purpose = 'email_change' AND ev.consumed_at IS NULL
          WHERE u.id = ?
          ORDER BY ev.id DESC LIMIT 1`,
      )
      .get(userId) as (VerificationRow & { pending_email: string | null }) | undefined
    if (!row || !row.pending_email) return 'No email change is waiting. Start again from the profile page.'
    if (!db().prepare('SELECT 1 FROM sessions WHERE id = ? AND user_id = ? AND expires_at > ?').get(keepSessionId, userId, nowIso())) return 'Your session has expired. Sign in again.'
    if (db().prepare('SELECT 1 FROM users WHERE lower(email) = ? AND id <> ?').get(normalizeEmail(row.pending_email), userId)) return 'That address cannot be used on this account.'
    const verificationError = consumeCode(row, code)
    if (verificationError) return verificationError
    try {
      db()
        .prepare('UPDATE users SET email = ?, pending_email = NULL, email_verified_at = ? WHERE id = ?')
        .run(normalizeEmail(row.pending_email), nowIso(), userId)
      db().prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').run(userId, keepSessionId)
    } catch {
      /* The unique index on email: the address was taken between the two steps. */
      return 'That address cannot be used on this account.'
    }
    return null
  })()

  if (error) throw new AuthError(error)
  const user = getUser(userId)
  if (!user) throw new AuthError('Sign in again.')
  return user
}

/**
 * The current password is required, and every other session is signed
 * out — if the reason for the change is that someone else knows the old
 * one, that is the part that matters.
 */
export function changePassword(userId: number, current: string, next: string, keepSessionId: string) {
  validatePassword(next)
  requireAttempt('password-change', String(userId))
  const row = db().prepare('SELECT password_hash FROM users WHERE id = ?').get(userId) as { password_hash: string } | undefined
  if (!row || !verifyPassword(current, row.password_hash)) throw new AuthError('The current password is not right.')
  if (current === next) throw new AuthError('Choose a password you have not used here before.')
  db().transaction(() => {
    if (!db().prepare('SELECT 1 FROM sessions WHERE id = ? AND user_id = ? AND expires_at > ?').get(keepSessionId, userId, nowIso())) throw new AuthError('Your session has expired. Sign in again.')
    db().prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(next), userId)
    cancelEmailChange(userId)
    db().prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?').run(userId, keepSessionId)
  })()
}
