'use client'

import { useState } from 'react'
import type { Testimonial } from '@/lib/testimonials'
import { Icon } from './icons'

const AVATAR_STYLES = 5

function ReviewCard({ item, index }: { item: Testimonial; index: number }) {
  return (
    <li className="review-card">
      <div className="review-top">
        <span className="stars" aria-label={`${item.rating} out of 5`}>
          {Array.from({ length: 5 }, (_, i) => (
            <Icon key={i} name="star" strokeWidth={i < item.rating ? 0 : 1.8} className={i < item.rating ? 'is-on' : undefined} />
          ))}
        </span>
      </div>
      <blockquote className="review-quote">
        <p>&ldquo;{item.body}&rdquo;</p>
      </blockquote>
      <div className="review-meta">
        <span className={`review-avatar review-avatar--${(index % AVATAR_STYLES) + 1}`} aria-hidden="true">
          {item.name.slice(0, 1).toUpperCase()}
        </span>
        <span>
          <b>{item.name}</b>
          <small>
            {item.role} · {item.place}
          </small>
        </span>
      </div>
    </li>
  )
}

/**
 * Review cards in two rows that drift sideways in opposite directions,
 * the way a long wall of feedback reads at a glance. Each row is the set
 * of cards twice over — the copy is hidden from assistive tech — so the
 * loop has no seam. The rows pause under the pointer and under keyboard
 * focus, and with reduced motion they become ordinary scrollable rows
 * with a single copy of each card.
 *
 * While every row is a sample, the section says so once, in the line
 * under the heading, rather than on each card or in a label above it;
 * the cards themselves carry only the review. That one line is the
 * disclosure that keeps persona cards from reading as customer reviews,
 * and it goes away by itself once real rows replace them. The section never shows an average
 * or a count — there is nothing honest to compute one from until real
 * reviews exist.
 */
export function Testimonials({ items }: { items: Testimonial[] }) {
  const [paused, setPaused] = useState(false)
  if (items.length === 0) return null
  const allSample = items.every((item) => item.sample)
  const hasSamples = items.some((item) => item.sample)
  const half = Math.ceil(items.length / 2)
  const rows = [items, [...items.slice(half), ...items.slice(0, half)]]

  return (
    <section className="section section--tint home-section reviews" id="reviews" aria-labelledby="reviews-heading" data-motion-paused={paused}>
      <div className="shell">
        <div className="section-head section-head--center">
          {allSample ? null : (
            <span className="kicker">
              <Icon name="star" strokeWidth={2} />
              Customer reviews
            </span>
          )}
          <h2 className="t-section" id="reviews-heading">
            What people check for, <span className="accent">in their words.</span>
          </h2>
          <p className="t-lead">
            {allSample
              ? 'Illustrative examples while verified customer reviews are collected. No rating or review count is claimed.'
              : hasSamples
                ? 'Includes illustrative examples; no verified rating or review count is claimed.'
                : 'Feedback from traders, repair shops and travellers who checked or unlocked a phone here.'}
          </p>
          <button type="button" className="button button--quiet review-motion-toggle"
            aria-pressed={paused} onClick={() => setPaused((value) => !value)}>
            {paused ? 'Resume animation' : 'Pause animation'}
          </button>
        </div>
      </div>

      <div className="reviews-marquee">
        {rows.map((row, rowIndex) => (
          <div className="reviews-row" data-direction={rowIndex % 2 ? 'right' : 'left'} key={rowIndex}>
            <ul className="reviews-track" tabIndex={0} aria-label={`Review examples row ${rowIndex + 1}`}>
              {row.map((item, index) => (
                <ReviewCard item={item} index={index + rowIndex * half} key={`${item.name}-${index}`} />
              ))}
            </ul>
            <ul className="reviews-track" aria-hidden="true">
              {row.map((item, index) => (
                <ReviewCard item={item} index={index + rowIndex * half} key={`dup-${item.name}-${index}`} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
