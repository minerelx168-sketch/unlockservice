import Link from 'next/link'
import { Icon } from './icons'

/** The lockup, used by both the header and the footer. */
export function Brand() {
  return (
    <Link className="brand" href="/">
      <span className="mark" aria-hidden="true">
        <Icon name="shieldCheck" strokeWidth={1.9} />
      </span>
      <span>
        <span className="name">Openline</span>
        <span className="t-micro">Device intelligence</span>
      </span>
    </Link>
  )
}
