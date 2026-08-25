'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icon, type IconName } from './icons'

const SECTIONS: Array<{ heading: string; items: Array<{ href: string; label: string; icon: IconName }> }> = [
  {
    heading: 'Work',
    items: [
      { href: '/user/dashboard', label: 'Dashboard', icon: 'window' },
      { href: '/user/unlock', label: 'Unlock a device', icon: 'bolt' },
      { href: '/user/orders', label: 'Orders', icon: 'clock' },
    ],
  },
  {
    heading: 'Money',
    items: [
      { href: '/user/add-funds', label: 'Add funds', icon: 'search' },
      { href: '/user/payments', label: 'Payments', icon: 'file' },
    ],
  },
]

export function AppNav({ isAdmin = false }: { isAdmin?: boolean }) {
  const pathname = usePathname()
  const sections = isAdmin
    ? [
        ...SECTIONS,
        {
          heading: 'Administration',
          items: [{ href: '/admin', label: 'Control panel', icon: 'window' as IconName }],
        },
      ]
    : SECTIONS

  return (
    <nav className="app-nav" aria-label="Workspace">
      {sections.map((section) => (
        <div key={section.heading}>
          <h5>{section.heading}</h5>
          {section.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={pathname.startsWith(item.href) ? 'page' : undefined}
            >
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  )
}
