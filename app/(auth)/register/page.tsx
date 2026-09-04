import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RegisterForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { Icon } from '@/components/icons'
import { currentSession } from '@/lib/auth'
import { landingRoute } from '@/lib/provider'
import { describeQuote, readQuote } from '@/lib/quote'

export const metadata: Metadata = { title: 'Create an account' }
export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  if (await currentSession()) redirect(landingRoute())

  /* What they asked for on the homepage. It was previously sent here in the
     query string and then ignored, so the phone and the network had to be
     typed a second time on the far side of an account. */
  const quote = await readQuote()

  return (
    <div className="auth-card">
      <Brand />
      <h1>Start your unlock.</h1>
      <p>Create an account to view service prices, place an unlock request and track the result.</p>
      {quote ? (
        <p className="alert alert--success" role="status">
          <Icon name="check" strokeWidth={1.9} />
          <span>
            Carrying over your {describeQuote(quote)}. It will be waiting on the order form.
          </span>
        </p>
      ) : null}
      <RegisterForm />
    </div>
  )
}
