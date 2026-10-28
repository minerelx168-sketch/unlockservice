import { pageMetadata } from '@/lib/seo'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Icon } from '@/components/icons'
import { WaitlistForm } from '@/components/waitlist-form'
import { CARRIERS } from '@/lib/catalog'
import { storefrontAvailability } from '@/lib/storefront-availability'



export const dynamic = 'force-dynamic'

export const metadata = pageMetadata("/unlock-waitlist", "Phone Unlock Availability Notifications", "Join the phone unlocking waitlist for an availability update. Browse currently available IMEI reports and check service requirements before ordering.")

export default function UnlockWaitlistPage() {
  /* The moment ordering opens this page has nothing to offer, and the
     ticket asked that every route come back without a deploy. */
  if (storefrontAvailability('unlock').accepting) redirect('/services/unlock')

  return (
    <section className="section section--tint">
      <div className="shell split">
        <div className="stack" style={{ gap: 18 }}>
          <span className="kicker">
            <Icon name="lock" strokeWidth={2} /> Unlock Service
          </span>
          <h1 className="t-section">Unlock availability updates.</h1>
          <p className="t-lead">
            No unlock services are currently available for online ordering. Availability depends on
            the service and its verified ordering requirements. Leave an address for an availability
            update. We have not set a reopening date.
          </p>
          <p className="hero-asides">
            <Link href="/services/unlock">See unlock prices</Link>
            <span aria-hidden="true">·</span>
            <Link href="/services/imei-check">Order a phone check today</Link>
          </p>
          <p className="t-small">
            A phone check runs today and tells you the carrier the device is locked to, whether it
            is blacklisted, and what the warranty status is — the things worth knowing before an
            unlock is worth ordering.
          </p>
        </div>

        <WaitlistForm
          carriers={CARRIERS.map((carrier) => ({
            id: carrier.id,
            name: carrier.name,
            country: carrier.country,
          }))}
        />
      </div>
    </section>
  )
}
