'use client'

import Link from 'next/link'
import { useActionState, useEffect, useId, useMemo, useState } from 'react'
import { continueDeviceServiceAction } from '@/lib/device-intent-actions'
import { formatUsd } from '@/lib/money'
import type { PublicProviderProduct } from '@/lib/public-provider-catalog'
import { filterUnlockProducts, serviceText, unlockCategories, unlockCategory } from '@/lib/unlock-catalog-view'
import { Icon } from './icons'
import { ServiceOutputExample } from './service-output-example'

type UnlockServiceCatalogProps = {
  products: PublicProviderProduct[]
  imei: string
  initialProductCode?: string
  isAuthenticated?: boolean
  availableCents?: number
}

/** Expanding a service only reveals information. The form opens a separate order review. */
function UnlockServiceRow({ product, imei, initiallyExpanded, isAuthenticated }: {
  product: PublicProviderProduct
  imei: string
  initiallyExpanded: boolean
  isAuthenticated: boolean
}) {
  const id = useId()
  const [expanded, setExpanded] = useState(initiallyExpanded)
  const [state, action, pending] = useActionState(continueDeviceServiceAction, {})
  const available = product.status === 'available'
  const name = serviceText(product.name)
  const eta = serviceText(product.etaLabel)

  return (
    <details
      className="unlock-catalog__service"
      data-product-code={product.productCode}
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
    >
      <summary className="unlock-catalog__row" aria-controls={`${id}-detail`}>
        <span className="unlock-catalog__service-icon"><Icon name="unlockMark" /></span>
        <span className="unlock-catalog__service-copy">
          <span className="unlock-catalog__service-name">{name}</span>
          <span className="unlock-catalog__service-meta">
            <span><Icon name="clock" /> {eta}</span>
            <span className={available ? 'unlock-catalog__available' : 'unlock-catalog__unavailable'}>
              {available ? 'Available' : 'Coming soon'}
            </span>
          </span>
        </span>
        <span className="unlock-catalog__price"><strong>{formatUsd(product.priceCents)}</strong><small>USD</small></span>
        <span className="unlock-catalog__details-label">{expanded ? 'Close' : 'Details'}<span aria-hidden="true" className="unlock-catalog__chevron" /></span>
      </summary>

      <div className="unlock-catalog__detail" id={`${id}-detail`}>
        <p className="unlock-catalog__description">{serviceText(product.summary)}</p>
        <dl className="unlock-catalog__facts">
          <div><dt>{available ? 'Service price' : 'Listed price'}</dt><dd>{formatUsd(product.priceCents)} USD</dd></div>
          <div><dt>Estimated delivery</dt><dd>{eta}</dd></div>
          <div><dt>Country / category</dt><dd>{unlockCategory(product)}</dd></div>
        </dl>
        <p className="unlock-catalog__requirements">Check that your device, network and lock status match this service before continuing. Entering an IMEI does not confirm compatibility.</p>

        {product.hasExample ? <ServiceOutputExample productCode={product.productCode} productName={name} /> : null}

        {available ? (
          <form action={action} className="unlock-catalog__review" aria-busy={pending}>
            {/* The server revalidates the IMEI, service and live availability; no client price is trusted. */}
            <input type="hidden" name="domain" value="unlock" />
            <input type="hidden" name="imei" value={imei} />
            <input type="hidden" name="productCode" value={product.productCode} />
            {state.error ? <p className="unlock-catalog__error" role="alert">{state.error}</p> : null}
            <div className="unlock-catalog__review-actions">
              <button type="submit" className="button button--primary" disabled={pending} aria-describedby={`${id}-review-hint`}>
                {pending ? 'Opening review…' : 'Continue to review'}<Icon name="arrowRight" />
              </button>
              <p id={`${id}-review-hint`} role={pending ? 'status' : undefined}>
                {pending ? 'Preparing your selection…' : isAuthenticated ? 'No credit is charged until you confirm your order.' : 'Sign in next to review your order. Nothing is charged here.'}
              </p>
            </div>
          </form>
        ) : (
          <div className="unlock-catalog__review-actions unlock-catalog__waitlist">
            <Link href="/unlock-waitlist" className="button button--secondary">Notify me when available<Icon name="arrowRight" /></Link>
            <p>This service is currently unavailable online. You can still review its details.</p>
          </div>
        )}
      </div>
    </details>
  )
}

export function UnlockServiceCatalog({ products, imei, initialProductCode = '', isAuthenticated = false, availableCents }: UnlockServiceCatalogProps) {
  const id = useId()
  const initialProduct = products.find((product) => product.productCode === initialProductCode)
  const [category, setCategory] = useState(initialProduct ? unlockCategory(initialProduct) : '')
  const [query, setQuery] = useState('')
  const categories = useMemo(() => unlockCategories(products), [products])
  const visible = useMemo(() => filterUnlockProducts(products, category, query), [products, category, query])
  const groups = useMemo(() => unlockCategories(visible).map(({ name }) => ({
    name,
    products: visible.filter((product) => unlockCategory(product) === name),
  })), [visible])
  const filtersActive = Boolean(category || query.trim())

  // Server-action redirects can retain the scroll position of the Show more
  // button below the entry form. Start the new browsing step at its heading.
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' }) }, [])

  function selectCategory(value: string) {
    setCategory(value)
    window.scrollTo({ top: 0, behavior: 'instant' })
  }

  function resetFilters() {
    setCategory('')
    setQuery('')
  }

  return (
    <section className="unlock-catalog" aria-label="Choose an unlock service">
      <div className="unlock-catalog__context">
        <div className="unlock-catalog__device">
          <span className="unlock-catalog__device-icon"><Icon name="device" /></span>
          <div><span className="unlock-catalog__eyebrow">Your IMEI</span><strong>{imei}</strong></div>
          <Link href="/services/unlock">Change IMEI</Link>
        </div>
        <div className="unlock-catalog__context-actions">
          {isAuthenticated && availableCents !== undefined ? <div className="unlock-catalog__credit"><span>Available credit</span><strong>{formatUsd(availableCents)}</strong></div> : null}
          <Link href="/user/reports"><Icon name="clock" /> Order history</Link>
        </div>
      </div>

      <div className="unlock-catalog__layout">
        <aside className="unlock-catalog__sidebar" aria-labelledby={`${id}-categories`}>
          <h2 id={`${id}-categories`}>Country / Category</h2>
          <nav className="unlock-catalog__category-list" aria-label="Unlock service categories">
            <button type="button" aria-pressed={!category} onClick={() => selectCategory('')}><span>All services</span><span>{products.length}</span></button>
            {categories.map(({ name, count }) => <button type="button" key={name} aria-pressed={category === name} onClick={() => selectCategory(name)}><span>{name}</span><span>{count}</span></button>)}
          </nav>
        </aside>

        <div className="unlock-catalog__main">
          <div className="unlock-catalog__filters">
            <div className="unlock-catalog__mobile-category">
              <label htmlFor={`${id}-category`}>Country / Category</label>
              <select id={`${id}-category`} aria-label="Country or category" value={category} onChange={(event) => setCategory(event.currentTarget.value)}>
                <option value="">All services ({products.length})</option>
                {categories.map(({ name, count }) => <option key={name} value={name}>{name} ({count})</option>)}
              </select>
            </div>
            <div className="unlock-catalog__search">
              <label htmlFor={`${id}-search`}>Search services</label>
              <div className="unlock-catalog__search-control"><Icon name="search" /><input id={`${id}-search`} type="search" autoComplete="off" value={query} placeholder="Search country, network or device" onChange={(event) => setQuery(event.currentTarget.value)} /></div>
            </div>
            <div className="unlock-catalog__results-summary">
              <p role="status" aria-live="polite">{visible.length} of {products.length} services{category ? ` · ${category}` : ''}</p>
              {filtersActive ? <button type="button" onClick={resetFilters}>Clear filters</button> : null}
            </div>
          </div>

          <p className="unlock-catalog__intro">Compare USD prices and delivery estimates. Open Details to review a service before ordering.</p>

          <div className="unlock-catalog__groups">
            {groups.map((group) => (
              <section className="unlock-catalog__group" key={group.name} aria-label={group.name}>
                <div className="unlock-catalog__group-heading"><h2>{group.name}</h2><span>{group.products.length} {group.products.length === 1 ? 'service' : 'services'}</span></div>
                <div className="unlock-catalog__rows">
                  {group.products.map((product) => <UnlockServiceRow key={product.productCode} product={product} imei={imei} initiallyExpanded={product.productCode === initialProductCode} isAuthenticated={isAuthenticated} />)}
                </div>
              </section>
            ))}
            {!visible.length ? <div className="unlock-catalog__empty"><Icon name="search" /><h2>{products.length ? 'No services match your search' : 'No services are listed yet'}</h2><p>{products.length ? 'Try a different country, network or device, or clear the filters to see all services.' : 'Please check back later or contact us for help.'}</p>{filtersActive ? <button type="button" className="button button--secondary" onClick={resetFilters}>Show all services</button> : <Link href="/contact" className="button button--secondary">Contact us</Link>}</div> : null}
          </div>
        </div>
      </div>
    </section>
  )
}
