'use server'

import { redirect } from 'next/navigation'
import type { FormState } from './actions'
import { currentSession } from './auth'
import { consumeAttempt } from './rate-limit'
import { parseOrderReference } from './track'

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

  const found = await currentSession()
  // Anonymous requests only redirect to sign-in; there is no lookup to throttle.
  // Signed-in limits are tied to the verified account, never a caller-supplied hint.
  if (found && !consumeAttempt('track-order', String(found.user.id), 30, 10 * 60)) {
    return { error: 'Too many attempts. Please wait a few minutes and try again.' }
  }

  if (found) redirect(`/user/find/${id}`)
  const next = encodeURIComponent(`/user/find/${id}`)
  redirect(`/login?next=${next}`)
}
