import Link from 'next/link'
import { PaidReportConsole } from './paid-report-console'
import { requireSession } from '@/lib/auth'
import { readDeviceIntent } from '@/lib/device-intent'
import { intentImeiFor, type DeviceDomain } from '@/lib/device-intent-value'
import { listPaidReportProducts } from '@/lib/paid-reports'
import { GATEWAYS } from '@/lib/payments'
import { listStorefrontProviderProducts } from '@/lib/public-provider-catalog'
import { storefrontDomain } from '@/lib/service-groups'

/** Workspace entry points and payment returns share one explicit review flow. */
export async function ServiceOrderWorkspace({ domain, requestedProduct, fallbackImei }: { domain?: DeviceDomain; requestedProduct?: string; fallbackImei?: string }) {
  const [{ user, session }, intent] = await Promise.all([requireSession(), readDeviceIntent()])
  const orderable = new Map(listPaidReportProducts().map((product) => [product.code, product]))
  const products = [...listStorefrontProviderProducts('imei_check'), ...listStorefrontProviderProducts('unlock')]
  const selected = products.find((product) => product.productCode === requestedProduct)
  const initialDomain = (selected ? storefrontDomain(selected) : domain ?? intent?.domain) ?? 'imei_check'
  const title = initialDomain === 'unlock' ? 'Unlock services' : 'Phone Check'

  return (
    <>
      <div className="app-head service-workspace-title">
        <div><h1>{title}</h1></div>
      </div>
      <PaidReportConsole
        key={`${domain ?? 'all'}:${selected?.productCode ?? 'choose'}`}
        products={products.map((product) => ({
          code: product.productCode, name: product.name, summary: product.summary,
          group: product.group, domain: product.domain, priceCents: product.priceCents, priceAvailable: product.priceAvailable,
          etaMinutes: orderable.get(product.productCode)?.etaMinutes ?? 0, etaLabel: product.etaLabel,
          providerReady: product.status === 'available',
          hasExample: product.hasExample,
        }))}
        csrfToken={session.csrfToken}
        availableCents={user.credit_cents - user.held_cents}
        initialProductCode={selected?.productCode}
        initialDomain={initialDomain}
        initialImei={intentImeiFor(intent, selected?.domain ?? initialDomain, selected?.productCode) || (initialDomain === 'unlock' ? fallbackImei : undefined)}
        paymentMethods={GATEWAYS.map((gateway) => `${gateway.asset} on ${gateway.network}`)}
      />
      <p className="t-small" style={{ marginTop: 18 }}>
        Only need format and checksum validation? <Link href="/check">Use the Free IMEI Check</Link>; it does not use your credit.
      </p>
    </>
  )
}
