'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Brand } from './brand'
import { Icon, type IconName } from './icons'
import { ThemeToggle } from './theme-toggle'

const NAV: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/services/unlock', label: 'Unlock Service', icon: 'lock' },
  { href: '/services/imei-check', label: 'Phone Check', icon: 'search' },
  { href: '/articles', label: 'Article', icon: 'file' },
  { href: '/login', label: 'Order Tracking', icon: 'clock' },
  { href: '/contact', label: 'Contact us', icon: 'mail' },
]

/**
 * Actions read toggle → quiet account → Signal Blue catalog CTA, so the
 * strongest action sits furthest right. Below 1320px the nav becomes a panel and the buttons
 * step aside — see the media queries in components.css.
 */
export function SiteHeader({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const accountHref = isAuthenticated ? '/user/check' : '/login'
  const accountLabel = isAuthenticated ? 'My account' : 'Sign in'

  useEffect(() => {
    if (!open) return
    headerRef.current?.querySelector<HTMLAnchorElement>('.site-nav a')?.focus()

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      toggleRef.current?.focus()
    }
    function dismissOutside(event: PointerEvent | FocusEvent) {
      if (event.target instanceof Node && !headerRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', dismissOutside)
    document.addEventListener('focusin', dismissOutside)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', dismissOutside)
      document.removeEventListener('focusin', dismissOutside)
    }
  }, [open])

  return (
    <header className="site-header" ref={headerRef}>
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
            // Keep the section highlighted while reading an individual article.
            const active = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <Link
                key={item.label}
                href={href}
                className={`nav-link${item.href === '/articles' ? ' nav-link--article' : ''}`}
                data-active={active ? 'true' : undefined}
                aria-current={href === pathname ? 'page' : undefined}
                onClick={() => setOpen(false)}
              >
                <Icon name={item.icon} strokeWidth={1.9} />
                <span>{item.label}</span>
              </Link>
            )
          })}
          <Link className="nav-cta" href="/services" onClick={() => setOpen(false)}>
            Browse services
          </Link>
          <Link className="nav-account" href={accountHref} onClick={() => setOpen(false)}>
            {accountLabel}
          </Link>
        </nav>

        <div className="header-actions">
          <ThemeToggle />
          <Link className="button button--quiet" href={accountHref}>
            {accountLabel}
          </Link>
          {/* The label collapses on a phone and the icon carries the button,
              so the call to action survives without pushing the navigation
              toggle off the edge of the screen. aria-label keeps the name
              for anyone not reading the icon. */}
          <Link className="button button--primary" href="/services" aria-label="Browse services">
            <Icon name="search" strokeWidth={1.9} />
            <span className="button-label">Browse services</span>
          </Link>
          <button
            type="button"
            className="icon-action nav-toggle"
            ref={toggleRef}
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="site-nav"
            aria-label={open ? 'Close navigation' : 'Open navigation'}
          >
            <Icon name={open ? 'cross' : 'menu'} />
          </button>
        </div>
      </div>
    </header>
  )
}
