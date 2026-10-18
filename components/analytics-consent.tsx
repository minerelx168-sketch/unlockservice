'use client'
import { useEffect, useRef, useState } from 'react'
import { PENDING_ATTRIBUTION_MAX_AGE_SECONDS, CLICK_ID_FIELDS, validateClickId, type ClickIdField } from '@/lib/attribution'
import { analyticsHostAllowed } from '@/lib/site'
export function AnalyticsConsent() {
  const [consent, setConsent] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const noticeRef = useRef<HTMLElement>(null)
  const [noticeHeight, setNoticeHeight] = useState(0)
  useEffect(() => {
    if (!open || !noticeRef.current) return
    const notice = noticeRef.current
    const measure = () => setNoticeHeight(Math.ceil(notice.getBoundingClientRect().height))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(notice)
    return () => observer.disconnect()
  }, [open])
  const capturedAt = useRef(Date.now())
  const clicks = useRef<Partial<Record<ClickIdField, string>>>({})
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    for (const field of CLICK_ID_FIELDS) { const id = validateClickId(params.get(field)); if (id) clicks.current[field] = id }
    let active = true
    void fetch('/api/consent', { cache: 'no-store', credentials: 'same-origin' }).then((response) => response.json()).then(async (data) => {
      if (!active) return
      const state = data.consent === 'granted' ? 'granted' : data.consent === 'denied' ? 'denied' : 'unknown'
      setConsent(state); setOpen(true)
      if (state !== 'granted') updateGoogleConsent('denied')
      if (state === 'granted') {
        // New landing click IDs are accepted only after previously saved consent is verified.
        if (Object.keys(clicks.current).length && Date.now() - capturedAt.current <= PENDING_ATTRIBUTION_MAX_AGE_SECONDS * 1000) {
          const response = await fetch('/api/consent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ consent: state, ...clicks.current }) })
          if (!response.ok || !active) return
          const saved = await response.json() as { clickIds?: unknown }
          updateGoogleConsent('granted', { ...readClickIds(data.clickIds), ...readClickIds(saved.clickIds), ...clicks.current })
        } else {
          updateGoogleConsent('granted', readClickIds(data.clickIds))
        }
      }
    }).catch(() => { if (active) setOpen(true) })
    return () => { active = false }
  }, [])
  async function choose(state: 'granted' | 'denied') {
    setBusy(true); setError('')
    updateGoogleConsent('denied')
    if (Date.now() - capturedAt.current > PENDING_ATTRIBUTION_MAX_AGE_SECONDS * 1000) clicks.current = {}
    try {
      const response = await fetch('/api/consent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ consent: state, ...(state === 'granted' ? clicks.current : {}) }) })
      if (!response.ok) throw new Error('Unable to save your choice. Optional tracking remains disabled.')
      const saved = await response.json().catch(() => ({})) as { clickIds?: unknown }
      updateGoogleConsent(state, state === 'granted' ? { ...readClickIds(saved.clickIds), ...clicks.current } : {})
      setConsent(state); setOpen(false)
      if (state === 'denied') clicks.current = {}
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save your choice.') } finally { setBusy(false) }
  }
  return <>
    {open ? <div aria-hidden="true" style={{ height: noticeHeight }} /> : null}
    <aside ref={noticeRef} className="analytics-consent" data-open={open} aria-label="Privacy choices">
    {open ? <div className="cookie-banner" role="region" aria-label="Cookie notice" aria-busy={busy}>
      <p>We use cookies to ensure that we give you the best experience on our website. If you continue to use this site we will assume that you are happy with it</p>
      <button type="button" className="button button--primary cookie-accept" disabled={busy} onClick={() => void choose('granted')}>{busy ? 'Saving…' : 'Accept'}</button>
      <button type="button" className="cookie-close" aria-label="Close cookie notice without accepting optional tracking" disabled={busy} onClick={() => void choose('denied')}>×</button>
      {error ? <p className="cookie-error" role="alert">{error}</p> : null}
    </div> : <button type="button" className="button button--quiet" onClick={() => setOpen(true)}>Privacy choices{consent === 'denied' ? ' · optional tracking off' : ''}</button>}
  </aside>
  </>
}
function readClickIds(input: unknown): Partial<Record<ClickIdField, string>> {
  if (!input || typeof input !== 'object') return {}
  const result: Partial<Record<ClickIdField, string>> = {}
  for (const field of CLICK_ID_FIELDS) {
    const value = validateClickId((input as Record<string, unknown>)[field])
    if (value) result[field] = value
  }
  return result
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

function updateGoogleConsent(state: 'granted' | 'denied', clickIds: Partial<Record<ClickIdField, string>> = {}) {
  const browser = window as Window & { iunlockmobileAnalyticsConsent?: string; gtag?: (...args: unknown[]) => void }
  browser.iunlockmobileAnalyticsConsent = state
  if (!analyticsHostAllowed(window.location.hostname)) {
    window.dispatchEvent(new Event('iunlockmobile-consent'))
    return
  }
  browser.gtag?.('consent', 'update', { analytics_storage: state, ad_storage: state, ad_user_data: state, ad_personalization: state })
  if (state === 'granted') {
    const safeIds = readClickIds(clickIds)
    if (typeof browser.gtag === 'function') {
      if (Object.keys(safeIds).length) browser.gtag('set', safeIds)
      const pageReferrer = safeExternalReferrerOrigin()
      const safeLocation = new URL(window.location.origin + (['user', 'admin', 'api'].includes(window.location.pathname.split('/')[1]) ? '/account' : window.location.pathname))
      for (const field of CLICK_ID_FIELDS) if (safeIds[field]) safeLocation.searchParams.set(field, safeIds[field]!)
      for (const tag of ['AW-18465855968', 'G-9WCELVR3V3']) {
        browser.gtag('config', tag, {
          ...safeIds,
          send_page_view: false,
          page_location: safeLocation.href,
          page_referrer: pageReferrer,
          page_title: 'iUnlockMobile',
        })
      }
    }
  }
  window.dispatchEvent(new Event('iunlockmobile-consent'))
}
