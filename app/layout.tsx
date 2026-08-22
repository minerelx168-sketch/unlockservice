import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Openline — permanent IMEI phone unlocking',
    template: '%s — Openline',
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
const THEME_GUARD = `(function(){try{var s=localStorage.getItem('openline-theme');var m=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.setAttribute('data-theme',s||m)}catch(e){}})()`

const PRELOADED_FONTS = ['/fonts/bricolage-grotesque-3.woff2', '/fonts/instrument-sans-2.woff2']

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {PRELOADED_FONTS.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
        ))}
        <script dangerouslySetInnerHTML={{ __html: THEME_GUARD }} />
      </head>
      <body>{children}</body>
    </html>
  )
}
