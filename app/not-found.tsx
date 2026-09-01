import Link from 'next/link'
import { Brand } from '@/components/brand'
import { Icon } from '@/components/icons'

export const metadata = { title: 'Page not found' }

/**
 * Every route that does not resolve, public or otherwise. It carries the
 * brand rather than the framework default, and it offers the two things
 * someone who mistyped a URL is actually looking for.
 */
export default function NotFound() {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand />
        <h1>That page is not here.</h1>
        <p>
          The link may be out of date, or the address may have a typo in it. Nothing has gone wrong
          with your account or any order you have placed.
        </p>
        <div className="cta-actions">
          <Link className="button button--primary" href="/">
            <Icon name="arrowRight" strokeWidth={2.2} />
            Back to the homepage
          </Link>
          <Link className="button button--quiet" href="/user/orders">
            <Icon name="clock" strokeWidth={1.9} />
            Find an order
          </Link>
        </div>
      </div>
    </div>
  )
}
