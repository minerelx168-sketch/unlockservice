'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Brand } from './brand'
import { Icon } from './icons'
import { ThemeToggle } from './theme-toggle'

const NAV = [
  { href: '/services/unlock', label: 'Unlock Service' },
  { href: '/services/imei-check', label: 'Phone Check' },
  { href: '/#how', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/login', label: 'Order Tracking' },
]

/**
 * Actions read toggle → quiet account → Signal Blue catalog CTA, so the
 * strongest action sits furthest right. Below 940px the nav becomes a panel and the buttons
 * step aside — see the media queries in components.css.
 */
export function SiteHeader({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const accountHref = isAuthenticated ? '/user/unlock' : '/login'
  const accountLabel = isAuthenticated ? 'My account' : 'Sign in'

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
            /* Comparing the whole href to the pathname never matched,
               because four of the five links are anchors into the homepage —
               so nothing was ever marked current. Matching on the path alone
               marks all four at once on the homepage, which is no more
               useful. An anchor into a section is not the current page, so
               only a link that is itself a page carries the mark. */
            const [path, hash] = href.split('#')
            return (
              <Link
                key={item.label}
                href={href}
                aria-current={!hash && path === pathname ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                {item.label}
              </Link>
            )
          })}
          <Link className="nav-cta" href="/services" onClick={() => setOpen(false)}>
            Browse services
          </Link>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <Link className="button button--quiet" href={accountHref}>
            {accountLabel}
          </Link>
          <Link className="button button--primary" href="/services">
            <Icon name="search" strokeWidth={1.9} />
            Browse services
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
