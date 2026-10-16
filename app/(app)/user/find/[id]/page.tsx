import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Icon } from '@/components/icons'
import { requireSession } from '@/lib/auth'
import { getOrder } from '@/lib/orders'
import { getPaidReport } from '@/lib/paid-reports'

export const dynamic = 'force-dynamic'

/**
 * Where the public "find my order" box lands. It searches both order
 * families, but only within the signed-in account — a number that belongs
 * to someone else looks exactly like a number that was never issued.
 */
export default async function FindOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requireSession()
  const { id } = await params
  const orderId = /^[1-9]\d{0,11}$/.test(id) ? Number(id) : null

  if (orderId !== null) {
    if (getOrder(orderId, user.id)) redirect(`/user/orders/${orderId}`)
    if (getPaidReport(user.id, orderId)) redirect(`/user/reports/${orderId}`)
  }

  return (
    <>
      <div className="app-head">
        <div>
          <span className="kicker">
            <Icon name="search" strokeWidth={2} />
            Order lookup
          </span>
          <h1>No order {orderId !== null ? `#${orderId}` : ''} on this account.</h1>
          <p>
            The number may belong to a different account, or may have a typo. Your own orders are
            listed below.
          </p>
        </div>
      </div>
      <div className="cta-actions">
        <Link className="button button--primary" href="/user/orders">
          <Icon name="clock" strokeWidth={1.9} />
          Your orders
        </Link>
        <Link className="button button--quiet" href="/user/reports">
          Your reports
        </Link>
        <Link className="button button--quiet" href="/track">
          Try another number
        </Link>
      </div>
    </>
  )
}
