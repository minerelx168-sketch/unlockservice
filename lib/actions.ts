'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import {
  authenticate,
  AuthError,
  clearSessionCookie,
  createSession,
  currentSession,
  destroySession,
  register,
  setSessionCookie,
} from './auth'
import {
  emailVerificationRequired,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  startEmailVerification,
  verifyEmail,
} from './account-security'
import { CARRIERS } from './catalog'
import { isValidImei, normalizeImei } from './imei'
import { parseUsd } from './money'
import { writeQuote } from './quote'
import {
  approveInvoice,
  createInvoice,
  PaymentError,
  selfApprovalEnabled,
  submitPaymentReference,
} from './payments'

export type FormState = { error?: string; message?: string }

/**
 * Everything that is a plain form in the observed system stays a plain
 * form here: post, act, redirect. Only the check flow needs JSON.
 */

/**
 * The homepage quote. Validated here rather than trusted from the field,
 * then put somewhere the next page can read it that is not the URL.
 */
export async function startUnlockQuoteAction(_: FormState, data: FormData): Promise<FormState> {
  const imei = normalizeImei(String(data.get('imei') ?? ''))
  if (!isValidImei(imei)) return { error: 'Enter a valid 15-digit IMEI to continue.' }

  const carrierId = Number(data.get('carrierId'))
  if (!CARRIERS.some((carrier) => carrier.id === carrierId)) {
    return { error: 'Pick the network the phone is locked to.' }
  }

  await writeQuote(imei, carrierId)
  const signedIn = (await currentSession()) !== null
  redirect(signedIn ? '/user/unlock' : '/register')
}

export async function registerAction(_: FormState, data: FormData): Promise<FormState> {
  const email = String(data.get('email') ?? '').trim().toLowerCase()
  const verificationRequired = emailVerificationRequired()
  try {
    const user = register(
      String(data.get('username') ?? ''),
      email,
      String(data.get('password') ?? ''),
    )
    if (verificationRequired) await startEmailVerification(user.id, user.email)
    else await setSessionCookie(createSession(user.id))
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message }
    throw error
  }
  revalidatePath('/', 'layout')
  if (verificationRequired) redirect(`/verify-email?email=${encodeURIComponent(email)}`)
  redirect('/user/unlock')
}

export async function loginAction(_: FormState, data: FormData): Promise<FormState> {
  try {
    const user = authenticate(String(data.get('identity') ?? ''), String(data.get('password') ?? ''))
    await setSessionCookie(createSession(user.id))
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message }
    throw error
  }
  revalidatePath('/', 'layout')
  redirect('/user/unlock')
}

export async function verifyEmailAction(_: FormState, data: FormData): Promise<FormState> {
  const email = String(data.get('email') ?? '').trim().toLowerCase()
  try {
    const user = verifyEmail(email, String(data.get('code') ?? ''))
    await setSessionCookie(createSession(user.id))
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message }
    throw error
  }
  revalidatePath('/', 'layout')
  redirect('/user/unlock')
}

export async function resendVerificationAction(_: FormState, data: FormData): Promise<FormState> {
  try {
    await resendVerification(String(data.get('email') ?? ''))
    return { message: 'If the account is waiting for verification, a new code has been sent.' }
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message }
    throw error
  }
}

export async function requestPasswordResetAction(_: FormState, data: FormData): Promise<FormState> {
  try {
    await requestPasswordReset(String(data.get('email') ?? ''))
    return { message: 'If a matching account exists, a reset code has been sent.' }
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message }
    throw error
  }
}

export async function resetPasswordAction(_: FormState, data: FormData): Promise<FormState> {
  try {
    resetPassword(
      String(data.get('email') ?? ''),
      String(data.get('code') ?? ''),
      String(data.get('password') ?? ''),
    )
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message }
    throw error
  }
  redirect('/login?reset=1')
}

export async function logoutAction() {
  const found = await currentSession()
  if (found) destroySession(found.session.id)
  await clearSessionCookie()
  revalidatePath('/', 'layout')
  redirect('/')
}

export async function createInvoiceAction(_: FormState, data: FormData): Promise<FormState> {
  const found = await currentSession()
  if (!found) redirect('/login')

  const cents = parseUsd(String(data.get('amount') ?? ''))
  if (cents === null) return { error: 'Enter an amount like 25 or 25.50.' }

  let reference: string
  try {
    reference = createInvoice(found.user.id, String(data.get('gateway') ?? ''), cents).reference
  } catch (error) {
    if (error instanceof PaymentError) return { error: error.message }
    throw error
  }
  revalidatePath('/', 'layout')
  redirect(`/user/invoice/${reference}`)
}

export async function submitReferenceAction(_: FormState, data: FormData): Promise<FormState> {
  const found = await currentSession()
  if (!found) redirect('/login')

  const reference = String(data.get('reference') ?? '')
  try {
    submitPaymentReference(
      reference,
      found.user.id,
      String(data.get('paymentReference') ?? ''),
      String(data.get('note') ?? ''),
    )
  } catch (error) {
    if (error instanceof PaymentError) return { error: error.message }
    throw error
  }
  revalidatePath('/', 'layout')
  redirect(`/user/invoice/${reference}`)
}

/**
 * Stands in for the admin confirming a transfer. Disabled in production
 * unless explicitly switched on, because it mints credit.
 */
export async function approveInvoiceAction(_: FormState, data: FormData): Promise<FormState> {
  const found = await currentSession()
  if (!found) redirect('/login')
  if (!selfApprovalEnabled()) return { error: 'Confirmation is done by an administrator.' }

  const reference = String(data.get('reference') ?? '')
  try {
    approveInvoice(reference, found.user.id)
  } catch (error) {
    if (error instanceof PaymentError) return { error: error.message }
    throw error
  }
  revalidatePath('/', 'layout')
  redirect(`/user/invoice/${reference}`)
}
