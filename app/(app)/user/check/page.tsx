import type { Metadata } from 'next'
import { ServiceOrderWorkspace } from '@/components/service-order-workspace'

export const metadata: Metadata = { title: 'Phone Check' }
export const dynamic = 'force-dynamic'

export default function DeviceWorkspacePage() {
  return <ServiceOrderWorkspace domain="imei_check" />
}
