import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { LoginForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { currentSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Sign in' }
export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  if (await currentSession()) redirect('/user/check')

  return (
    <div className="auth-card">
      <Brand />
      <h1>Sign in to your workspace.</h1>
      <p>Your credit, your checks and your history are all behind this door.</p>
      <LoginForm />
    </div>
  )
}
