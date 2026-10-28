'use server'

import { revalidatePath } from 'next/cache'
import { cancelEmailChange, changePassword, confirmEmailChange, startEmailChange } from './account-security'
import type { FormState } from './actions'
import { AuthError, currentSession } from './auth'
import { setAvatarStyle } from './profile'

async function signedIn() {
  const found = await currentSession()
  if (!found) throw new AuthError('Your session has expired. Sign in again.')
  return found
}

/* Only an AuthError carries a message written for the customer. Anything
   else is a bug and gets a sentence that gives nothing away. */
function failed(error: unknown): FormState {
  if (error instanceof AuthError) return { error: error.message }
  if (error instanceof Error && error.message.startsWith('Choose one of')) return { error: error.message }
  console.error('[profile] action failed', error instanceof Error ? error.message : error)
  return { error: 'Something went wrong. Please try again.' }
}

export async function setAvatarStyleAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const found = await signedIn()
    setAvatarStyle(found.user.id, form.get('style'))
    revalidatePath('/user', 'layout')
    return { message: 'Avatar updated.' }
  } catch (error) {
    return failed(error)
  }
}

export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const found = await signedIn()
    const next = String(form.get('password') ?? '')
    if (next !== String(form.get('confirm') ?? '')) return { error: 'The two new passwords do not match.' }
    changePassword(found.user.id, String(form.get('current') ?? ''), next, found.session.id)
    return { message: 'Password changed. Every other device has been signed out.' }
  } catch (error) {
    return failed(error)
  }
}

export async function startEmailChangeAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const found = await signedIn()
    await startEmailChange(found.user.id, String(form.get('email') ?? ''), String(form.get('current') ?? ''))
    revalidatePath('/user/profile')
    return { message: 'We sent a 6-digit code to the new address. Enter it below to finish.' }
  } catch (error) {
    return failed(error)
  }
}

export async function confirmEmailChangeAction(_: FormState, form: FormData): Promise<FormState> {
  try {
    const found = await signedIn()
    confirmEmailChange(found.user.id, String(form.get('code') ?? '').trim(), String(form.get('current') ?? ''), found.session.id)
    revalidatePath('/user', 'layout')
    return { message: 'Email address updated. Every other device has been signed out.' }
  } catch (error) {
    return failed(error)
  }
}

export async function cancelEmailChangeAction(): Promise<FormState> {
  try {
    const found = await signedIn()
    cancelEmailChange(found.user.id)
    revalidatePath('/user/profile')
    return { message: 'Email change cancelled.' }
  } catch (error) {
    return failed(error)
  }
}
