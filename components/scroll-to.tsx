'use client'

import { useEffect } from 'react'

/**
 * Lands the visitor on a section further down the page when they arrived
 * with something to do there — the hero form has just stored their IMEI
 * and report, and the order form is where both are waiting. Rendered only
 * for that arrival; a plain visit to the page starts at the top.
 */
export function ScrollTo({ targetId }: { targetId: string }) {
  useEffect(() => {
    const target = document.getElementById(targetId)
    if (!target) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    /* Strip the one-shot flag so a refresh does not jump again. */
    const url = new URL(window.location.href)
    if (url.searchParams.has('start')) {
      url.searchParams.delete('start')
      window.history.replaceState(window.history.state, '', url)
    }
  }, [targetId])
  return null
}
