import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { MotionEffects } from '@/components/motion-effects'
import { PublicFooter, PublicHeader } from '@/components/site-chrome'

/** Public pages invite full snippets; noindex pages (checkout, catalog) override this per page. */
export const metadata: Metadata = {
  robots: {
    index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1,
    googleBot: { index: true, follow: true, 'max-snippet': -1, 'max-image-preview': 'large', 'max-video-preview': -1 },
  },
}

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
