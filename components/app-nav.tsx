'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'

const SECTIONS: Array<{ heading: string; items: Array<{ href: string; label: string; icon: IconName }> }> = [
  {
    heading: 'Work',
    items: [
      { href: '/user/dashboard', label: 'Dashboard', icon: 'grid' },
      { href: '/user/check', label: 'Phone Check', icon: 'search' },
      { href: '/user/services/unlock', label: 'Unlock services', icon: 'lock' },
      { href: '/user/orders', label: 'Orders', icon: 'clock' },
      { href: '/user/reports', label: 'Service history', icon: 'file' },
      { href: '/user/checks', label: 'Free check history', icon: 'keypad' },
    ],
  },
  {
    heading: 'Money',
    items: [
      { href: '/user/add-funds', label: 'Add funds', icon: 'wallet' },
      { href: '/user/payments', label: 'Payments', icon: 'ticket' },
    ],
  },
  {
    heading: 'Account',
    items: [{ href: '/user/reseller', label: 'Reseller API', icon: 'keypad' }, { href: '/user/profile', label: 'Profile', icon: 'user' }],
  },
]

export function AppNav({ isAdmin = false, children }: { isAdmin?: boolean; children?: ReactNode }) {
  const pathname = usePathname()
  const [openPath, setOpenPath] = useState<string | null>(null)
  const open = openPath === pathname
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    panelRef.current?.querySelector<HTMLAnchorElement>('a[aria-current="page"], a')?.focus()
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpenPath(null)
      toggleRef.current?.focus()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open])
  const sections = isAdmin
    ? [
        ...SECTIONS,
        {
          heading: 'Administration',
          items: [
            { href: '/admin', label: 'Control panel', icon: 'window' as IconName },
            { href: '/admin/guest-orders', label: 'Direct card orders', icon: 'file' as IconName },
            { href: '/admin/payments', label: 'Payment history', icon: 'file' as IconName },
            { href: '/admin/analytics', label: 'Customer analytics', icon: 'grid' as IconName },
          ],
        },
      ]
    : SECTIONS

  return (
    <div className="app-navigation" data-open={open ? 'true' : 'false'}>
      <button
        ref={toggleRef}
        type="button"
        className="button button--quiet app-nav-toggle"
        aria-expanded={open}
        aria-controls="workspace-navigation-panel"
        onClick={() => setOpenPath(open ? null : pathname)}
      >
        <Icon name={open ? 'cross' : 'menu'} />
        Menu
      </button>
      <div className="app-navigation-panel" id="workspace-navigation-panel" ref={panelRef}>
        <nav className="app-nav" aria-label="Workspace">
          {sections.map((section) => (
            <div key={section.heading}>
              <h5>{section.heading}</h5>
              {section.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`)) ? 'page' : undefined}
                  onClick={() => setOpenPath(null)}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>
        {children}
      </div>
    </div>
  )
}
