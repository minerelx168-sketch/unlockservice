import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Icon } from '@/components/icons'
import { WaitlistForm } from '@/components/waitlist-form'
import { CARRIERS } from '@/lib/catalog'
import { unlockOrderingEnabled } from '@/lib/provider'

export const metadata: Metadata = {
  title: 'Get told when phone unlocking opens',
  description:
    'Leave an email address and we will tell you the day network unlocking opens for ordering. Phone checks and reports are available now.',
}

export const dynamic = 'force-dynamic'

export default function UnlockWaitlistPage() {
  /* The moment ordering opens this page has nothing to offer, and the
     ticket asked that every route come back without a deploy. */
  if (unlockOrderingEnabled()) redirect('/services/unlock')

  return (
    <section className="section section--tint">
      <div className="shell split">
        <div className="stack" style={{ gap: 18 }}>
          <span className="kicker">
            <Icon name="lock" strokeWidth={2} /> Unlock Service
          </span>
          <h1 className="t-section">Unlock ordering opens soon.</h1>
          <p className="t-lead">
            We are still finishing the supplier connection that files unlocks with the networks. We
            have not set a date, and we would rather say so than name one we might miss. Leave an
            address and you will hear the day it is live — once, from us, and not again.
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
