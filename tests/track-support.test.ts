import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { test } from 'node:test'
import { getArticle } from '../lib/articles'
import { safeContinuation } from '../lib/continuation'
import { FAQ } from '../lib/faq'
import { cleanIdentityHint, parseOrderReference } from '../lib/track'

test('an order reference is read the way customers type it, and nothing else', () => {
  assert.equal(parseOrderReference('1234'), 1234)
  assert.equal(parseOrderReference(' #1234 '), 1234)
  assert.equal(parseOrderReference('Order 1234'), 1234)
  assert.equal(parseOrderReference('order no. 77'), 77)
  assert.equal(parseOrderReference('0'), null)
  assert.equal(parseOrderReference('356789012345678'), null, 'an IMEI is not an order number')
  assert.equal(parseOrderReference('3f2a9c…'), null)
  assert.equal(parseOrderReference('12; DROP TABLE orders'), null)
  assert.equal(parseOrderReference(12), null)
})

test('the identity hint is only ever a prefill', () => {
  assert.equal(cleanIdentityHint('someone@example.com'), 'someone@example.com')
  assert.equal(cleanIdentityHint('  boss  '), 'boss')
  assert.equal(cleanIdentityHint('<script>'), null)
  assert.equal(cleanIdentityHint('a b'), null)
  assert.equal(cleanIdentityHint(''), null)
})

test('the order resolver is an allowed continuation and nothing wider is', () => {
  assert.equal(safeContinuation('/user/find/12'), '/user/find/12')
  assert.equal(safeContinuation('/user/find/0'), null)
  assert.equal(safeContinuation('/user/find/abc'), null)
  assert.equal(safeContinuation('/user/find'), null)
  assert.equal(safeContinuation('/user/orders/12'), '/user/orders/12')
})

test('the sitemap lists the help centre and the tracking page', async () => {
  process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN = 'https://example.test'
  const { default: sitemap } = await import('../app/sitemap')
  const urls = sitemap().map((entry) => new URL(entry.url).pathname)
  assert.ok(urls.includes('/support'))
  assert.ok(urls.includes('/track'))
})

test('the homepage and the help centre share one FAQ', () => {
  const home = readFileSync(join(process.cwd(), 'app/(marketing)/page.tsx'), 'utf8')
  const support = readFileSync(join(process.cwd(), 'app/(marketing)/support/page.tsx'), 'utf8')
  assert.doesNotMatch(home, /const FAQ = \[/)
  assert.match(home, /from '@\/lib\/faq'/)
  assert.match(support, /from '@\/lib\/faq'/)
  assert.ok(FAQ.length >= 6)
  assert.equal(new Set(FAQ.map((entry) => entry.question)).size, FAQ.length)
})

test('every guide the help centre names exists, and every internal route resolves', () => {
  const source = readFileSync(join(process.cwd(), 'app/(marketing)/support/page.tsx'), 'utf8')
  for (const [, slug] of source.matchAll(/guide\('([a-z0-9-]+)'/g)) {
    assert.ok(getArticle(slug), `guide ${slug} is named in the help centre but is not in the catalog`)
  }
  for (const [, href] of source.matchAll(/href: '(\/[^'#]*)'/g)) {
    const path = href.split('?')[0]
    const candidates = [
      join(process.cwd(), 'app/(marketing)', path, 'page.tsx'),
      join(process.cwd(), 'app/(app)', path, 'page.tsx'),
      join(process.cwd(), 'app/(auth)', path, 'page.tsx'),
    ]
    assert.ok(candidates.some(existsSync), `${href} does not resolve to a page`)
  }
})

test('the track form never looks an order up itself', () => {
  const action = readFileSync(join(process.cwd(), 'lib/track-actions.ts'), 'utf8')
  assert.doesNotMatch(action, /getOrder|getPaidReport|listOrders|db\(\)/)
  assert.match(action, /redirect\(`\/user\/find\/\$\{id\}`\)/)
  const resolver = readFileSync(join(process.cwd(), 'app/(app)/user/find/[id]/page.tsx'), 'utf8')
  assert.match(resolver, /getOrder\(orderId, user\.id\)/)
  assert.match(resolver, /getPaidReport\(user\.id, orderId\)/)
})
