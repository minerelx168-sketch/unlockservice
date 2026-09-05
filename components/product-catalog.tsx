'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatUsd } from '@/lib/money'
import type { ProviderProduct, ProviderProductDomain } from '@/lib/provider-products'
import { Icon } from './icons'

type ProductCatalogProps = {
  products: ProviderProduct[]
  domain: ProviderProductDomain
}

const DOMAIN_COPY: Record<ProviderProductDomain, {
  label: string
  allServicesLabel: string
  groupLabel: string
  searchPlaceholder: string
  availableLabel: string
  notice: string
}> = {
  imei_check: {
    label: 'Phone Check',
    allServicesLabel: 'All phone check services',
    groupLabel: 'Check category',
    searchPlaceholder: 'Apple, Samsung, carrier or blacklist',
    availableLabel: 'Reports available online',
    notice: 'Phone Check prices are shown in USD. Available reports can be ordered online; coming-soon checks remain view-only until their input and report formats are verified.',
  },
  unlock: {
    label: 'Unlock',
    allServicesLabel: 'All unlock services',
    groupLabel: 'Unlock category',
    searchPlaceholder: 'Country, network, Apple or Android',
    availableLabel: 'Services available online',
    notice: 'Unlock prices are shown in USD. These services remain view-only until online ordering is verified for each network and device service.',
  },
}

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

      <div className="product-card-price-row" aria-label={`Price for ${productName}`}>
        <span className="label">Price</span>
        <strong className="product-price">{formatUsd(product.priceCents)}</strong>
      </div>

      {available ? (
        <Link className="button button--primary product-card-action" href={`/user/reports/new?product=${encodeURIComponent(product.productCode)}`}>
          Choose report <Icon name="arrowRight" />
        </Link>
      ) : product.domain === 'unlock' ? (
        /* A dead grey label was the whole of the offer on every unlock
           card. The service is coming; the card can say so and take an
           address instead of ending the visit. */
        <Link className="button button--secondary product-card-action" href="/unlock-waitlist">
          Notify me when this opens <Icon name="arrowRight" />
        </Link>
      ) : (
        <span className="button button--quiet product-card-action" aria-disabled="true">
          Unavailable online
        </span>
      )}
    </article>
  )
}

export function ProductCatalog({ products, domain }: ProductCatalogProps) {
  const [query, setQuery] = useState('')
  const [selectedGroup, setSelectedGroup] = useState('all')
  const [selectedProductCode, setSelectedProductCode] = useState('all')
  const copy = DOMAIN_COPY[domain]

  const groups = useMemo(() => {
    return Array.from(new Set(products.map((product) => customerText(product.group))))
      .filter(Boolean)
      .sort((left, right) => {
        if (left.toLowerCase() === 'featured') return -1
        if (right.toLowerCase() === 'featured') return 1
        return left.localeCompare(right)
      })
  }, [products])

  const visible = useMemo(() => {
    const search = query.trim().toLowerCase()
    return products.filter((product) => {
      const productGroup = customerText(product.group)
      if (selectedGroup !== 'all' && productGroup !== selectedGroup) return false
      if (selectedProductCode !== 'all' && product.productCode !== selectedProductCode) return false
      if (!search) return true
      return `${customerText(product.name)} ${productGroup} ${customerText(product.summary)}`
        .toLowerCase()
        .includes(search)
    })
  }, [products, query, selectedGroup, selectedProductCode])

  const visibleGroups = useMemo(() => {
    return groups
      .map((group) => ({
        group,
        products: visible.filter((product) => customerText(product.group) === group),
      }))
      .filter((entry) => entry.products.length > 0)
  }, [groups, visible])

  const availableCount = products.filter((product) => product.status === 'available').length
  const comingSoonCount = products.length - availableCount
  const filtersActive = query.trim() !== '' || selectedGroup !== 'all' || selectedProductCode !== 'all'

  function clearFilters() {
    setQuery('')
    setSelectedGroup('all')
    setSelectedProductCode('all')
  }

  return (
    <div className={`product-catalog product-catalog--${domain}`}>
      <div className="trust-bar" aria-label={`${copy.label} catalog summary`}>
        <div><b>{products.length} services</b><span>Published in this category</span></div>
        <div><b>{availableCount} available</b><span>{copy.availableLabel}</span></div>
        <div><b>{comingSoonCount} coming soon</b><span>View-only until verified</span></div>
        <div><b>USD prices</b><span>Shown before ordering</span></div>
      </div>

      <section className="panel catalog-filter-panel">
        <header>
          <div>
            <h2>Find a {copy.label.toLowerCase()} service</h2>
            <p className="t-small">Choose a subcategory, search by name or jump directly to a service and its price.</p>
          </div>
          <span>{visible.length} of {products.length} shown</span>
        </header>
        <div className="panel-body catalog-filter-grid">
          <div className="field catalog-search-field">
            <label htmlFor={`${domain}-product-search`}>Search services</label>
            <input
              id={`${domain}-product-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={copy.searchPlaceholder}
              autoComplete="off"
            />
          </div>

          <div className="field">
            <label htmlFor={`${domain}-product-group`}>{copy.groupLabel}</label>
            <select
              id={`${domain}-product-group`}
              value={selectedGroup}
              onChange={(event) => {
                const group = event.currentTarget.value
                setSelectedGroup(group)
                const selected = products.find((product) => product.productCode === selectedProductCode)
                if (selected && group !== 'all' && customerText(selected.group) !== group) setSelectedProductCode('all')
              }}
            >
              <option value="all">All {copy.label.toLowerCase()} categories</option>
              {groups.map((group) => <option key={group} value={group}>{group}</option>)}
            </select>
          </div>

          <div className="field catalog-service-dropdown">
            <label htmlFor={`${domain}-product-service`}>Choose a service</label>
            <select
              id={`${domain}-product-service`}
              value={selectedProductCode}
              onChange={(event) => {
                const code = event.currentTarget.value
                setSelectedProductCode(code)
                const selected = products.find((product) => product.productCode === code)
                if (selected) setSelectedGroup(customerText(selected.group))
              }}
            >
              <option value="all">{copy.allServicesLabel}</option>
              {groups.map((group) => {
                const options = products.filter((product) => customerText(product.group) === group)
                return (
                  <optgroup key={group} label={group}>
                    {options.map((product) => (
                      <option key={product.productCode} value={product.productCode}>
                        {customerText(product.name)} — {formatUsd(product.priceCents)} — {product.status === 'available' ? 'Available' : 'Coming soon'}
                      </option>
                    ))}
                  </optgroup>
                )
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
        <p className="alert" role="status"><Icon name="info" /> <span>No services match those filters.</span></p>
      ) : (
        <div className="product-subcategory-list">
          {visibleGroups.map(({ group, products: groupProducts }) => {
            const groupAvailable = groupProducts.filter((product) => product.status === 'available').length
            return (
              <section className="product-subcategory-section" key={group} aria-labelledby={`${domain}-${group.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>
                <header className="product-subcategory-header">
                  <div>
                    <span className="kicker"><Icon name={domain === 'unlock' ? 'lock' : 'search'} /> {copy.label}</span>
                    <h2 id={`${domain}-${group.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`}>{group}</h2>
                  </div>
                  <div className="product-subcategory-count">
                    <strong>{groupProducts.length}</strong>
                    <span>{groupProducts.length === 1 ? 'service' : 'services'}</span>
                    <small>{groupAvailable} available now</small>
                  </div>
                </header>

                <div className="product-card-grid">
                  {groupProducts.map((product) => <ProductCard product={product} key={product.productCode} />)}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <p className="alert" role="status">
        <Icon name="shield" />
        <span>{copy.notice}</span>
      </p>
    </div>
  )
}
