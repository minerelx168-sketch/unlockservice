import type { Metadata } from 'next'
import Link from 'next/link'
import { CheckConsole } from '@/components/check-console'
import { requireSession } from '@/lib/auth'
import { listServices } from '@/lib/db'
import { formatUsd } from '@/lib/money'
import { maintenanceState } from '@/lib/provider'

export const metadata: Metadata = { title: 'Run a check' }
export const dynamic = 'force-dynamic'

export default async function CheckPage() {
  const { user, session } = await requireSession()
  const available = user.credit_cents - user.held_cents

  const services = listServices().map((service) => ({
    id: service.id,
    name: service.name,
    sellPriceCents: service.sell_price_cents,
    identifierType: service.identifier_type,
  }))

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Run a check</h1>
          <p>
            Credit is held when the order goes out and only becomes a charge once the provider
            answers. A failed lookup gives it straight back.
          </p>
        </div>
        {available <= 0 ? (
          <Link className="button button--accent" href="/user/add-funds">
            Add funds
          </Link>
        ) : (
          <span className="t-small">{formatUsd(available)} available</span>
        )}
      </div>

      <CheckConsole
        services={services}
        csrfToken={session.csrfToken}
        availableCents={available}
        preferredKey={`openline-preferred-service-${user.id}`}
        maintenance={maintenanceState()}
      />
    </>
  )
}
