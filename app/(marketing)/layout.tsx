import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { MotionEffects } from '@/components/motion-effects'
import { PublicFooter, PublicHeader } from '@/components/site-chrome'

export const metadata: Metadata = { robots: { googleBot: { 'max-snippet': -1 } } }

/** Public pages keep the marketing chrome; account state is resolved on the server. */
export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
      <MotionEffects />
    </>
  )
}
