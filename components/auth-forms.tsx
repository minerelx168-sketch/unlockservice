'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import { loginAction, registerAction, type FormState } from '@/lib/actions'
import { Icon } from './icons'

const EMPTY: FormState = {}

function Problem({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p className="alert alert--error" role="alert">
      <Icon name="info" strokeWidth={1.9} />
      <span>{message}</span>
    </p>
  )
}

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, EMPTY)

  return (
    <form action={action} className="form-grid" style={{ maxWidth: 'none' }}>
      <Problem message={state.error} />
      <div className="field">
        <label htmlFor="identity">Username or email</label>
        <input id="identity" name="identity" autoComplete="username" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required />
      </div>
      <button className="button button--primary button--wide" type="submit" disabled={pending}>
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
      <p className="auth-foot">
        No account yet? <Link href="/register">Create one</Link>
      </p>
    </form>
  )
}

export function RegisterForm() {
  const [state, action, pending] = useActionState(registerAction, EMPTY)

  return (
    <form action={action} className="form-grid" style={{ maxWidth: 'none' }}>
      <Problem message={state.error} />
      <div className="field">
        <label htmlFor="username">Username</label>
        <input id="username" name="username" autoComplete="username" required minLength={3} />
      </div>
      <div className="field">
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </div>
      <button className="button button--primary button--wide" type="submit" disabled={pending}>
        {pending ? 'Creating account…' : 'Create account'}
      </button>
      <p className="auth-foot">
        Already registered? <Link href="/login">Sign in</Link>
      </p>
    </form>
  )
}
