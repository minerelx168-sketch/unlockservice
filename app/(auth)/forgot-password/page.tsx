import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ForgotPasswordForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { currentSession } from '@/lib/auth'
import { landingRoute } from '@/lib/provider'
import { safeContinuation } from '@/lib/continuation'

export const metadata: Metadata = { title: 'Forgot password' }
export const dynamic = 'force-dynamic'

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const returnTo = safeContinuation((await searchParams).next)
  if (await currentSession()) redirect(returnTo ?? landingRoute())

  return (
    <div className="auth-card">
      <Brand />
      <h1>Reset your password.</h1>
      <p>We will send a short-lived verification code if the email belongs to an account.</p>
      <ForgotPasswordForm returnTo={returnTo} />
    </div>
  )
}
