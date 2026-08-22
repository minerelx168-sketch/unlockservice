'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { Brand } from './brand'
import { Icon } from './icons'
import { ThemeToggle } from './theme-toggle'

const NAV = [
  { href: '/', label: 'Home' },
  { href: '/#services', label: 'Services' },
  { href: '/#how', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/design-system', label: 'Design system' },
]

/**
 * Actions read toggle → quiet → accent, so the strongest colour sits
 * furthest right. Below 940px the nav becomes a panel and the buttons
 * step aside — see the media queries in components.css.
 */
export function SiteHeader() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

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
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={item.href === pathname ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          ))}
          <Link className="nav-cta" href="/#check" onClick={() => setOpen(false)}>
            Run a check
          </Link>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <Link className="button button--quiet" href="/login">
            Sign in
          </Link>
          <Link className="button button--accent" href="/#check">
            <Icon name="search" strokeWidth={1.9} />
            Run a check
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
