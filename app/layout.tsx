import { headers } from 'next/headers'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'iUnlockMobile — permanent IMEI phone unlocking',
    template: '%s — iUnlockMobile',
  },
  description:
    'Unlock a phone from its carrier by IMEI. Filed with the network that holds the lock, permanent through updates and resets, and refunded in full if the carrier refuses.',
}

export const viewport: Viewport = {
  colorScheme: 'light dark',
}

/**
 * Stamps the theme before first paint so a dark reload never flashes
 * white. It runs ahead of hydration and writes data-theme on <html>,
 * which is why the element carries suppressHydrationWarning.
 */
const THEME_GUARD = `(function(){try{var s=localStorage.getItem('iunlockmobile-theme');var m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',s||m)}catch(e){}})()`

const PRELOADED_FONTS = ['/fonts/bricolage-grotesque-3.woff2', '/fonts/instrument-sans-2.woff2']

export default async function RootLayout({ children }: { children: ReactNode }) {
  /* Minted per request in middleware.ts, which is also where the policy that
     makes it mean anything is written. Next.js stamps its own streamed
     scripts with it; this one has to be given the nonce by hand. */
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {PRELOADED_FONTS.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
        ))}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_GUARD }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
