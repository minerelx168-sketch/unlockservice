'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatUsd } from '@/lib/money'
import type { ProviderProduct, ProviderProductDomain } from '@/lib/provider-products'
import { Icon } from './icons'

type DomainFilter = 'all' | ProviderProductDomain

const FILTERS: Array<{ value: DomainFilter; label: string }> = [
  { value: 'all', label: 'All products' },
  { value: 'imei_check', label: 'IMEI checks' },
  { value: 'unlock', label: 'Unlock services' },
]

export function ProductCatalog({ products }: { products: ProviderProduct[] }) {
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState<DomainFilter>('all')

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase()
    return products.filter((product) => {
      if (domain !== 'all' && product.domain !== domain) return false
      if (!search) return true
      return `${product.name} ${product.group} ${product.summary} ${product.serviceId}`
        .toLowerCase()
        .includes(search)
    })
  }, [domain, products, query])

  const availableCount = products.filter((product) => product.status === 'available').length
  const unlockCount = products.filter((product) => product.domain === 'unlock').length
  const imeiCount = products.filter((product) => product.domain === 'imei_check').length

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div className="trust-bar" aria-label="Product catalog summary">
        <div><b>{products.length} products</b><span>Provider catalog published</span></div>
        <div><b>{availableCount} available</b><span>Paid IMEI reports</span></div>
        <div><b>{imeiCount} IMEI checks</b><span>Available and coming soon</span></div>
        <div><b>{unlockCount} unlock services</b><span>API verification in progress</span></div>
      </div>

      <section className="panel">
        <header>
          <h2>Find a service</h2>
          <span>{visible.length} shown</span>
        </header>
        <div className="panel-body" style={{ display: 'grid', gap: 18 }}>
          <div className="field">
            <label htmlFor="product-search">Search by product, group or Provider Service ID</label>
            <input
              id="product-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Apple, Samsung, blacklist, carrier, 214…"
              autoComplete="off"
            />
          </div>

          <div className="segmented" role="group" aria-label="Product type">
            {FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                aria-pressed={domain === filter.value}
                onClick={() => setDomain(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {visible.length === 0 ? (
        <p className="alert" role="status"><Icon name="info" /> <span>No products match that search.</span></p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: 16 }}>
          {visible.map((product) => {
            const available = product.status === 'available'
            return (
              <article className="card" key={product.productCode} style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
                <div className="card-topline">
                  <span className="kicker">
                    <Icon name={product.domain === 'unlock' ? 'lock' : 'search'} />
                    {product.group}
                  </span>
                  <span className={available ? 'badge badge--success' : 'badge'}>
                    {available ? 'Available' : 'Coming soon'}
                  </span>
                </div>

                <div>
                  <h3 className="t-card">{product.name}</h3>
                  <p className="t-small" style={{ marginTop: 8 }}>{product.summary}</p>
                </div>

                <div className="quote" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
                  <div><span className="label">Price</span><span className="value">{formatUsd(product.priceCents)}</span></div>
                  <div><span className="label">Provider ID</span><span className="value t-mono">{product.serviceId}</span></div>
                </div>

                <p className="field-note">
                  <Icon name="clock" />
                  <span>{product.etaLabel}</span>
                </p>

                {available ? (
                  <Link className="button button--primary" href={`/user/reports/new?product=${encodeURIComponent(product.productCode)}`}>
                    Order IMEI report <Icon name="arrowRight" />
                  </Link>
                ) : (
                  <span className="button button--quiet" aria-disabled="true">
                    Online ordering coming soon
                  </span>
                )}
              </article>
            )
          })}
        </div>
      )}

      <p className="alert" role="status">
        <Icon name="shield" />
        <span>
          Unlock products remain catalog-only until the Provider supplies a confirmed API contract. We do not submit orders through browser automation or guess unsupported service mappings.
        </span>
      </p>
    </div>
  )
}
