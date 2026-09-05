import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { currentSession } from '@/lib/auth'
import { landingRoute } from '@/lib/provider'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string; oauth?: string }>
}) {
  if (await currentSession()) redirect(landingRoute())
  const { reset, oauth } = await searchParams

  return (
    <div className="auth-card">
      <Brand />
      <h1>Sign in to see your orders.</h1>
      <p>Your orders, your reports and the codes you have already bought.</p>
      <LoginForm resetComplete={reset === '1'} oauthError={oauth} />
    </div>
  )
}
