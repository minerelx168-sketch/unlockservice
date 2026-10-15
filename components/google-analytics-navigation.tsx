'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

type BrowserWithAnalytics = Window & {
  iunlockmobileAnalyticsConsent?: string
  gtag?: (...args: unknown[]) => void
}

function safeExternalReferrerOrigin(): string {
  try {
    const referrer = document.referrer
    if (!referrer) return ''
    const url = new URL(referrer)
    const host = url.hostname.toLowerCase().replace(/\.$/, '')
    if (!['http:', 'https:'].includes(url.protocol)) return ''
    if (host === 'iunlockmobile.com' || host === 'www.iunlockmobile.com' || host === 'accounts.google.com') return ''
    return url.origin
  } catch {
    return ''
  }
}

function pagePath(pathname: string): string {
  const first = pathname.split('/')[1]
  return ['user', 'admin', 'api'].includes(first) ? '/account' : pathname || '/'
}

/** The root gtag config owns the initial page_view; this covers later App Router navigations only. */
export function GoogleAnalyticsNavigation() {
  const pathname = usePathname() ?? '/'
  const firstPath = useRef<string | null>(null)
  const lastPath = useRef<string | null>(null)

  useEffect(() => {
    const browser = window as BrowserWithAnalytics
    const host = window.location.hostname.toLowerCase().replace(/\.$/, '')
    if (host !== 'iunlockmobile.com' && host !== 'www.iunlockmobile.com') return
    const nextPath = pagePath(pathname)
    if (firstPath.current === null) {
      firstPath.current = pathname
      lastPath.current = pathname
      return
    }
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    if (browser.iunlockmobileAnalyticsConsent !== 'granted') return
    if (typeof browser.gtag !== 'function') return
    browser.gtag('event', 'page_view', {
      page_location: `${window.location.origin}${nextPath}`,
      page_referrer: safeExternalReferrerOrigin(),
      page_title: 'iUnlockMobile',
    })
  }, [pathname])

  return null
}
