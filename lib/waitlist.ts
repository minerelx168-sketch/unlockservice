import { emailDeliveryConfigured, sendTransactionalEmail } from './account-security'
import { db } from './db'
import { isValidImei, maskIdentifier, normalizeImei } from './imei'
import { FingerprintUnavailable, fingerprintImei } from './imei-privacy'
import { consumeAttempt } from './rate-limit'

/**
 * Who wants to be told when unlock ordering opens.
 *
 * This exists so the closed page has something to offer other than an
 * apology. It stores no raw IMEI — the same rule the rest of the system
 * follows — and the unique index makes a resubmission idempotent rather
 * than a second row, so someone who taps twice is not counted twice and
 * is not emailed twice either.
 */

export class WaitlistError extends Error {
  constructor(message: string, readonly code: 'email_invalid' | 'imei_invalid' | 'rate_limited') {
    super(message)
    this.name = 'WaitlistError'
  }
}

export type WaitlistInput = {
  email: string
  imei?: string
  carrierId?: number
  userId?: number
}

const CONFIRMATION_SUBJECT = 'You are on the iUnlockMobile unlock list'

async function confirm(email: string, masked: string | null) {
  const device = masked ? ` for ${masked}` : ''
  const text =
    `You asked to hear when phone unlocking opens${device}. We will email this address once, ` +
    `the day it does. Phone checks and reports can be ordered today at ${'https://iunlockmobile.com/services/imei-check'}.`
  const html =
    `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:auto;padding:32px">` +
    `<h2>iUnlockMobile</h2><p>You asked to hear when phone unlocking opens${device}. ` +
    `We will email this address once, the day it does.</p>` +
    `<p>Phone checks and reports can be ordered today at ` +
    `<a href="https://iunlockmobile.com/services/imei-check">iunlockmobile.com</a>.</p></div>`
  await sendTransactionalEmail(email, CONFIRMATION_SUBJECT, html, text)
}

export async function joinUnlockWaitlist(
  input: WaitlistInput,
): Promise<{ maskedImei: string | null; added: boolean }> {
  const email = input.email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new WaitlistError('Enter an email address we can reach you at.', 'email_invalid')
  }

  const digits = input.imei ? normalizeImei(input.imei) : ''
  if (digits && !isValidImei(digits)) {
    throw new WaitlistError('That IMEI does not look right. Check the final digit.', 'imei_invalid')
  }

  if (!consumeAttempt('unlock-waitlist', email, 5, 60 * 60)) {
    throw new WaitlistError('Too many attempts. Please try again later.', 'rate_limited')
  }

  /* Empty string rather than NULL: two NULLs are distinct to a SQLite
     unique index, so a NULL here would let the same address without an
     IMEI join the list as many times as it liked.

     The fingerprint key is required before any IMEI is stored anywhere,
     and this is the one form that runs before the service is configured
     — so a missing key costs the fingerprint, not the signup. The list
     then dedupes on the address alone, which is what it is for. */
  let fingerprint = ''
  try {
    if (digits) fingerprint = fingerprintImei(digits)
  } catch (error) {
    if (!(error instanceof FingerprintUnavailable)) throw error
  }
  const masked = digits ? maskIdentifier(digits) : null

  const result = db()
    .prepare(
      `INSERT INTO unlock_waitlist (user_id, email, imei_fingerprint, masked_imei, carrier_id)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(email, imei_fingerprint) DO NOTHING`,
    )
    .run(input.userId ?? null, email, fingerprint, masked, input.carrierId ?? null)

  const added = result.changes > 0

  /* The row is what matters. If Resend is not configured, or refuses, the
     signup still stands — failing the form because the receipt could not
     be sent would lose the very thing we were asked to keep. */
  if (added && emailDeliveryConfigured()) {
    try {
      await confirm(email, masked)
    } catch {
      console.error('[waitlist] confirmation email failed')
    }
  }

  return { maskedImei: masked, added }
}
