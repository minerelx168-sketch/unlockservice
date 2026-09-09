import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { currentSession } from '@/lib/auth'
import { landingRoute } from '@/lib/provider'
import { safeContinuation } from '@/lib/continuation'
import { googleOAuthConfigured } from '@/lib/google-oauth'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; oauth?: string; next?: string }>
}) {
  const { reset, oauth, next } = await searchParams
  const returnTo = safeContinuation(next)
  if (await currentSession()) redirect(returnTo ?? landingRoute())

  return (
    <div className="auth-card">
      <Brand />
      <h1>{returnTo ? 'Sign in to continue.' : 'Sign in to see your orders.'}</h1>
      <p>{returnTo ? 'Continue where you left off. Your selected service will be waiting after sign-in.' : 'Your orders, your reports and the codes you have already bought.'}</p>
      <LoginForm resetComplete={reset === '1'} oauthError={oauth} returnTo={returnTo} googleEnabled={googleOAuthConfigured()} />
    </div>
  )
}
