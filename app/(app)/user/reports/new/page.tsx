import type { Metadata } from 'next'
import Link from 'next/link'
import { PaidReportConsole } from '@/components/paid-report-console'
import { requireSession } from '@/lib/auth'
import { formatUsd } from '@/lib/money'
import { listPaidReportProducts } from '@/lib/paid-reports'

export const metadata: Metadata = { title: 'Buy an IMEI report' }
export const dynamic = 'force-dynamic'

export default async function NewPaidReportPage() {
  const { user, session } = await requireSession()
  const available = user.credit_cents - user.held_cents
  const products = listPaidReportProducts()

  return (
    <>
      <div className="app-head">
        <div>
          <span className="kicker">Paid reports</span>
          <h1>Buy an IMEI report</h1>
          <p>
            Choose a report with a fixed USD credit price. This is separate from the Free IMEI Check:
            credit is held at submission and charged only after a usable Provider report is delivered.
          </p>
        </div>
        <div style={{ display: 'grid', justifyItems: 'end', gap: 10 }}>
          <span className="t-small">{formatUsd(available)} available</span>
          <Link className="link-arrow" href="/user/reports">Report history</Link>
        </div>
      </div>

      <PaidReportConsole
        products={products.map((product) => ({
          code: product.code,
          name: product.name,
          summary: product.summary,
          priceCents: product.priceCents,
          etaMinutes: product.etaMinutes,
          providerReady: product.providerReady,
        }))}
        csrfToken={session.csrfToken}
        availableCents={available}
      />

      <p className="t-small" style={{ marginTop: 18 }}>
        Need only format and checksum validation? <Link href="/check">Use the Free IMEI Check</Link>; it never uses paid Provider data or customer credit.
      </p>
    </>
  )
}
