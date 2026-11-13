'use client'
import { useEffect } from 'react'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import type { ExperimentId, Variant } from '@/lib/cro/experiments'

/**
 * Fires experiment_impression once per browser session per experiment and
 * records the exposure server-side. Renders nothing, so it cannot shift layout.
 * mobileOnly matches the CSS breakpoint of surfaces only shown on phones.
 */
export function CroImpression({ experiment, variant, tracked, mobileOnly = false }: { experiment: ExperimentId; variant: Variant; tracked: boolean; mobileOnly?: boolean }) {
  useEffect(() => {
    if (!tracked) return
    if (mobileOnly && !window.matchMedia('(max-width: 640px)').matches) return
    const key = `ium-cro-impression:${experiment}`
    try { if (window.sessionStorage.getItem(key)) return; window.sessionStorage.setItem(key, '1') } catch { /* Storage is optional; the server dedupes. */ }
    trackFunnelEvent('experiment_impression', { experiment_id: experiment, variant })
    void fetch('/api/cro/impression', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ experiment }), keepalive: true }).catch(() => undefined)
  }, [experiment, variant, tracked, mobileOnly])
  return null
}
