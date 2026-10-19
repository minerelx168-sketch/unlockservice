import type { ReactNode } from 'react'
import { CustomerTimeNotice, CustomerTimeProvider } from '@/components/customer-time'

export default function CustomerLayout({ children }: { children: ReactNode }) {
  return <CustomerTimeProvider>{children}<CustomerTimeNotice /></CustomerTimeProvider>
}
