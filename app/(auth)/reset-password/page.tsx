import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { currentSession } from '@/lib/auth'
import { landingRoute } from '@/lib/provider'
import { safeContinuation } from '@/lib/continuation'

export const metadata: Metadata = { robots: { index: false, follow: true }, title: 'Reset password' }
export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; next?: string }>
}) {
  const { email = '', next } = await searchParams
  const returnTo = safeContinuation(next)
  if (await currentSession()) redirect(returnTo ?? landingRoute())

  return (
    <div className="auth-card">
      <Brand />
      <h1>Choose a new password.</h1>
      <p>Enter the six-digit reset code and a new password. Existing sessions will be revoked.</p>
      <ResetPasswordForm email={email} returnTo={returnTo} />
    </div>
  )
}

