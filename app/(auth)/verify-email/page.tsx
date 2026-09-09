import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { VerifyEmailForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { emailVerificationRequired } from '@/lib/account-security'
import { currentSession } from '@/lib/auth'
import { landingRoute } from '@/lib/provider'
import { safeContinuation, withContinuation } from '@/lib/continuation'

export const metadata: Metadata = { title: 'Verify email' }
export const dynamic = 'force-dynamic'

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>
}) {
  const { email = '', next } = await searchParams
  const returnTo = safeContinuation(next)
  if (await currentSession()) redirect(returnTo ?? landingRoute())
  if (!emailVerificationRequired()) redirect(withContinuation('/login', returnTo))

  return (
    <div className="auth-card">
      <Brand />
      <h1>Verify your email.</h1>
      <p>Enter the six-digit code sent to your inbox. Codes expire after ten minutes.</p>
      <VerifyEmailForm email={email} returnTo={returnTo} />
    </div>
  )
}
