import type { Metadata } from 'next'
import Link from 'next/link'
import { PaidReportConsole } from '@/components/paid-report-console'
import { requireSession } from '@/lib/auth'
import { listPaidReportProducts } from '@/lib/paid-reports'
import { GATEWAYS } from '@/lib/payments'

export const metadata: Metadata = { title: 'Buy an IMEI report' }
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
          <span className="kicker">Paid reports</span>
          <h1>Buy an IMEI report</h1>
          <p>
            Check your phone’s details with a paid report. Review the price before confirming.
          </p>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 10 }}>
          <Link className="link-arrow" href="/user/reports">Report history</Link>
        </div>
      </div>

      <PaidReportConsole
        products={products.map((product) => ({
          code: product.code,
          name: product.name,
          summary: product.summary,
          group: product.group,
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
