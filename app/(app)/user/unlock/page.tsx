import type { Metadata } from 'next'
import Link from 'next/link'
import { OrderConsole } from '@/components/order-console'
import { requireSession } from '@/lib/auth'
import { listBrands, listCarriers, listDeviceServices } from '@/lib/db'
import { formatUsd } from '@/lib/money'
import { maintenanceState } from '@/lib/provider'
import { readQuote } from '@/lib/quote'

export const metadata: Metadata = { title: 'Unlock a device' }
export const dynamic = 'force-dynamic'

export default async function UnlockPage() {
  const { user, session } = await requireSession()
  const available = user.credit_cents - user.held_cents

  /* Whatever they entered on the homepage. middleware.ts drops the cookie
     as soon as they move anywhere else in the workspace. */
  const quote = await readQuote()

  return (
    <>
      <div className="app-head">
        <div>
          <h1>Unlock a device</h1>
          <p>
            The request goes to the carrier or manufacturer against the IMEI. Apple devices are
            released remotely; everything else comes back as a code. Nothing is charged until the
            unlock is actually delivered.
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

      <OrderConsole
        brands={listBrands().map((brand) => ({
          id: brand.id,
          name: brand.name,
          delivery: brand.delivery,
        }))}
        carriers={listCarriers().map((carrier) => ({
          id: carrier.id,
          name: carrier.name,
          country: carrier.country,
          priceCents: carrier.price_cents,
          etaHours: carrier.eta_hours,
        }))}
        services={listDeviceServices().map((service) => ({
          id: service.id,
          name: service.name,
          summary: service.summary,
          priceCents: service.price_cents,
          etaHours: service.eta_hours,
          brandIds: service.brand_ids ? service.brand_ids.split(',').map(Number) : [],
        }))}
        csrfToken={session.csrfToken}
        availableCents={available}
        defaultEmail={user.email}
        maintenance={maintenanceState()}
        initialImei={quote?.imei}
        initialCarrierId={quote?.carrierId}
      />
    </>
  )
}
