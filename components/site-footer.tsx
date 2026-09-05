import Link from 'next/link'
import { Brand } from './brand'

const COLUMNS = [
  {
    heading: 'Services',
    links: [
      { href: '/services', label: 'Service categories' },
      { href: '/services/unlock', label: 'Unlock Service' },
      { href: '/services/imei-check', label: 'Phone Check' },
      { href: '/user/reports/new', label: 'Paid IMEI reports' },
      { href: '/register', label: 'Create an account' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { href: '/#how', label: 'How it works' },
      { href: '/#faq', label: 'Common questions' },
    ],
  },
  {
    heading: 'Contact',
    links: [
      { href: '/#faq', label: 'Support' },
      { href: '/login', label: 'Sign in' },
    ],
  },
]

export function SiteFooter({ isAuthenticated = false }: { isAuthenticated?: boolean }) {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div>
            <Brand />
            <p className="blurb">
              Permanent IMEI unlocking, filed with the network that holds the lock. For people
              selling a phone, switching network, or travelling with one they already own.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h4>{column.heading}</h4>
              <ul className="footer-links">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link href={link.href === '/login' && isAuthenticated ? '/user/unlock' : link.href}>
                      {link.href === '/login' && isAuthenticated ? 'My account' : link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-base">
          <span>&copy; {new Date().getFullYear()} iUnlockMobile. All rights reserved.</span>
          <span>Unlocking releases a device you own — it does not remove a finance agreement or a theft report.</span>
        </div>
      </div>
    </footer>
  )
}
