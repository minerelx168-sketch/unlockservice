import Link from 'next/link'
import type { ReactNode } from 'react'

/**
 * The sign-in pages have no header and no footer, which is deliberate —
 * a full navigation bar next to a password field is one more thing to
 * mis-tap. But the card was the whole page: someone who arrived here from
 * a verification email had the wordmark and nothing else, and the legal
 * pages were unreachable from the one screen that asks them to agree to
 * anything.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      {children}
      <nav className="auth-aside" aria-label="Elsewhere on the site">
        <Link href="/">Home</Link>
        <span aria-hidden="true">·</span>
        <Link href="/services/imei-check">Phone Check</Link>
        <span aria-hidden="true">·</span>
        <Link href="/privacy">Privacy</Link>
        <span aria-hidden="true">·</span>
        <Link href="/terms">Terms</Link>
      </nav>
    </div>
  )
}
