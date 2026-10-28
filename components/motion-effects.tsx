'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

/**
 * Scroll-reveal for the marketing pages, as progressive enhancement.
 *
 * Server markup ships fully visible. On mount this stamps `data-reveal`
 * onto a curated set of blocks, marks the root `js-motion`, and only then
 * does motion.css hide anything — so without JavaScript (or with reduced
 * motion) every page reads exactly as before. An IntersectionObserver
 * flips each block to `.is-in` the first time it approaches the viewport,
 * and siblings revealed from the same parent stagger via `--ri`.
 *
 * Selectors are listed here rather than attributes sprinkled through the
 * pages: one file owns which blocks move, and a page added later inherits
 * the behaviour by using the same anatomy.
 */

/* Blocks that reveal alone. */
const SINGLES = [
  '.section-head',
  '.eligibility',
  '.help-band',
  '.tile-foot',
  '.faq-foot',
  '.quote-band',
  '.callout',
  '.support-search',
].join(', ')

/* Groups whose children reveal with a stagger. */
const GROUPS = [
  '.grid-3',
  '.hub-grid',
  '.service-hub-grid',
  '.eligibility-grid',
  '.reviews-track',
  '.review-stats',
  '.tile-grid',
  '.faq-list',
  '.contact-grid',
  '.support-cards',
  '.contact-shortcuts',
  '.step-strip',
].join(', ')

const STAGGER_CAP = 7

export function MotionEffects() {
  const pathname = usePathname()

  useEffect(() => {
    const root = document.documentElement
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (!('IntersectionObserver' in window)) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          entry.target.classList.add('is-in')
          observer.unobserve(entry.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )

    const tagged: Element[] = []
    const tag = (el: Element, index: number) => {
      if (el.hasAttribute('data-reveal')) return
      /* Anything already on screen stays put; revealing it would flash. */
      const box = el.getBoundingClientRect()
      if (box.top < window.innerHeight * 0.92) return
      el.setAttribute('data-reveal', '')
      ;(el as HTMLElement).style.setProperty('--ri', String(Math.min(index, STAGGER_CAP)))
      observer.observe(el)
      tagged.push(el)
    }

    document.querySelectorAll(SINGLES).forEach((el) => tag(el, 0))
    document.querySelectorAll(GROUPS).forEach((group) => {
      Array.from(group.children).forEach((child, index) => tag(child, index))
    })

    root.classList.add('js-motion')

    return () => {
      observer.disconnect()
      /* Leave nothing hidden behind when the page changes under us. */
      for (const el of tagged) {
        el.classList.add('is-in')
        el.removeAttribute('data-reveal')
      }
    }
  }, [pathname])

  return null
}
