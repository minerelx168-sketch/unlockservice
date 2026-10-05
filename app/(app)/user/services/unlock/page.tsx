import type { Metadata } from 'next'
import { ServiceOrderWorkspace } from '@/components/service-order-workspace'

export const metadata: Metadata = { title: 'Unlock services' }
export const dynamic = 'force-dynamic'

export default function DeviceWorkspacePage() {
  return <ServiceOrderWorkspace domain="unlock" />
}
