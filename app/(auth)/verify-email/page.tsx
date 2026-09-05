import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { VerifyEmailForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { emailVerificationRequired } from '@/lib/account-security'
import { currentSession } from '@/lib/auth'
import { landingRoute } from '@/lib/provider'

export const metadata: Metadata = { title: 'Verify email' }
export const dynamic = 'force-dynamic'

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  if (await currentSession()) redirect(landingRoute())
  if (!emailVerificationRequired()) redirect('/login')
  const { email = '' } = await searchParams

  return (
    <div className="auth-card">
      <Brand />
      <h1>Verify your email.</h1>
      <p>Enter the six-digit code sent to your inbox. Codes expire after ten minutes.</p>
      <VerifyEmailForm email={email} />
    </div>
  )
}
