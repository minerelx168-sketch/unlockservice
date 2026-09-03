'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatUsd } from '@/lib/money'
import type { ProviderProduct, ProviderProductDomain } from '@/lib/provider-products'
import { Icon } from './icons'

type DomainFilter = 'all' | ProviderProductDomain

type CatalogSection = {
  domain: ProviderProductDomain
  label: string
  title: string
  description: string
}

const DOMAIN_OPTIONS: Array<{ value: DomainFilter; label: string }> = [
  { value: 'all', label: 'All service categories' },
  { value: 'imei_check', label: 'IMEI Check services' },
  { value: 'unlock', label: 'Unlock services' },
]

const CATALOG_SECTIONS: CatalogSection[] = [
  {
    domain: 'imei_check',
    label: 'Device information',
    title: 'IMEI Check services',
    description: 'Review device, carrier, warranty, blacklist and lock-status reports with clear prices and availability.',
  },
  {
    domain: 'unlock',
    label: 'Network and device access',
    title: 'Unlock services',
    description: 'Compare published network, activation-lock and device-unlock prices. Online ordering opens only after each service is verified.',
  },
]

function customerText(value: string) {
  return value
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function ProductCard({ product }: { product: ProviderProduct }) {
  const available = product.status === 'available'
  const productName = customerText(product.name)
  const productGroup = customerText(product.group)

  return (
    <article className="card product-card">
      <div className="card-topline product-card-topline">
        <span className="kicker">
          <Icon name={product.domain === 'unlock' ? 'lock' : 'search'} />
          {productGroup}
        </span>
        <span className={available ? 'badge badge--success' : 'badge badge--muted'}>
          {available ? 'Available' : 'Coming soon'}
        </span>
      </div>

      <div className="product-card-copy">
        <h3 className="t-card">{productName}</h3>
        <p className="t-small">{customerText(product.summary)}</p>
      </div>

      <div className="product-card-commercial" aria-label={`Price and delivery estimate for ${productName}`}>
        <div>
          <span className="label">Price</span>
          <strong className="product-price">{formatUsd(product.priceCents)}</strong>
        </div>
        <div>
          <span className="label">Estimated delivery</span>
          <span className="product-eta"><Icon name="clock" /> {customerText(product.etaLabel)}</span>
        </div>
      </div>

      {available ? (
        <Link className="button button--primary product-card-action" href={`/user/reports/new?product=${encodeURIComponent(product.productCode)}`}>
          View and order report <Icon name="arrowRight" />
        </Link>
      ) : (
        <span className="button button--quiet product-card-action" aria-disabled="true">
          Not available for online order yet
        </span>
      )}
    </article>
  )
}

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
      return `${customerText(product.name)} ${customerText(product.group)} ${customerText(product.summary)}`
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
    <div className="product-catalog">
      <div className="trust-bar" aria-label="Product catalog summary">
        <div><b>{products.length} products</b><span>Every published price</span></div>
        <div><b>{availableCount} available</b><span>Paid IMEI reports</span></div>
        <div><b>{imeiCount} IMEI checks</b><span>Device information services</span></div>
        <div><b>{unlockCount} unlock services</b><span>Published prices</span></div>
      </div>

      <section className="panel catalog-filter-panel">
        <header>
          <div>
            <h2>Find a service</h2>
            <p className="t-small">Choose a category first, then jump directly to a service and its published price.</p>
          </div>
          <span>{visible.length} of {products.length} shown</span>
        </header>
        <div className="panel-body catalog-filter-grid">
          <div className="field catalog-search-field">
            <label htmlFor="product-search">Search services</label>
            <input
              id="product-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder="Apple, Samsung, blacklist or carrier"
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label htmlFor="product-domain">Service category</label>
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
            <label htmlFor="product-service">Choose a service</label>
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
              {CATALOG_SECTIONS.map((section) => {
                const options = products.filter((product) => product.domain === section.domain)
                return options.length ? (
                  <optgroup key={section.domain} label={section.title}>
                    {options.map((product) => (
                      <option key={product.productCode} value={product.productCode}>
                        {customerText(product.name)} — {formatUsd(product.priceCents)} — {product.status === 'available' ? 'Available' : 'Coming soon'}
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
        <div className="product-domain-list">
          {CATALOG_SECTIONS.map((section) => {
            const sectionProducts = visible.filter((product) => product.domain === section.domain)
            if (sectionProducts.length === 0) return null
            const sectionAvailable = sectionProducts.filter((product) => product.status === 'available').length

            return (
              <section className={`product-domain-section product-domain-section--${section.domain}`} key={section.domain} aria-labelledby={`${section.domain}-title`}>
                <header className="product-domain-header">
                  <div>
                    <span className="kicker"><Icon name={section.domain === 'unlock' ? 'lock' : 'search'} /> {section.label}</span>
                    <h2 id={`${section.domain}-title`}>{section.title}</h2>
                    <p>{section.description}</p>
                  </div>
                  <div className="product-domain-count" aria-label={`${sectionProducts.length} services in this category`}>
                    <strong>{sectionProducts.length}</strong>
                    <span>services shown</span>
                    <small>{sectionAvailable} available now</small>
                  </div>
                </header>

                <div className="product-card-grid">
                  {sectionProducts.map((product) => <ProductCard product={product} key={product.productCode} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <p className="alert" role="status">
        <Icon name="shield" />
        <span>
          Every published Unlock and IMEI Check price is shown. Unlock services remain view-only until online ordering is verified for each service.
        </span>
      </p>
    </div>
  )
}
