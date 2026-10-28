'use client'

import Link from 'next/link'
import { useId, useMemo, useState } from 'react'
import { Icon } from './icons'

export type SearchableGuide = { slug: string; title: string; topic: string }

/**
 * A search over the guide titles, answered as the visitor types. The list
 * is small enough (under a hundred rows) that filtering it in the browser
 * is faster than any request would be, and nothing typed here ever leaves
 * the page.
 */
export function SupportSearch({ guides }: { guides: SearchableGuide[] }) {
  const id = useId()
  const [query, setQuery] = useState('')
  const words = query.toLowerCase().split(/\s+/).filter(Boolean)
  const results = useMemo(() => {
    if (words.length === 0) return []
    return guides
      .filter((guide) => {
        const haystack = `${guide.title} ${guide.topic}`.toLowerCase()
        return words.every((word) => haystack.includes(word))
      })
      .slice(0, 8)
  }, [guides, words])

  return (
    <div className="support-search">
      <label className="visually-hidden" htmlFor={`${id}-q`}>Search the guides</label>
      <div className="support-search-box">
        <Icon name="search" strokeWidth={2} />
        <input
          id={`${id}-q`}
          type="search"
          placeholder="Try “SIM not supported”"
          value={query}
          onChange={(event) => setQuery(event.currentTarget.value)}
          autoComplete="off"
          aria-controls={`${id}-results`}
        />
        {query ? (
          <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
            <Icon name="cross" />
          </button>
        ) : null}
      </div>
      <div id={`${id}-results`} className="support-search-results" aria-live="polite">
        {words.length > 0 && results.length === 0 ? (
          <p className="support-search-empty">
            Nothing in the guides matches that. <Link href="/contact">Ask support</Link> — a reply usually comes within a day.
          </p>
        ) : null}
        {results.length ? (
          <ul>
            {results.map((guide) => (
              <li key={guide.slug}>
                <Link href={`/articles/${guide.slug}`}>
                  <Icon name="file" strokeWidth={1.9} />
                  <span>
                    {guide.title}
                    <small>{guide.topic}</small>
                  </span>
                  <Icon name="chevronRight" strokeWidth={2} />
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
