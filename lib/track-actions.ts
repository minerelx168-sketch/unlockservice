'use server'

import { redirect } from 'next/navigation'
import type { FormState } from './actions'
import { currentSession } from './auth'
import { consumeAttempt } from './rate-limit'
import { cleanIdentityHint, parseOrderReference } from './track'

/**
 * The public "find my order" box. It never looks an order up itself: a
 * signed-in customer is sent to a resolver that only searches their own
 * account, and a visitor is sent to sign in first with the resolver as
 * the continuation. So the box cannot be used to learn whether an order
 * number exists, or whose it is.
 */
export async function findOrderAction(_: FormState, form: FormData): Promise<FormState> {
  const id = parseOrderReference(form.get('reference'))
  if (!id) return { error: 'Enter the order number from your confirmation email — digits only, for example 1234.' }

  const identity = cleanIdentityHint(form.get('email'))
  if (!consumeAttempt('track-order', identity ?? 'anonymous', 30, 10 * 60)) {
    return { error: 'Too many attempts. Please wait a few minutes and try again.' }
  }

  const found = await currentSession()
  if (found) redirect(`/user/find/${id}`)
  const next = encodeURIComponent(`/user/find/${id}`)
  redirect(identity ? `/login?next=${next}&identity=${encodeURIComponent(identity)}` : `/login?next=${next}`)
}
