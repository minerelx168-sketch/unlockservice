import Link from 'next/link'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { Icon } from '@/components/icons'
import { currentSession } from '@/lib/auth'

export const metadata = { title: 'Page not found' }

/**
 * Every route that does not resolve.
 *
 * It carries the site's own header and footer rather than the framework
 * default, because a dead end with no navigation is a dead end twice: the
 * link was wrong and now there is nowhere to go from it. The three routes
 * below are the ones someone who mistyped a URL is actually after.
 *
 * There is deliberately no IMEI field here yet. Until the quote work lands
 * a box on this page could only carry the number somewhere else to be
 * typed again, and a control that looks like it does something is worse
 * than a signpost that admits it is one.
 */
export default async function NotFound() {
  const isAuthenticated = (await currentSession()) !== null

  return (
    <>
      <SiteHeader isAuthenticated={isAuthenticated} />
      <main className="section">
        <div className="shell stack" style={{ gap: 22, maxWidth: 640 }}>
          <span className="kicker">
            <Icon name="info" strokeWidth={2} />
            404
          </span>
          <h1 className="t-section">That page is not here.</h1>
          <p className="t-lead">
            The link may be out of date, or the address may have a typo in it. Nothing has gone
            wrong with your account or with any order you have placed.
          </p>
          <div className="cta-actions">
            <Link className="button button--primary" href="/services/imei-check">
              <Icon name="search" strokeWidth={1.9} />
              Check a phone
            </Link>
            <Link className="button button--quiet" href="/services">
              Browse all services
            </Link>
            <Link className="button button--quiet" href={isAuthenticated ? '/user/orders' : '/login'}>
              <Icon name="clock" strokeWidth={1.9} />
              {isAuthenticated ? 'Your orders' : 'Find an order'}
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter isAuthenticated={isAuthenticated} />
    </>
  )
}
