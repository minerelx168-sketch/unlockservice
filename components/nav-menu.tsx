'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from './icons'
import type { DrawerGroup } from './site-drawer'

type Props = {
  href: string
  label: string
  icon: IconName
  group: DrawerGroup
  active: boolean
  /** Rendered under the links — the way to the whole catalog. */
  footer?: ReactNode
}

/**
 * A primary link with a menu under it. The link itself still goes to the
 * page, so nothing is lost without the menu; the caret opens it on click
 * and a mouse opens it on hover, with enough delay that crossing the bar
 * does not flash every panel. Escape, a click outside and focus leaving
 * the item all close it. Touch devices never see this: below 1320px the
 * links hand over to the drawer.
 */
export function NavMenu({ href, label, icon, group, active, footer }: Props) {
  const id = useId()
  const pathname = usePathname()
  const root = useRef<HTMLDivElement>(null)
  const caret = useRef<HTMLButtonElement>(null)
  const timer = useRef<number | null>(null)
  const [open, setOpen] = useState(false)

  /* A route change means a choice was made. */
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      setOpen(false)
      caret.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  function schedule(next: boolean, delay: number) {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setOpen(next), delay)
  }

  return (
    <div
      ref={root}
      className="nav-item"
      data-open={open ? 'true' : undefined}
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') schedule(true, 70) }}
      onPointerLeave={(event) => { if (event.pointerType === 'mouse') schedule(false, 180) }}
      onBlur={(event) => {
        if (!root.current?.contains(event.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <Link
        href={href}
        className="nav-link"
        data-active={active ? 'true' : undefined}
        aria-current={href === pathname ? 'page' : undefined}
      >
        <Icon name={icon} strokeWidth={1.9} />
        <span>{label}</span>
      </Link>
      <button
        ref={caret}
        type="button"
        className="nav-caret"
        aria-expanded={open}
        aria-controls={`${id}-menu`}
        aria-label={`${label} menu`}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="chevronDown" strokeWidth={2.2} />
      </button>

      <div id={`${id}-menu`} className="nav-menu" hidden={!open}>
        <Link className="nav-menu-primary" href={group.primary.href}>
          <span className="icon-tile icon-tile--sm" aria-hidden="true">
            <Icon name={group.primary.icon ?? icon} />
          </span>
          <span>
            <b>{group.primary.label}</b>
            {group.primary.note ? <small>{group.primary.note}</small> : null}
          </span>
          <Icon name="arrowRight" strokeWidth={2} />
        </Link>
        {group.items.length ? (
          <ul className="nav-menu-list">
            {group.items.map((item) => (
              <li key={`${item.href}-${item.label}`}>
                <Link href={item.href}>
                  <Icon name={item.icon ?? 'chevronRight'} strokeWidth={1.9} />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
        {footer ? <div className="nav-menu-foot">{footer}</div> : null}
      </div>
    </div>
  )
}
