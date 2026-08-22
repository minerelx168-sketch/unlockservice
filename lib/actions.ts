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
import { parseUsd } from './money'
import {
  approveInvoice,
  createInvoice,
  PaymentError,
  selfApprovalEnabled,
  submitPaymentReference,
} from './payments'

export type FormState = { error?: string }

/**
 * Everything that is a plain form in the observed system stays a plain
 * form here: post, act, redirect. Only the check flow needs JSON.
 */

export async function registerAction(_: FormState, data: FormData): Promise<FormState> {
  try {
    const user = register(
      String(data.get('username') ?? ''),
      String(data.get('email') ?? ''),
      String(data.get('password') ?? ''),
    )
    await setSessionCookie(createSession(user.id))
  } catch (error) {
    if (error instanceof AuthError) return { error: error.message }
    throw error
  }
  revalidatePath('/', 'layout')
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
