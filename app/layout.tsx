import { headers } from 'next/headers'
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { publicOrigin } from '@/lib/site'
import '@/styles/globals.css'
import { AnalyticsConsent } from '@/components/analytics-consent'

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

export default async function RootLayout({ children }: { children: ReactNode }) {
  /* Minted per request in middleware.ts, which is also where the policy that
     makes it mean anything is written. Next.js stamps its own streamed
     scripts with it; this one has to be given the nonce by hand. */
  const nonce = (await headers()).get('x-nonce') ?? undefined
  const googleAdsTag = 'AW-18465855968'
  const googleAnalyticsTag = 'G-9WCELVR3V3'
  // One nonce-bearing Google tag snippet in <head>, configured for both destinations.
  const googleTagBootstrap = `window.dataLayer = window.dataLayer || []; function gtag(){dataLayer.push(arguments);} gtag('consent', 'default', {analytics_storage: 'denied', ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied'}); gtag('set', 'ads_data_redaction', true); gtag('set', 'url_passthrough', false); gtag('set', {page_location: location.origin + (['user','admin','api'].includes(location.pathname.split('/')[1]) ? '/account' : location.pathname), page_referrer: '', page_title: 'iUnlockMobile'}); gtag('js', new Date()); gtag('config', '${googleAdsTag}', {page_location: location.origin + (['user','admin','api'].includes(location.pathname.split('/')[1]) ? '/account' : location.pathname), page_referrer: '', page_title: 'iUnlockMobile'}); gtag('config', '${googleAnalyticsTag}', {page_location: location.origin + (['user','admin','api'].includes(location.pathname.split('/')[1]) ? '/account' : location.pathname), page_referrer: '', page_title: 'iUnlockMobile'});`

  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        {PRELOADED_FONTS.map((href) => (
          <link key={href} rel="preload" href={href} as="font" type="font/woff2" crossOrigin="" />
        ))}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_GUARD }} />
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: googleTagBootstrap }} />
        <script async nonce={nonce} src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsTag}`} />
      </head>
      <body>{children}<AnalyticsConsent /></body>
    </html>
  )
}
