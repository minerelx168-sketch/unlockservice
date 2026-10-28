'use client'

import { useActionState, useState } from 'react'
import type { FormState } from '@/lib/actions'
import { AVATAR_STYLES, type AvatarStyle } from '@/lib/avatar-styles'
import {
  cancelEmailChangeAction,
  changePasswordAction,
  confirmEmailChangeAction,
  setAvatarStyleAction,
  startEmailChangeAction,
} from '@/lib/profile-actions'
import { Avatar } from './avatar'
import { Icon } from './icons'

const EMPTY: FormState = {}

function Notice({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p className="alert alert--error" role="alert">
        <Icon name="info" strokeWidth={1.9} />
        <span>{state.error}</span>
      </p>
    )
  }
  if (state.message) {
    return (
      <p className="alert alert--success" role="status">
        <Icon name="checkSmall" strokeWidth={2.2} />
        <span>{state.message}</span>
      </p>
    )
  }
  return null
}

export function AvatarPicker({ username, current }: { username: string; current: AvatarStyle }) {
  const [state, action, pending] = useActionState(setAvatarStyleAction, EMPTY)
  const [choice, setChoice] = useState<AvatarStyle>(current)

  return (
    <form className="profile-form" action={action}>
      <Notice state={state} />
      <fieldset className="avatar-picker" disabled={pending}>
        <legend className="visually-hidden">Avatar style</legend>
        {AVATAR_STYLES.map((style) => (
          <label key={style}>
            <input
              type="radio"
              name="style"
              value={style}
              checked={choice === style}
              onChange={() => setChoice(style)}
              aria-label={`${style} style`}
            />
            <Avatar username={username} style={style} size={56} />
          </label>
        ))}
      </fieldset>
      <div className="cta-actions">
        <button className="button button--primary" type="submit" disabled={pending || choice === current}>
          {pending ? 'Saving…' : 'Save avatar'}
        </button>
      </div>
    </form>
  )
}

function EmailCurrentPassword({ id }: { id: string }) {
  return <div className="field">
    <label htmlFor={id}>Current password</label>
    <input id={id} name="current" type="password" autoComplete="current-password" maxLength={256} required />
    <p className="field-note">Confirm your current password to protect the account recovery address.</p>
  </div>
}

export function EmailChangeForm({
  currentEmail,
  pendingEmail,
  deliveryConfigured,
}: {
  currentEmail: string
  pendingEmail: string | null
  deliveryConfigured: boolean
}) {
  const [startState, startAction, starting] = useActionState(startEmailChangeAction, EMPTY)
  const [confirmState, confirmAction, confirming] = useActionState(confirmEmailChangeAction, EMPTY)
  const [cancelState, cancelAction, cancelling] = useActionState(cancelEmailChangeAction, EMPTY)
  /* Controlled on purpose: a validation error must not empty the box. */
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')

  return (
    <div className="profile-form">
      <div className="field">
        <label htmlFor="profile-current-email">Current email</label>
        <input id="profile-current-email" type="email" value={currentEmail} readOnly />
      </div>

      {pendingEmail ? (
        <>
          <p className="pending-note">
            <Icon name="info" strokeWidth={2} />
            <span>
              A 6-digit code was sent to <b>{pendingEmail}</b>. The address changes only once that code is
              entered here; until then everything still goes to {currentEmail}.
            </span>
          </p>
          <form className="profile-form" action={confirmAction} noValidate>
            <Notice state={confirmState} />
            <EmailCurrentPassword id="profile-email-confirm-password" />
            <div className="field">
              <label htmlFor="profile-email-code">Code from the new inbox</label>
              <input
                id="profile-email-code"
                name="code"
                className="mono"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.currentTarget.value.replace(/\D/g, ''))}
                required
              />
            </div>
            <div className="cta-actions">
              <button className="button button--primary" type="submit" disabled={confirming || code.length !== 6}>
                {confirming ? 'Checking…' : 'Confirm new email'}
              </button>
            </div>
          </form>
          <form action={cancelAction}>
            <Notice state={cancelState} />
            <button className="button button--quiet" type="submit" disabled={cancelling}>
              {cancelling ? 'Cancelling…' : 'Cancel this change'}
            </button>
          </form>
        </>
      ) : (
        <form className="profile-form" action={startAction} noValidate>
          <Notice state={startState} />
          <EmailCurrentPassword id="profile-email-start-password" />
          <div className="field">
            <label htmlFor="profile-new-email">New email address</label>
            <input
              id="profile-new-email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.currentTarget.value)}
              disabled={!deliveryConfigured}
              required
            />
          </div>
          <p className="pending-note">
            <Icon name="info" strokeWidth={2} />
            <span>
              {deliveryConfigured
                ? 'You will need to confirm the new address with a code before the change takes effect.'
                : 'Email delivery is not configured on this server, so addresses cannot be changed here yet. Contact support.'}
            </span>
          </p>
          <div className="cta-actions">
            <button className="button button--primary" type="submit" disabled={starting || !deliveryConfigured || !email}>
              {starting ? 'Sending code…' : 'Send confirmation code'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

export function PasswordChangeForm() {
  const [state, action, pending] = useActionState(changePasswordAction, EMPTY)
  const [show, setShow] = useState(false)
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const type = show ? 'text' : 'password'

  return (
    <form
      className="profile-form"
      action={(form) => {
        action(form)
        /* Secrets do not linger in a form once submitted. */
        setCurrent('')
        setNext('')
        setConfirm('')
      }}
      noValidate
    >
      <Notice state={state} />
      <div className="field">
        <label htmlFor="profile-password-current">Current password</label>
        <input id="profile-password-current" name="current" type={type} autoComplete="current-password" value={current} onChange={(event) => setCurrent(event.currentTarget.value)} required />
      </div>
      <div className="field">
        <label htmlFor="profile-password-new">New password</label>
        <input id="profile-password-new" name="password" type={type} autoComplete="new-password" minLength={8} value={next} onChange={(event) => setNext(event.currentTarget.value)} required />
        <p className="field-note" data-state="idle">
          <Icon name="info" strokeWidth={1.9} />
          <span>At least 8 characters. Other devices are signed out when it changes.</span>
        </p>
      </div>
      <div className="field">
        <label htmlFor="profile-password-confirm">New password again</label>
        <input id="profile-password-confirm" name="confirm" type={type} autoComplete="new-password" minLength={8} value={confirm} onChange={(event) => setConfirm(event.currentTarget.value)} required />
      </div>
      <div className="cta-actions">
        <button className="button button--primary" type="submit" disabled={pending || !current || !next || !confirm}>
          {pending ? 'Changing…' : 'Change password'}
        </button>
        <button className="button button--quiet" type="button" onClick={() => setShow((value) => !value)} aria-pressed={show}>
          <Icon name={show ? 'eyeOff' : 'eye'} strokeWidth={1.9} />
          {show ? 'Hide' : 'Show'}
        </button>
      </div>
    </form>
  )
}
