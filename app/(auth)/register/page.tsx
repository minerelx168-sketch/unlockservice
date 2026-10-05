import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RegisterForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { Icon } from '@/components/icons'
import { currentSession } from '@/lib/auth'
import { landingRoute } from '@/lib/provider'
import { describeQuote, readQuote } from '@/lib/quote'
import { safeContinuation } from '@/lib/continuation'
import { googleOAuthConfigured } from '@/lib/google-oauth'

export const metadata: Metadata = { robots: { index: false, follow: true }, title: 'Create an account' }
export const dynamic = 'force-dynamic'

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const returnTo = safeContinuation((await searchParams).next)
  if (await currentSession()) redirect(returnTo ?? landingRoute())

  /* What they asked for on the homepage. It was previously sent here in the
     query string and then ignored, so the phone and the network had to be
     typed a second time on the far side of an account. */
  const quote = await readQuote()

  return (
    <div className="auth-card">
      <Brand />
      <h1>Create your account.</h1>
      <p>{returnTo ? 'Your selected service is saved. Create an account to continue and keep your reports private.' : 'Keep your reports private, manage credit and track your orders in one place.'}</p>
      {quote ? (
        <p className="alert alert--success" role="status">
          <Icon name="check" strokeWidth={1.9} />
          <span>
            Carrying over your {describeQuote(quote)}. It will be waiting on the order form.
          </span>
        </p>
      ) : null}
      <RegisterForm returnTo={returnTo} googleEnabled={googleOAuthConfigured()} />
    </div>
  )
}

