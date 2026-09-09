import type { Metadata } from 'next'
import Link from 'next/link'
import { PaidReportConsole } from '@/components/paid-report-console'
import { requireSession } from '@/lib/auth'
import { listPaidReportProducts } from '@/lib/paid-reports'
import { GATEWAYS } from '@/lib/payments'

export const metadata: Metadata = { title: 'Order a device service' }
export const dynamic = 'force-dynamic'

export default async function NewPaidReportPage({
  searchParams,
}: {
  searchParams: Promise<{ product?: string | string[] }>
}) {
  const { user, session } = await requireSession()
  const available = user.credit_cents - user.held_cents
  const products = listPaidReportProducts()
  const query = await searchParams
  const requestedProduct = Array.isArray(query.product) ? query.product[0] : query.product
  const initialProductCode = products.some((product) => product.code === requestedProduct)
    ? requestedProduct
    : undefined

  return (
    <>
      <div className="app-head">
        <div>
          <span className="kicker">Provider services</span>
          <h1>Order a device service</h1>
          <p>
            Choose a phone check or remote unlock service. Review the price and estimated delivery before confirming.
          </p>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 10 }}>
          <Link className="link-arrow" href="/user/reports">Service history</Link>
        </div>
      </div>

      <PaidReportConsole
        products={products.map((product) => ({
          code: product.code,
          name: product.name,
          summary: product.summary,
          group: product.group,
          domain: product.domain,
          priceCents: product.priceCents,
          etaMinutes: product.etaMinutes,
          providerReady: product.providerReady,
        }))}
        csrfToken={session.csrfToken}
        availableCents={available}
        initialProductCode={initialProductCode}
        paymentMethods={GATEWAYS.map((gateway) => `${gateway.asset} on ${gateway.network}`)}
      />

      <p className="t-small" style={{ marginTop: 18 }}>
        Need only format and checksum validation? <Link href="/check">Use the Free IMEI Check</Link>; it does not use your credit.
      </p>
    </>
  )
}
