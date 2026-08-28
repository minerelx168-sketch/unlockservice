'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Brand } from './brand'
import { Icon } from './icons'
import { ThemeToggle } from './theme-toggle'

const NAV = [
  { href: '/#check', label: 'Unlock Phone' },
  { href: '/#services', label: 'Phone Check' },
  { href: '/#how', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/login', label: 'Order Tracking' },
]

/**
 * Actions read toggle → quiet → accent, so the strongest colour sits
 * furthest right. Below 940px the nav becomes a panel and the buttons
 * step aside — see the media queries in components.css.
 */
export function SiteHeader({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const accountHref = isAuthenticated ? '/user/unlock' : '/login'
  const accountLabel = isAuthenticated ? 'Workspace' : 'Sign in'

  return (
    <header className="site-header">
      <div className="shell">
        <Brand />

        <nav
          className="site-nav"
          id="site-nav"
          aria-label="Primary"
          data-open={open ? 'true' : 'false'}
        >
          {NAV.map((item) => {
            const href = item.label === 'Order Tracking' && isAuthenticated ? '/user/orders' : item.href
            return (
              <Link
                key={item.label}
                href={href}
                aria-current={href === pathname ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            )
          })}
          <Link className="nav-cta" href="/#check" onClick={() => setOpen(false)}>
            Unlock a phone
          </Link>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <Link className="button button--quiet" href={accountHref}>
            {accountLabel}
          </Link>
          <Link className="button button--primary" href="/#check">
            <Icon name="bolt" strokeWidth={1.9} />
            Unlock Phone
          </Link>
          <button
            type="button"
            className="icon-action nav-toggle"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="site-nav"
            aria-label="Toggle navigation"
          >
            <Icon name="menu" />
          </button>
        </div>
      </div>
    </header>
  )
}
