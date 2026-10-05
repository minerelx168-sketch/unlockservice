import type { Metadata } from 'next'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { AppNav } from '@/components/app-nav'
import { Brand } from '@/components/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { logoutAction } from '@/lib/actions'
import { requireSession } from '@/lib/auth'
import { formatUsd } from '@/lib/money'

export const metadata: Metadata = { robots: { index: false, follow: false } }

export const dynamic = 'force-dynamic'

/** Everything under /user is behind the session. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const found = await requireSession()
  const { user } = found

  const available = user.credit_cents - user.held_cents

  return (
    <div className="app-shell">
      {/* The token also lives in the DOM so any script on the page can read
          it, which is how the observed system re-reads it before a poll. */}
      <meta name="csrf-token" content={found.session.csrfToken} />
      <aside className="app-sidebar">
        <Brand />

        <div className="credit-card">
          <span className="label">Available credit</span>
          <span className="value">{formatUsd(available)}</span>
          {user.held_cents > 0 ? (
            <span className="held">{formatUsd(user.held_cents)} held by open orders</span>
          ) : (
            <span className="held">Nothing held right now</span>
          )}
        </div>

        <AppNav isAdmin={user.account_type === 'admin'}>
          <div className="app-account-actions">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ThemeToggle />
              <span className="t-small">{user.username}</span>
            </div>
            <Link className="button button--quiet" href="/">
              Back to site
            </Link>
            <form action={logoutAction}>
              <button className="button button--quiet button--wide" type="submit">
                Sign out
              </button>
            </form>
          </div>
        </AppNav>
      </aside>

      <main className="app-main">{children}</main>
    </div>
  )
}

