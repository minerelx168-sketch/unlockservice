'use client'

import Link from 'next/link'
import { useEffect } from 'react'
import { Brand } from '@/components/brand'
import { Icon } from '@/components/icons'

/**
 * Anything a page throws.
 *
 * `error.digest` is all that crosses to the browser — Next.js withholds the
 * message itself in production precisely so a stack or a query never reaches
 * a customer, and the digest is what matches this screen to a line in the
 * server log. So the digest is shown and nothing else is: a message here
 * would either be useless or be something we did not mean to publish.
 *
 * An order is never lost to a failed render. Credit is held or charged by
 * the pipeline in its own transaction, not by the page that draws it.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[render]', error.digest ?? 'no digest')
  }, [error])

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Brand />
        <h1>Something went wrong on our side.</h1>
        <p>
          This is our problem, not yours. Nothing you were part-way through has been charged — credit
          is only ever moved when an unlock is actually delivered.
        </p>
        {error.digest ? (
          <p className="alert" role="status">
            <Icon name="info" strokeWidth={1.9} />
            <span>
              Quote <b className="mono">{error.digest}</b> if you contact support — it points us at
              the exact log entry.
            </span>
          </p>
        ) : null}
        <div className="cta-actions">
          <button className="button button--primary" type="button" onClick={reset}>
            <Icon name="arrowRight" strokeWidth={2.2} />
            Try again
          </button>
          <Link className="button button--quiet" href="/">
            Back to the homepage
          </Link>
        </div>
      </div>
    </div>
  )
}
