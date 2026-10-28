import Link from 'next/link'
import { Brand } from './brand'
import { Icon, type IconName } from './icons'

export type FooterGuide = { href: string; label: string }
export type FooterFact = { icon: IconName; title: string; caption: string }

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
  facts: FooterFact[]
}

/**
 * Brand and three facts, four link columns, then what we accept. The facts
 * come from the server so the footer can never claim more networks or
 * guides than the catalog actually holds.
 */
export function SiteFooter({ isAuthenticated = false, guides, facts }: Props) {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div>
            <Brand />
            <p className="blurb">
              Network-unlock services and device reports for phones you own.
              For people selling a phone, switching network, or travelling
              with one they already own.
            </p>
            <div className="footer-facts">
              {facts.map((fact) => (
                <div className="footer-fact" key={fact.title}>
                  <Icon name={fact.icon} strokeWidth={2} />
                  <div>
                    {fact.title}
                    <span>{fact.caption}</span>
                  </div>
                </div>
              ))}
            </div>
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
          {['Visa', 'Mastercard', 'Google Pay', 'Apple Pay', 'Bitcoin', 'USDT'].map((method) => (
            <span className="pay-badge" key={method}>{method}</span>
          ))}
          <span>Pay per order by card, or use your existing account credit.</span>
        </div>

        <div className="footer-base">
          <span>&copy; 2016–{new Date().getFullYear()} iUnlockMobile. All rights reserved.</span>
          <span>Unlocking releases a device you own — it does not remove a finance agreement or a theft report.</span>
        </div>
      </div>
    </footer>
  )
}

