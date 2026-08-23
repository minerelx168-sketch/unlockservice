import Link from 'next/link'
import { Icon } from './icons'

/**
 * The lockup, used by the header, the footer and the sign-in card. The
 * leading "i" takes the accent; the rest stays in ink, because the rest of
 * the page rations colour and a two-tone wordmark would fight it.
 */
export function Brand() {
  return (
    <Link className="brand" href="/">
      <span className="mark" aria-hidden="true">
        <Icon name="unlockMark" strokeWidth={1.9} />
      </span>
      <span>
        <span className="name">
          <span className="name-i">i</span>UnlockMobile
        </span>
        <span className="t-micro">IMEI unlocking</span>
      </span>
    </Link>
  )
}
