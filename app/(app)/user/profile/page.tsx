import { LocalTime } from '@/components/customer-time'
import type { Metadata } from 'next'
import Link from 'next/link'
import { Avatar } from '@/components/avatar'
import { Icon } from '@/components/icons'
import { AvatarPicker, EmailChangeForm, PasswordChangeForm } from '@/components/profile-forms'
import { emailDeliveryConfigured } from '@/lib/account-security'
import { requireSession } from '@/lib/auth'
import { getAccountProfile } from '@/lib/profile'

export const metadata: Metadata = { title: 'Profile' }
export const dynamic = 'force-dynamic'

export default async function ProfilePage() {
  const { user } = await requireSession()
  const profile = getAccountProfile(user.id)

  return (
    <>
      <Link className="back-link" href="/user/dashboard">
        <Icon name="arrowLeft" strokeWidth={2} />
        Back to dashboard
      </Link>

      <div className="profile-head">
        <Avatar username={user.username} style={profile.avatarStyle} size={72} />
        <div>
          <h1>{user.username}</h1>
          <p>{user.email}</p>
        </div>
      </div>
      <div className="app-head" style={{ marginBottom: 22 }}>
        <div>
          <h2 className="t-card">Profile settings</h2>
          <p>Your avatar, your email and your password. Orders and credit are unaffected by anything here.</p>
        </div>
      </div>

      <div className="profile-stack">
        <section className="profile-card" aria-labelledby="profile-avatar-heading">
          <h2 id="profile-avatar-heading">
            <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="sparkle" /></span>
            Avatar
          </h2>
          <p>Your initials on a colour of your choosing. No photo uploads — there is nothing to leak.</p>
          <AvatarPicker username={user.username} current={profile.avatarStyle} />
        </section>

        <section className="profile-card" aria-labelledby="profile-info-heading">
          <h2 id="profile-info-heading">
            <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="user" /></span>
            Account
          </h2>
          <p>The username is how you sign in and how support finds you. It cannot be changed here.</p>
          <dl className="field-grid">
            <div className="field-box">
              <dt>Username</dt>
              <dd>{user.username}</dd>
            </div>
            <div className="field-box">
              <dt>Member since</dt>
              <dd><LocalTime value={user.created_at} dateOnly /></dd>
            </div>
            <div className="field-box">
              <dt>Account type</dt>
              <dd>{user.account_type === 'admin' ? 'Administrator' : 'Customer'}</dd>
            </div>
            <div className="field-box">
              <dt>Email verified</dt>
              <dd>{user.email_verified_at ? <LocalTime value={user.email_verified_at} dateOnly /> : 'Not yet'}</dd>
            </div>
          </dl>
        </section>

        <section className="profile-card" aria-labelledby="profile-email-heading">
          <h2 id="profile-email-heading">
            <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="mail" /></span>
            Email address
          </h2>
          <p>Order results and codes go to this address. A change is confirmed from the new inbox first.</p>
          <EmailChangeForm currentEmail={user.email} pendingEmail={profile.pendingEmail} deliveryConfigured={emailDeliveryConfigured()} />
        </section>

        <section className="profile-card" aria-labelledby="profile-password-heading">
          <h2 id="profile-password-heading">
            <span className="icon-tile icon-tile--sm" aria-hidden="true"><Icon name="lock" /></span>
            Password
          </h2>
          <p>Changing it signs out every other device. Forgot the current one? <Link href="/forgot-password">Reset it by email</Link>.</p>
          <PasswordChangeForm />
        </section>
      </div>
    </>
  )
}
