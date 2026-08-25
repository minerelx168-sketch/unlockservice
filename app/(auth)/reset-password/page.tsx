import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { ResetPasswordForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { currentSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Reset password' }
export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>
}) {
  if (await currentSession()) redirect('/user/unlock')
  const { email = '' } = await searchParams

  return (
    <div className="auth-card">
      <Brand />
      <h1>Choose a new password.</h1>
      <p>Enter the six-digit reset code and a new password. Existing sessions will be revoked.</p>
      <ResetPasswordForm email={email} />
    </div>
  )
}
