import { headers } from 'next/headers'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { publicOrigin } from '@/lib/site'
import '@/styles/globals.css'

const DESCRIPTION =
  'Unlock a phone from its carrier by IMEI. Filed with the network that holds the lock, permanent through updates and resets, with reserved account credit returned if the carrier refuses.'

export const metadata: Metadata = {
  metadataBase: new URL(publicOrigin()),
  title: {
    default: 'iUnlockMobile — permanent IMEI phone unlocking',
    template: '%s — iUnlockMobile',
  },
  description: DESCRIPTION,
  /* Without these a link pasted into WhatsApp, LINE or Telegram — which is
     how most of this market shares anything — arrives as a bare URL. */
  openGraph: {
    type: 'website',
    siteName: 'iUnlockMobile',
    title: 'iUnlockMobile — permanent IMEI phone unlocking',
    description: DESCRIPTION,
    url: '/',
  },
  twitter: { card: 'summary_large_image' },
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

/* The latin subsets only — latin-ext covers accented names and is fetched
   on demand by the browser when a glyph in it is actually used. */
const PRELOADED_FONTS = ['/fonts/inter-latin.woff2', '/fonts/inter-tight-latin.woff2']
const GTM_ID = 'GTM-PDB4DNWC'
// Single analytics loader: the published container owns Ads, GA4, Conversion
// Linker, and charged-purchase tracking. Never load gtag.js separately here.
const GTM_BOOTSTRAP = `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`

export default async function RootLayout({ children }: { children: ReactNode }) {
  /* Minted per request in middleware.ts. strict-dynamic authorizes GTM's
     script only through this nonce-bearing bootstrap. */
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: GTM_BOOTSTRAP }} />
        {PRELOADED_FONTS.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
        ))}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_GUARD }} />
      </head>
      <body>
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            title="Google Tag Manager"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>
        {children}
      </body>
    </html>
  )
}
