import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RegisterForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { currentSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Create an account' }
export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  if (await currentSession()) redirect('/user/dashboard')

  return (
    <div className="auth-card">
      <Brand />
      <h1>Create an account.</h1>
      <p>Accounts start at zero credit. Add funds when you are ready to run a check.</p>
      <RegisterForm />
    </div>
  )
}
