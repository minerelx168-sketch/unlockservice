import Link from 'next/link'
import { Brand } from './brand'
import { PaymentMark } from './payment-badges'

export type FooterGuide = { href: string; label: string }

const COLUMNS = [
  {
    heading: 'Services',
    links: [
      { href: '/services', label: 'Service categories' },
      { href: '/services/unlock', label: 'Unlock Service' },
      { href: '/services/imei-check', label: 'Phone Check' },
      { href: '/check', label: 'Apple Free Check' },
      { href: '/register', label: 'Create an account' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { href: '/track', label: 'Track an order' },
      { href: '/support', label: 'Help centre' },
      { href: '/contact', label: 'Contact us' },
      { href: '/#faq', label: 'Common questions' },
      { href: '/login', label: 'Sign in' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { href: '/terms', label: 'Terms of service' },
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms#refunds', label: 'Refunds and refused orders' },
    ],
  },
]

type Props = {
  isAuthenticated?: boolean
  guides: FooterGuide[]
}

/**
 * Brand and one line on what the service is, four link columns, then what
 * we accept. Deliberately quiet: the selling happened above the footer.
 */
export function SiteFooter({ isAuthenticated = false, guides }: Props) {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div>
            <Brand />
            <p className="blurb">
              Network-unlock services and device reports for phones you own.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h4>{column.heading}</h4>
              <ul className="footer-links">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link href={link.href === '/login' && isAuthenticated ? '/user/dashboard' : link.href}>
                      {link.href === '/login' && isAuthenticated ? 'My account' : link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4>Guides</h4>
            <ul className="footer-links">
              {guides.map((guide) => (
                <li key={guide.href}>
                  <Link href={guide.href}>{guide.label}</Link>
                </li>
              ))}
              <li>
                <Link href="/articles">All guides →</Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="footer-accept">
          <span>We Accept:</span>
          {['visa', 'mastercard', 'googlepay', 'applepay', 'bitcoin', 'usdt'].map((method) => (
            <PaymentMark method={method} key={method} />
          ))}
        </div>

        <div className="footer-base">
          <span>&copy; 2016–{new Date().getFullYear()} iUnlockMobile. All rights reserved.</span>
          <span>Unlocking releases a device you own — it does not remove a finance agreement or a theft report.</span>
        </div>
      </div>
    </footer>
  )
}

