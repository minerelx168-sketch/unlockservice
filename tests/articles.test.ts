import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'
import { getArticle, listArticles } from '../lib/articles'

test('article catalog keeps unique slugs, heading anchors and rectangular tables', () => {
  const articles = listArticles()
  assert.equal(new Set(articles.map(({ slug }) => slug)).size, articles.length)
  for (const article of articles) {
    assert.match(article.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    const ids = article.faq?.length ? ['questions'] : []
    for (const block of article.blocks) {
      if (block.kind === 'h2' || block.kind === 'h3') {
        assert.match(block.id, /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
        ids.push(block.id)
      }
      if (block.kind === 'table') {
        assert.ok(block.head.length > 0)
        for (const row of block.rows) assert.equal(row.length, block.head.length)
      }
    }
    assert.equal(new Set(ids).size, ids.length, article.slug)
    for (const date of [article.published, article.updated]) {
      assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
      assert.equal(new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10), date)
    }
    assert.ok(article.updated >= article.published)
  }
})

test('eligibility guide metadata fits the rendered title and description budgets', () => {
  const article = getArticle('iphone-carrier-unlock-eligibility')
  assert.ok(article)
  assert.ok(`${article.title} — iUnlockMobile`.length <= 60)
  assert.ok(article.description.length >= 120 && article.description.length <= 150)
  assert.match(article.description, /iphone carrier unlock/i)
  assert.match(article.heading, /iphone carrier unlock/i)
  assert.equal(article.published, '2026-09-10')
  assert.ok(article.blocks.some((block) => block.kind === 'h2' && block.id === 'key-takeaways'))
  assert.ok(article.blocks.some((block) => block.kind === 'h3'))
  assert.ok(article.faq && article.faq.length > 0)
})

test('article links use HTTPS sources or existing internal routes', () => {
  for (const article of listArticles()) {
    for (const block of article.blocks) {
      const links = block.kind === 'p' ? block.links ?? [] : block.kind === 'cta' ? [block] : []
      for (const link of links) {
        assert.ok(link.label.trim())
        if (link.href.startsWith('/')) {
          assert.ok(!link.href.startsWith('//'))
          if (link.href.startsWith('/articles/')) {
            assert.ok(getArticle(link.href.slice('/articles/'.length)), link.href)
          } else {
            assert.ok(existsSync(`app/(marketing)${link.href}/page.tsx`), link.href)
          }
        } else {
          const url = new URL(link.href)
          assert.equal(url.protocol, 'https:')
          assert.equal(url.username, '')
          assert.equal(url.password, '')
        }
      }
    }
  }
})
