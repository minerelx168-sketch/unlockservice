import Link from 'next/link'
import { Icon } from '@/components/icons'
import { TrackOrderForm } from '@/components/track-order-form'
import { currentSession } from '@/lib/auth'
import { pageMetadata } from '@/lib/seo'

export const dynamic = 'force-dynamic'

export const metadata = pageMetadata(
  '/track',
  'Track Your Order',
  'Find the live status of an unlock or IMEI report order with your account email and order number.',
)

export default async function TrackOrderPage() {
  const found = await currentSession()

  return (
    <section className="section section--tint service-entry-section">
      <div className="shell">
        <nav className="service-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Home</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Track order</span>
        </nav>

        <div className="track-layout">
          <div className="section-head">
            <span className="kicker">
              <Icon name="clock" strokeWidth={2} />
              Order tracking
            </span>
            <h1 className="t-section">Track your order.</h1>
            <p className="t-lead">
              Every order shows where it is — with the network, delivered, or refused and refunded —
              and keeps its result on the order page for as long as you need it.
            </p>

          </div>

          <aside className="panel" style={{padding:20}}><h2>Paid without an account?</h2><p>Open the private tracking link in your payment confirmation email. No sign-in is needed. Check your spam folder, or contact support with your order reference if the email has not arrived.</p></aside>
          <TrackOrderForm defaultEmail={found?.user.email ?? ''} />

          <div className="track-details">
            <ul className="track-facts">
              <li>
                <Icon name="pulse" strokeWidth={2} />
                <span><b>Live status</b>Follow updates as your service is processed.</span>
              </li>
              <li>
                <Icon name="file" strokeWidth={2} />
                <span><b>The result stays put</b>Codes and reports remain on the order they were bought with.</span>
              </li>
              <li>
                <Icon name="shieldCheck" strokeWidth={2} />
                <span><b>Refusals refund</b>Direct card orders refund to the original payment method. Balance-paid orders release their reserved credit. Contact support for crypto refund review.</span>
              </li>
            </ul>

            {found ? (
              <p className="t-small">
                You are signed in — <Link href="/user/orders">see all your orders</Link> instead.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}
