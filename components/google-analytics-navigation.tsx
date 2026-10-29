'use client'
import { analyticsActive } from '@/lib/google-consent-tracking'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { safeAnalyticsPage } from '@/lib/analytics-page'

type BrowserWithAnalytics = Window & {
  iunlockmobileAnalyticsConsent?: string
  gtag?: (...args: unknown[]) => void
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
    if (firstPath.current === null) {
      firstPath.current = pathname
      lastPath.current = pathname
      return
    }
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    if (pathname.startsWith('/admin') || document.documentElement.dataset.analyticsDisabled === 'true') return
    if (!analyticsActive()) return
    if (typeof browser.gtag !== 'function') return
    const page = safeAnalyticsPage(window.location.href, document.referrer)
    // Keep subsequent custom events on the same sanitized current page as well.
    browser.gtag('set', page)
    for (const tag of ['AW-18465855968', 'G-9WCELVR3V3']) browser.gtag('config', tag, { ...page, send_page_view: false })
    browser.gtag('event', 'page_view', page)
  }, [pathname])

  return null
}
