'use client'

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { formatUsd } from '@/lib/money'
import { Icon } from './icons'
import { ServiceOutputExample } from './service-output-example'

export type ServiceOption = {
  code: string
  name: string
  summary: string
  group: string
  priceCents: number
  etaLabel: string
  available: boolean
  hasExample?: boolean
}

export function serviceDisplayText(value: string) {
  return value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s{2,}/g, ' ').trim()
}

/** A disclosure with native buttons keeps touch, keyboard and screen-reader behavior predictable. */
export function ServicePicker({
  options,
  value,
  onChange,
  disabled = false,
  label = 'Service',
  id,
}: {
  options: ServiceOption[]
  value: string
  onChange: (code: string) => void
  disabled?: boolean
  label?: string
  id?: string
}) {
  const generatedId = useId()
  const pickerId = id ?? `service-picker-${generatedId}`
  const [expanded, setExpanded] = useState(false)
  const [query, setQuery] = useState('')
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const selected = options.find((option) => option.code === value)
  const availableCount = options.filter((option) => option.available).length
  const open = expanded && !disabled
  const visible = useMemo(() => {
    const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
    // Preserve catalog order within each availability group.
    const ordered = [...options.filter((option) => option.available), ...options.filter((option) => !option.available)]
    return ordered.filter((option) => {
      const text = `${option.name} ${option.group} ${option.summary}`.toLowerCase()
      return words.every((word) => text.includes(word))
    })
  }, [options, query])

  useEffect(() => {
    if (open) searchRef.current?.focus()
  }, [open])

  function close() {
    setExpanded(false)
    triggerRef.current?.focus()
  }

  return (
    <div className="service-picker" onKeyDown={(event) => {
      if (event.key === 'Escape' && open) {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }}>
      <div className="service-picker__label-row">
        <span id={`${pickerId}-label`}>{label}</span>
        <span className="service-picker__count">{availableCount} available</span>
      </div>
      <button
        ref={triggerRef}
        id={pickerId}
        type="button"
        className="service-picker__trigger"
        aria-expanded={open}
        aria-controls={`${pickerId}-panel`}
        aria-labelledby={`${pickerId}-label ${pickerId}-selection`}
        disabled={disabled}
        onClick={() => setExpanded((current) => !current)}
      >
        <span className="service-picker__icon"><Icon name="grid" /></span>
        <span className="service-picker__selection" id={`${pickerId}-selection`}>
          <strong>{selected ? serviceDisplayText(selected.name) : 'Choose a service'}</strong>
          <small>{selected
            ? `${formatUsd(selected.priceCents)} USD · ${serviceDisplayText(selected.etaLabel)}${selected.available ? '' : ' · Unavailable online'}`
            : 'Search by device, network or service name'}</small>
        </span>
        <span className="service-picker__affordance" aria-hidden="true">
          <span>{selected ? 'Change' : 'Select'}</span>
          <span className="service-picker__chevron" />
        </span>
      </button>
      {selected?.hasExample && !open ? (
        <div className="service-picker__selected-example"><ServiceOutputExample productCode={selected.code} productName={serviceDisplayText(selected.name)} /></div>
      ) : null}
      <div className="service-picker__panel" id={`${pickerId}-panel`} hidden={!open}>
        <div className="service-picker__search">
          <label htmlFor={`${pickerId}-search`}>Search services</label>
          <div className="service-picker__search-control">
            <Icon name="search" />
            <input
              ref={searchRef}
              id={`${pickerId}-search`}
              type="search"
              value={query}
              onChange={(event) => setQuery(event.currentTarget.value)}
              onKeyDown={(event) => {
                // Searching inside an order form must not submit that form.
                if (event.key === 'Enter') event.preventDefault()
              }}
              placeholder="Try Apple, Samsung or blacklist"
              autoComplete="off"
              disabled={disabled}
              aria-controls={`${pickerId}-results`}
            />
          </div>
          <p className="service-picker__results-count" role="status">{visible.length} services shown · Prices in USD</p>
        </div>
        <ul className="service-picker__results" id={`${pickerId}-results`} aria-label={`${label} options`}>
          {visible.map((option) => (
            <li key={option.code}>
              <button
                type="button"
                className="service-picker__option"
                aria-pressed={option.code === value}
                disabled={disabled}
                onClick={() => {
                  onChange(option.code)
                  setQuery('')
                  close()
                }}
              >
                <span className="service-picker__option-copy">
                  <small>{serviceDisplayText(option.group)}</small>
                  <strong>{serviceDisplayText(option.name)}</strong>
                  <span>{serviceDisplayText(option.summary)}</span>
                  <small>{serviceDisplayText(option.etaLabel)} · {option.available ? 'Available' : 'Unavailable online'}</small>
                </span>
                <span className="service-picker__option-price">
                  <strong>{formatUsd(option.priceCents)}</strong>
                  {option.code === value ? <span><Icon name="checkSmall" /> Selected</span> : <span>Select service</span>}
                </span>
              </button>
              {option.hasExample ? <div className="service-picker__example"><ServiceOutputExample productCode={option.code} productName={serviceDisplayText(option.name)} /></div> : null}
            </li>
          ))}
        </ul>
        {visible.length === 0 ? (
          <div className="service-picker__empty">
            <p>{options.length === 0 ? 'No services are listed yet. Please check back soon.' : 'No services match your search. Try a device brand or network.'}</p>
            {query ? <button type="button" className="button button--secondary" onClick={() => { setQuery(''); searchRef.current?.focus() }}>Clear search</button> : null}
          </div>
        ) : null}
        <button type="button" className="service-picker__close" onClick={close}>Close service list</button>
      </div>
    </div>
  )
}
