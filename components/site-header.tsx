'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useCallback, useState, type ReactNode } from 'react'
import { Brand } from './brand'
import { Icon, type IconName } from './icons'
import { SiteDrawer, type DrawerGroup, type DrawerLink } from './site-drawer'
import { ThemeToggle } from './theme-toggle'

const NAV: Array<{ href: string; label: string; icon: IconName }> = [
  { href: '/services/unlock', label: 'Unlock Service', icon: 'lock' },
  { href: '/services/imei-check', label: 'Phone Check', icon: 'search' },
  { href: '/articles', label: 'Article', icon: 'file' },
  { href: '/track', label: 'Order Tracking', icon: 'clock' },
  { href: '/contact', label: 'Contact us', icon: 'mail' },
]

type Props = {
  isAuthenticated?: boolean
  drawerGroups: DrawerGroup[]
  drawerLinks: DrawerLink[]
  accountSlot?: ReactNode
}

/**
 * Brand, the five primary links, and the actions: theme → quiet account →
 * the one filled call to action → the menu. The menu is permanent. On a
 * wide screen it opens the full service tree the five links only summarise;
 * below 1320px the links step aside and it is the navigation.
 *
 * The drawer is rendered as a sibling of the header, not inside it: the
 * header's backdrop-filter makes it the containing block for anything
 * position:fixed, which would clip the sheet to 78px.
 */
export function SiteHeader({ isAuthenticated = false, drawerGroups, drawerLinks, accountSlot }: Props) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const close = useCallback(() => setOpen(false), [])
  const accountHref = isAuthenticated ? '/user/dashboard' : '/login'
  const accountLabel = isAuthenticated ? 'My account' : 'Sign in'

  return (
    <>
      <header className="site-header">
        <div className="shell">
          <Brand />

          <nav className="site-nav" id="site-nav" aria-label="Primary">
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
                >
                  <Icon name={item.icon} strokeWidth={1.9} />
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </nav>

          <div className="header-actions">
            <ThemeToggle />
            <Link className="button button--quiet" href={accountHref}>
              {accountLabel}
            </Link>
            {/* The label collapses on a phone and the icon carries the button,
                so the call to action survives without pushing the menu off
                the edge of the screen. aria-label keeps the name for anyone
                not reading the icon. */}
            <Link className="button button--primary" href="/services" aria-label="Browse services">
              <Icon name="search" strokeWidth={1.9} />
              <span className="button-label">Browse services</span>
            </Link>
            <button
              type="button"
              className="icon-action nav-toggle"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="site-drawer"
              aria-label="Open navigation"
            >
              <Icon name="menu" />
            </button>
          </div>
        </div>
      </header>

      <SiteDrawer
        open={open}
        onClose={close}
        groups={drawerGroups}
        links={drawerLinks}
        isAuthenticated={isAuthenticated}
        accountSlot={accountSlot}
      />
    </>
  )
}
