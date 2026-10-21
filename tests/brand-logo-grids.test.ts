import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { BRANDS, CARRIERS } from '../lib/catalog'

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')

test('network and brand grids use recognizable local marks, never initials placeholders', () => {
  const home = read('app/(marketing)/page.tsx')
  assert.match(home, /Carriers <span className="accent">We Unlock/)
  assert.match(home, /Top Brands <span className="accent">We Support/)
  assert.equal((home.match(/className="logo-grid"/g) || []).length, 2)
  assert.equal((home.match(/<BrandLogo name=/g) || []).length, 2)
  assert.doesNotMatch(home, /carrier\.name\.replace|brand\.name\.slice/)
})

test('each catalog label has a local readable logo asset and SVGs cannot execute or load remotely', () => {
  const source = read('components/brand-logo.tsx')
  for (const x of [...BRANDS, ...CARRIERS]) assert.ok(source.includes(JSON.stringify(x.name) + ':'), x.name)
  const paths = [...source.matchAll(/src: "(\/brand-marks\/[^\"]+)"/g)].map(x => x[1])
  assert.equal(paths.length, BRANDS.length + CARRIERS.length)
  for (const p of paths) {
    assert.ok(fs.statSync(path.join(process.cwd(), 'public', p)).size > 50)
    if (p.endsWith('.svg')) assert.doesNotMatch(read('public' + p), /<script|<foreignObject|<image|<use|onload=|onerror=|(?:href|url\()\s*=?["']?https?:/i)
  }
  assert.doesNotMatch(source, /src: "https?:/)
})

test('responsive logo grids match reference column counts and remain scoped to logo sections', () => {
  const css = read('styles/navigation-home.css')
  assert.match(css, /\.logo-section \.logo-grid[^}]*repeat\(3/)
  assert.match(css, /min-width:1024px[^}]*repeat\(5/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /\.logo-card:focus-visible/)
})

test('homepage preserves public service entry points without publishing placeholder reviews', () => {
  const home = read('app/(marketing)/page.tsx')
  assert.match(home, /<HeroPriceCheck unlock=/)
  assert.match(home, /listPublicProviderProducts\('unlock'\)/)
  assert.doesNotMatch(home, /Testimonials|SAMPLE_TESTIMONIALS|AggregateRating|ratingValue|reviewCount/)
})
