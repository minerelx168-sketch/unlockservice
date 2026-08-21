import Link from 'next/link'
import { Brand } from './brand'

const COLUMNS = [
  {
    heading: 'Services',
    links: [
      { href: '/#services', label: 'Device identity' },
      { href: '/#services', label: 'Accounts & locks' },
      { href: '/#services', label: 'Unlock delivery' },
      { href: '/#check', label: 'Run a check' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { href: '/#how', label: 'How it works' },
      { href: '/#faq', label: 'Common questions' },
      { href: '/design-system', label: 'Design system' },
    ],
  },
  {
    heading: 'Contact',
    links: [
      { href: '/#faq', label: 'Support' },
      { href: '/#check', label: 'Start a lookup' },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="shell">
        <div className="footer-grid">
          <div>
            <Brand />
            <p className="blurb">
              Device identity, lock state and unlock delivery in one readable report — for buyers,
              repair teams, sellers and resellers.
            </p>
          </div>

          {COLUMNS.map((column) => (
            <div key={column.heading}>
              <h4>{column.heading}</h4>
              <ul className="footer-links">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link href={link.href}>{link.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="footer-base">
          <span>&copy; {new Date().getFullYear()} Openline. All rights reserved.</span>
          <span>Checks return information about a device — they do not transfer ownership.</span>
        </div>
      </div>
    </footer>
  )
}
