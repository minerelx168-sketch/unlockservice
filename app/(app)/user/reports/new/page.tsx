import type { Metadata } from 'next'
import { ServiceOrderWorkspace } from '@/components/service-order-workspace'

export const metadata: Metadata = { title: 'Order a device service' }
export const dynamic = 'force-dynamic'

export default async function NewPaidReportPage({ searchParams }: {
  searchParams: Promise<{ product?: string | string[] }>
}) {
  const query = await searchParams
  const product = Array.isArray(query.product) ? query.product[0] : query.product
  return <ServiceOrderWorkspace requestedProduct={product} />
}
