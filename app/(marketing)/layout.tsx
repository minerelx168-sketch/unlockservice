import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { currentSession } from '@/lib/auth'

/** Public pages keep the marketing chrome and resolve account state on the server. */
export default async function MarketingLayout({ children }: { children: ReactNode }) {
  const isAuthenticated = (await currentSession()) !== null

  return (
    <>
      <SiteHeader isAuthenticated={isAuthenticated} />
      <main>{children}</main>
      <SiteFooter isAuthenticated={isAuthenticated} />
    </>
  )
}
