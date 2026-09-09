import Link from 'next/link'
import { PaidReportConsole } from './paid-report-console'
import { requireSession } from '@/lib/auth'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor, type DeviceDomain } from '@/lib/device-intent-value'
import { listPaidReportProducts } from '@/lib/paid-reports'
import { GATEWAYS } from '@/lib/payments'
import { hasServiceOutputExample } from '@/lib/service-output-examples'

/** Workspace entry points and payment returns share one explicit review flow. */
export async function ServiceOrderWorkspace({ domain, requestedProduct }: { domain?: DeviceDomain; requestedProduct?: string }) {
  const [{ user, session }, intent] = await Promise.all([requireSession(), readDeviceIntent()])
  const products = listPaidReportProducts()
  const selected = products.find((product) => product.code === requestedProduct && (!domain || product.domain === domain))
  const initialDomain = domain ?? selected?.domain ?? intent?.domain ?? 'imei_check'
  const title = domain === 'unlock' ? 'Unlock services' : domain === 'imei_check' ? 'Phone Check' : 'Review your device service'

  return (
    <>
      <div className="app-head service-workspace-title">
        <div><h1>{title}</h1></div>
      </div>
      <PaidReportConsole
        key={`${domain ?? 'all'}:${selected?.code ?? 'choose'}`}
        products={products.map((product) => ({
          code: product.code, name: product.name, summary: product.summary,
          group: product.group, domain: product.domain, priceCents: product.priceCents,
          etaMinutes: product.etaMinutes, providerReady: product.providerReady,
          hasExample: hasServiceOutputExample(product.code),
        }))}
        csrfToken={session.csrfToken}
        availableCents={user.credit_cents - user.held_cents}
        initialProductCode={selected?.code}
        initialDomain={initialDomain}
        initialImei={intentImeiFor(intent, initialDomain, selected?.code)}
        paymentMethods={GATEWAYS.map((gateway) => `${gateway.asset} on ${gateway.network}`)}
      />
      <p className="t-small" style={{ marginTop: 18 }}>
        Only need format and checksum validation? <Link href="/check">Use the Free IMEI Check</Link>; it does not use your credit.
      </p>
    </>
  )
}
