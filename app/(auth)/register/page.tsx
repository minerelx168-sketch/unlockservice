import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { RegisterForm } from '@/components/auth-forms'
import { Brand } from '@/components/brand'
import { currentSession } from '@/lib/auth'

export const metadata: Metadata = { title: 'Create an account' }
export const dynamic = 'force-dynamic'

export default async function RegisterPage() {
  if (await currentSession()) redirect('/user/unlock')

  return (
    <div className="auth-card">
      <Brand />
      <h1>Start your unlock.</h1>
      <p>Create an account to view service prices, place an unlock request and track the result.</p>
      <RegisterForm />
    </div>
  )
}
