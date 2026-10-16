import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { BRANDS, CARRIERS } from '../lib/catalog'

const read = (p: string) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const base = (p: string) => execFileSync('git', ['show', '02d73bcdcab1d80aab1036aa7f449192ce74f046:' + p], { encoding: 'utf8' })

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
  const paths = [...source.matchAll(/src: "(\/brand-marks\/[^"]+)"/g)].map(x => x[1])
  assert.equal(paths.length, 30)
  for (const p of paths) {
    assert.ok(fs.statSync(path.join(process.cwd(), 'public', p)).size > 50)
    if (p.endsWith('.svg')) assert.doesNotMatch(read('public' + p), /<script|<foreignObject|<image|<use|onload=|onerror=|(?:href|url\()\s*=?["']?https?:/i)
  }
  assert.doesNotMatch(source, /src: "https?:/)
})

test('responsive logo grids match reference column counts and remain scoped to logo sections', () => {
  const css = read('styles/navigation-home.css')
  assert.ok(css.startsWith(base('styles/navigation-home.css')))
  assert.match(css, /\.logo-section \.logo-grid[^}]*repeat\(3/)
  assert.match(css, /min-width:1024px[^}]*repeat\(5/)
  assert.match(css, /prefers-reduced-motion/)
  assert.match(css, /\.logo-card:focus-visible/)
})

test('hero, testimonials, ordering code and all non-requested homepage sections stay exact', () => {
  const remove = (s: string) => s.replace("import { BrandLogo } from '@/components/brand-logo'\n", '')
    .replace(/\{\/\* 02 · Networks \*\/\}[\s\S]*?(?=\{\/\* 03 · How it works)/, '')
    .replace(/\{\/\* 06 · Brands \*\/\}[\s\S]*?(?=\{\/\* 07 · Service hub)/, '')
  assert.equal(remove(read('app/(marketing)/page.tsx')), remove(base('app/(marketing)/page.tsx')))
  assert.equal(read('lib/testimonials.ts'), base('lib/testimonials.ts'))
  assert.equal(read('components/testimonials.tsx'), base('components/testimonials.tsx'))
  assert.equal(read('lib/catalog.ts'), base('lib/catalog.ts'))
  assert.equal(read('lib/articles.ts'), base('lib/articles.ts'))
})
