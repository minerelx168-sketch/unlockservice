'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatUsd } from '@/lib/money'
import type { ProviderProduct, ProviderProductDomain } from '@/lib/provider-products'
import { Icon } from './icons'

type DomainFilter = 'all' | ProviderProductDomain

const DOMAIN_OPTIONS: Array<{ value: DomainFilter; label: string }> = [
  { value: 'all', label: 'All Unlock & IMEI services' },
  { value: 'imei_check', label: 'IMEI Check services' },
  { value: 'unlock', label: 'Unlock services' },
]

const SERVICE_GROUPS: Array<{
  key: 'available' | 'coming-imei' | 'coming-unlock'
  label: string
  filter: (product: ProviderProduct) => boolean
}> = [
  {
    key: 'available',
    label: 'Available IMEI Reports',
    filter: (product) => product.status === 'available',
  },
  {
    key: 'coming-imei',
    label: 'Coming-soon IMEI Checks',
    filter: (product) => product.status !== 'available' && product.domain === 'imei_check',
  },
  {
    key: 'coming-unlock',
    label: 'Coming-soon Unlock Services',
    filter: (product) => product.domain === 'unlock',
  },
]

export function ProductCatalog({ products }: { products: ProviderProduct[] }) {
  const [query, setQuery] = useState('')
  const [domain, setDomain] = useState<DomainFilter>('all')
  const [selectedProductCode, setSelectedProductCode] = useState('all')

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase()
    return products.filter((product) => {
      if (domain !== 'all' && product.domain !== domain) return false
      if (selectedProductCode !== 'all' && product.productCode !== selectedProductCode) return false
      if (!search) return true
      return `${product.name} ${product.group} ${product.summary} ${product.serviceId}`
        .toLowerCase()
        .includes(search)
    })
  }, [domain, products, query, selectedProductCode])

  const availableCount = products.filter((product) => product.status === 'available').length
  const unlockCount = products.filter((product) => product.domain === 'unlock').length
  const imeiCount = products.filter((product) => product.domain === 'imei_check').length
  const filtersActive = query.trim() !== '' || domain !== 'all' || selectedProductCode !== 'all'

  function clearFilters() {
    setQuery('')
    setDomain('all')
    setSelectedProductCode('all')
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div className="trust-bar" aria-label="Product catalog summary">
        <div><b>{products.length} products</b><span>Every published price</span></div>
        <div><b>{availableCount} available</b><span>Paid IMEI reports</span></div>
        <div><b>{imeiCount} IMEI checks</b><span>Available and coming soon</span></div>
        <div><b>{unlockCount} unlock services</b><span>Prices published · API pending</span></div>
      </div>

      <section className="panel catalog-filter-panel">
        <header>
          <div>
            <h2>Find a service</h2>
            <p className="t-small">Use the dropdown to jump directly to any published Unlock or IMEI Check price.</p>
          </div>
          <span>{visible.length} of {products.length} shown</span>
        </header>
        <div className="panel-body catalog-filter-grid">
          <div className="field catalog-search-field">
            <label htmlFor="product-search">Search</label>
            <input
              id="product-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Apple, Samsung, blacklist, carrier, 214…"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label htmlFor="product-domain">Service type</label>
            <select
              id="product-domain"
              value={domain}
              onChange={(event) => {
                const nextDomain = event.currentTarget.value as DomainFilter
                setDomain(nextDomain)
                const selected = products.find((product) => product.productCode === selectedProductCode)
                if (selected && nextDomain !== 'all' && selected.domain !== nextDomain) setSelectedProductCode('all')
              }}
            >
              {DOMAIN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div className="field catalog-service-dropdown">
            <label htmlFor="product-service">Service dropdown</label>
            <select
              id="product-service"
              value={selectedProductCode}
              onChange={(event) => {
                const code = event.currentTarget.value
                setSelectedProductCode(code)
                const selected = products.find((product) => product.productCode === code)
                if (selected) setDomain(selected.domain)
              }}
            >
              <option value="all">All services and prices</option>
              {SERVICE_GROUPS.map((group) => {
                const options = products.filter(group.filter)
                return options.length ? (
                  <optgroup key={group.key} label={group.label}>
                    {options.map((product) => (
                      <option key={product.productCode} value={product.productCode}>
                        {product.name} — {formatUsd(product.priceCents)} — ID {product.serviceId}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              })}
            </select>
          </div>

          <div className="catalog-filter-actions">
            <button className="button button--secondary" type="button" onClick={clearFilters} disabled={!filtersActive}>
              Clear filters
            </button>
          </div>
        </div>
      </section>

      {visible.length === 0 ? (
        <p className="alert" role="status"><Icon name="info" /> <span>No products match those filters.</span></p>
      ) : (
        <div className="product-card-grid">
          {visible.map((product) => {
            const available = product.status === 'available'
            return (
              <article className="card product-card" key={product.productCode}>
                <div className="card-topline">
                  <span className="kicker">
                    <Icon name={product.domain === 'unlock' ? 'lock' : 'search'} />
                    {product.group}
                  </span>
                  <span className={available ? 'badge badge--success' : 'badge badge--muted'}>
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
                    Service API verification in progress
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
          All published Unlock and IMEI Check prices are shown. Unlock products remain catalog-only until the Provider supplies a confirmed API contract; we never automate Provider web forms or guess unsupported mappings.
        </span>
      </p>
    </div>
  )
}
