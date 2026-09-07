'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Brand } from './brand'
import { Icon } from './icons'
import { ThemeToggle } from './theme-toggle'

const NAV = [
  { href: '/services/unlock', label: 'Unlock Service' },
  { href: '/services/imei-check', label: 'Phone Check' },
  { href: '/#how', label: 'How it works' },
  { href: '/#faq', label: 'FAQ' },
  { href: '/login', label: 'Order Tracking' },
  { href: '/contact', label: 'Contact us' },
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
  const accountHref = isAuthenticated ? '/user/unlock' : '/login'
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
