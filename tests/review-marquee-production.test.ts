import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { SAMPLE_TESTIMONIALS } from '../lib/testimonials'
const read = (p: string) => fs.readFileSync(p, 'utf8')

test('review personas have name, role and country but never claim to be real imported customers', () => {
  assert.ok(SAMPLE_TESTIMONIALS.length >= 8)
  for (const item of SAMPLE_TESTIMONIALS) {
    assert.ok(item.name.trim() && item.role.trim() && item.place.trim())
    assert.equal(item.sample, true)
    assert.doesNotMatch(item.body, /masked everywhere|kept its warranty|\b\d{15}\b/)
  }
  assert.doesNotMatch(read('lib/testimonials.ts'), /from ['"][^'"]*(?:db|users|auth)['"]|getUser|SELECT /)
})

test('review samples are clearly disclosed at section level, including mixed collections', () => {
  const s = read('components/testimonials.tsx')
  assert.match(s, /Illustrative examples while verified customer reviews are collected/)
  assert.match(s, /const hasSamples = items\.some/)
  assert.match(s, /Includes illustrative examples/)
  assert.doesNotMatch(s, /className="review-sample"|AggregateRating|ratingValue|reviewCount/)
})

test('marquee duplicates are hidden to assistive tech and original tracks support keyboard focus', () => {
  const s = read('components/testimonials.tsx')
  assert.match(s, /aria-hidden="true"/)
  assert.match(s, /tabIndex=\{0\}/)
  assert.match(s, /data-direction=\{rowIndex % 2 \? 'right' : 'left'\}/)
  assert.match(s, /aria-label=\{`Review examples row/)
})

test('continuous motion has a real pause button plus pointer and keyboard pause', () => {
  const s = read('components/testimonials.tsx')
  assert.match(s, /aria-pressed=\{paused\}/)
  assert.match(s, /onClick=\{\(\) => setPaused/)
  const css = read('styles/home.css')
  assert.match(css, /data-motion-paused='true'[^}]*animation-play-state: paused/)
  assert.match(css, /reviews-marquee:hover/)
  assert.match(css, /reviews-marquee:focus-within/)
})

test('reduced-motion disables animation and visual duplicates while retaining manual scrolling', () => {
  const css = read('styles/home.css')
  assert.match(css, /prefers-reduced-motion: reduce/)
  assert.match(css, /overflow-x: auto/)
  assert.match(css, /animation: none/)
  assert.match(css, /reviews-track\[aria-hidden='true'\][^}]*display: none/)
  assert.match(css, /hero-chip svg[^}]*width: 16px/)
})
