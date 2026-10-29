'use client'
import { useEffect, useRef, useState } from 'react'
import { PENDING_ATTRIBUTION_MAX_AGE_SECONDS, CLICK_ID_FIELDS, validateClickId, type ClickIdField } from '@/lib/attribution'
import { updateGoogleConsent } from '@/lib/google-consent-tracking'
import { forgetLanding, rememberLanding } from '@/lib/landing-context'
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
    rememberLanding(window.location.pathname, params)
    let active = true
    void fetch('/api/consent', { cache: 'no-store', credentials: 'same-origin' }).then((response) => response.json()).then(async (data) => {
      if (!active) return
      const state = data.consent === 'granted' ? 'granted' : data.consent === 'denied' ? 'denied' : 'unknown'
      setConsent(state); setOpen(true)
      if (state === 'denied') { updateGoogleConsent('denied'); forgetLanding() }
      if (state === 'unknown') updateGoogleConsent('default', clicks.current)
      if (state === 'granted') {
        // New landing click IDs are accepted only after previously saved consent is verified.
        if (Object.keys(clicks.current).length && Date.now() - capturedAt.current <= PENDING_ATTRIBUTION_MAX_AGE_SECONDS * 1000) {
          const response = await fetch('/api/consent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ consent: state, ...clicks.current }) })
          if (!response.ok || !active) return
          await response.json()
          updateGoogleConsent('granted', clicks.current)
        } else {
          updateGoogleConsent('granted', clicks.current)
        }
      }
    }).catch(() => { if (active) setOpen(true) })
    return () => { active = false }
  }, [])
  async function choose(state: 'granted' | 'denied') {
    setBusy(true); setError('')
    if (state === 'denied') updateGoogleConsent('denied')
    if (Date.now() - capturedAt.current > PENDING_ATTRIBUTION_MAX_AGE_SECONDS * 1000) clicks.current = {}
    try {
      const response = await fetch('/api/consent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ consent: state, ...(state === 'granted' ? clicks.current : {}) }) })
      if (!response.ok) throw new Error('Unable to save your choice. Optional tracking remains disabled.')
      await response.json().catch(() => ({}))
      updateGoogleConsent(state, state === 'granted' ? clicks.current : {})
      setConsent(state); setOpen(false)
      if (state === 'denied') { clicks.current = {}; forgetLanding() }
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save your choice.') } finally { setBusy(false) }
  }
  return <>
    {open ? <div aria-hidden="true" style={{ height: noticeHeight }} /> : null}
    <aside ref={noticeRef} className="analytics-consent" data-open={open} aria-label="Privacy choices">
    {open ? <div className="cookie-banner" role="region" aria-label="Cookie notice" aria-busy={busy}>
      <p>We use cookies to improve your experience.</p>
      <button type="button" className="button button--primary cookie-accept" disabled={busy} onClick={() => void choose('granted')}>{busy ? 'Saving…' : 'Accept'}</button>
      <button type="button" className="cookie-close" aria-label="Close cookie notice without accepting optional tracking" disabled={busy} onClick={() => void choose('denied')}>×</button>
      {error ? <p className="cookie-error" role="alert">{error}</p> : null}
    </div> : <button type="button" className="button button--quiet" onClick={() => setOpen(true)}>Privacy choices{consent === 'denied' ? ' · optional tracking off' : ''}</button>}
  </aside>
  </>
}
