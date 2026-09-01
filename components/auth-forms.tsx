'use client'

import Link from 'next/link'
import { useActionState } from 'react'
import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resendVerificationAction,
  resetPasswordAction,
  verifyEmailAction,
  type FormState,
} from '@/lib/actions'
import { Icon } from './icons'

const EMPTY: FormState = {}

function Notice({ state }: { state: FormState }) {
  if (!state.error && !state.message) return null
  return (
    <p className={`alert ${state.error ? 'alert--error' : 'alert--success'}`} role={state.error ? 'alert' : 'status'}>
      <Icon name="info" strokeWidth={1.9} />
      <span>{state.error ?? state.message}</span>
    </p>
  )
}

function GoogleAuthOption() {
  return (
    <>
      {/* A plain anchor, not a Link. /auth/google is not a page: it mints an
          OAuth transaction, writes a row and sets a cookie. Next prefetches
          Links that are on screen, so as a Link it started a fresh
          transaction for every visitor who merely looked at this form, and a
          prefetch landing mid-flow would replace the cookie the real attempt
          was relying on. */}
      <a className="button button--quiet button--wide" href="/auth/google">
        Continue with Google
      </a>
      <div className="auth-divider" aria-hidden="true">
        <span>or continue with email</span>
      </div>
    </>
  )
}

const OAUTH_MESSAGES: Record<string, string> = {
  cancelled: 'Google sign-in was cancelled.',
  failed: 'Google sign-in could not be completed. Please try again.',
  unavailable: 'Google sign-in is temporarily unavailable.',
}

export function LoginForm({
  resetComplete = false,
  oauthError,
}: {
  resetComplete?: boolean
  oauthError?: string
}) {
  const [state, action, pending] = useActionState(loginAction, EMPTY)

  return (
    <form action={action} className="form-grid" style={{ maxWidth: 'none' }}>
      <GoogleAuthOption />
      {oauthError && OAUTH_MESSAGES[oauthError] ? (
        <p className="alert alert--error" role="alert">
          <Icon name="info" strokeWidth={1.9} />
          <span>{OAUTH_MESSAGES[oauthError]}</span>
        </p>
      ) : null}
      {resetComplete ? (
        <p className="alert alert--success" role="status">
          <Icon name="check" strokeWidth={1.9} />
          <span>Password updated. Sign in with your new password.</span>
        </p>
      ) : null}
      <Notice state={state} />
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
        <Link href="/forgot-password">Forgot password?</Link>
      </p>
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
      <GoogleAuthOption />
      <Notice state={state} />
      <div className="field">
        <label htmlFor="username">Username</label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          minLength={3}
          maxLength={32}
          /* The hyphen is escaped because the pattern attribute compiles with
             the v flag, which reserves a bare one inside a character class.
             Unescaped, the whole attribute is discarded and the field is
             never checked in the browser at all. */
          pattern="[A-Za-z0-9._\-]+"
        />
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
          maxLength={256}
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

export function VerifyEmailForm({ email }: { email: string }) {
  const [verifyState, verifyAction, verifying] = useActionState(verifyEmailAction, EMPTY)
  const [resendState, resendAction, resending] = useActionState(resendVerificationAction, EMPTY)

  return (
    <div className="form-grid" style={{ maxWidth: 'none' }}>
      <form action={verifyAction} className="form-grid" style={{ maxWidth: 'none' }}>
        <Notice state={verifyState} />
        <div className="field">
          <label htmlFor="email">Email</label>
          <input id="email" name="email" type="email" defaultValue={email} autoComplete="email" required />
        </div>
        <div className="field">
          <label htmlFor="code">Six-digit code</label>
          <input
            id="code"
            name="code"
            className="mono"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            minLength={6}
            maxLength={6}
            required
          />
        </div>
        <button className="button button--primary button--wide" type="submit" disabled={verifying}>
          {verifying ? 'Verifying…' : 'Verify and continue'}
        </button>
      </form>

      <form action={resendAction} className="form-grid" style={{ maxWidth: 'none' }}>
        <Notice state={resendState} />
        <input type="hidden" name="email" value={email} />
        <button className="button button--quiet button--wide" type="submit" disabled={resending || !email}>
          {resending ? 'Sending…' : 'Send a new code'}
        </button>
      </form>

      <p className="auth-foot">
        Already verified? <Link href="/login">Sign in</Link>
      </p>
    </div>
  )
}

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, EMPTY)

  return (
    <form action={action} className="form-grid" style={{ maxWidth: 'none' }}>
      <Notice state={state} />
      <div className="field">
        <label htmlFor="email">Account email</label>
        <input id="email" name="email" type="email" autoComplete="email" required />
      </div>
      <button className="button button--primary button--wide" type="submit" disabled={pending}>
        {pending ? 'Sending…' : 'Send reset code'}
      </button>
      <p className="auth-foot">
        Have a code? <Link href="/reset-password">Set a new password</Link>
      </p>
      <p className="auth-foot">
        <Link href="/login">Back to sign in</Link>
      </p>
    </form>
  )
}

export function ResetPasswordForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, EMPTY)

  return (
    <form action={action} className="form-grid" style={{ maxWidth: 'none' }}>
      <Notice state={state} />
      <div className="field">
        <label htmlFor="email">Account email</label>
        <input id="email" name="email" type="email" defaultValue={email} autoComplete="email" required />
      </div>
      <div className="field">
        <label htmlFor="code">Six-digit reset code</label>
        <input
          id="code"
          name="code"
          className="mono"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          minLength={6}
          maxLength={6}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">New password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={256}
          required
        />
      </div>
      <button className="button button--primary button--wide" type="submit" disabled={pending}>
        {pending ? 'Updating…' : 'Update password'}
      </button>
      <p className="auth-foot">
        Need a code? <Link href="/forgot-password">Request one</Link>
      </p>
    </form>
  )
}
