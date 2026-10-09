'use client'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { PENDING_ATTRIBUTION_MAX_AGE_SECONDS, CLICK_ID_FIELDS, validateClickId, type ClickIdField } from '@/lib/attribution'
export function AnalyticsConsent() {
  const [consent, setConsent] = useState<'unknown' | 'granted' | 'denied'>('unknown')
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const capturedAt = useRef(Date.now())
  const clicks = useRef<Partial<Record<ClickIdField, string>>>({})
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    for (const field of CLICK_ID_FIELDS) { const id = validateClickId(params.get(field)); if (id) clicks.current[field] = id }
    let active = true
    void fetch('/api/consent', { cache: 'no-store', credentials: 'same-origin' }).then((response) => response.json()).then(async (data) => {
      if (!active) return
      const state = data.consent === 'granted' ? 'granted' : data.consent === 'denied' ? 'denied' : 'unknown'
      setConsent(state); setOpen(state === 'unknown')
      if (state !== 'granted') updateGoogleConsent('denied')
      if (state === 'granted') {
        // New landing click IDs are accepted only after previously saved consent is verified.
        if (Object.keys(clicks.current).length && Date.now() - capturedAt.current <= PENDING_ATTRIBUTION_MAX_AGE_SECONDS * 1000) {
          const response = await fetch('/api/consent', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }, body: JSON.stringify({ consent: state, ...clicks.current }) })
          if (!response.ok || !active) return
        }
        updateGoogleConsent('granted')
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
      updateGoogleConsent(state); setConsent(state); setOpen(false)
      if (state === 'denied') clicks.current = {}
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save your choice.') } finally { setBusy(false) }
  }
  return <aside className="analytics-consent" aria-label="Privacy choices">
    {open ? <div className="card stack" style={{ gap: 12 }}><strong>Optional analytics and advertising</strong><p className="t-small">With your permission, we measure service steps and save Google advertising click identifiers for up to 90 days. We never send your IMEI, email or payment details in these events. <Link href="/privacy">Privacy policy</Link></p><div className="cta-actions"><button className="button button--primary" disabled={busy} onClick={() => void choose('granted')}>Allow optional tracking</button><button className="button button--quiet" disabled={busy} onClick={() => void choose('denied')}>Reject optional tracking</button></div>{error ? <p role="alert">{error}</p> : null}</div> : <button type="button" className="button button--quiet" onClick={() => setOpen(true)}>Privacy choices{consent === 'denied' ? ' · optional tracking off' : ''}</button>}
  </aside>
}
function updateGoogleConsent(state: 'granted' | 'denied') {
  const browser = window as Window & { iunlockmobileAnalyticsConsent?: string; gtag?: (...args: unknown[]) => void }
  browser.iunlockmobileAnalyticsConsent = state
  window.dispatchEvent(new Event('iunlockmobile-consent'))
  browser.gtag?.('consent', 'update', { analytics_storage: state, ad_storage: state, ad_user_data: state, ad_personalization: state })
}
