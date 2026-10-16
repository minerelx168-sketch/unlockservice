'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Brand } from './brand'
import { Icon, type IconName } from './icons'
import { ThemeToggle } from './theme-toggle'

export type DrawerLink = { href: string; label: string; note?: string; icon?: IconName }

export type DrawerGroup = {
  id: string
  label: string
  icon: IconName
  /** The one thing most people open this group for; drawn as a highlighted row. */
  primary: DrawerLink
  items: DrawerLink[]
}

type Props = {
  open: boolean
  onClose: () => void
  groups: DrawerGroup[]
  links: DrawerLink[]
  isAuthenticated: boolean
  /** Server-rendered sign-out form; the drawer cannot import the action itself. */
  accountSlot?: ReactNode
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

/**
 * The navigator. One sheet from the right that holds every destination,
 * including the ones the header has no room for, grouped the way a
 * customer thinks about them: what do I want done, where is my order, who
 * do I ask. It is a dialog — focus stays inside, Escape and the overlay
 * close it, and the page behind does not scroll.
 */
export function SiteDrawer({ open, onClose, groups, links, isAuthenticated, accountSlot }: Props) {
  const pathname = usePathname()
  const panel = useRef<HTMLElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  /* A route change means a choice was made. */
  useEffect(() => {
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const root = document.documentElement
    const overflow = root.style.overflow
    root.style.overflow = 'hidden'
    closeButton.current?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel.current) return
      const nodes = Array.from(panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (node) => node.offsetParent !== null,
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      root.style.overflow = overflow
      previous?.focus?.()
    }
  }, [open, onClose])

  return (
    <div className="drawer-root" data-open={open ? 'true' : 'false'} inert={!open}>
      <div className="drawer-overlay" onClick={onClose} aria-hidden="true" />
      <aside
        className="drawer"
        id="site-drawer"
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label="Site navigation"
      >
        <header className="drawer-head">
          <Brand />
          <button
            type="button"
            className="icon-action drawer-close"
            ref={closeButton}
            onClick={onClose}
            aria-label="Close navigation"
          >
            <Icon name="cross" />
          </button>
        </header>

        <div className="drawer-body">
          <p className="drawer-label">Services</p>
          <ul className="drawer-list">
            {groups.map((group) => {
              const isOpen = expanded === group.id
              return (
                <li key={group.id} className="drawer-group" data-open={isOpen ? 'true' : 'false'}>
                  <button
                    type="button"
                    className="drawer-item drawer-item--group"
                    aria-expanded={isOpen}
                    aria-controls={`drawer-group-${group.id}`}
                    onClick={() => setExpanded(isOpen ? null : group.id)}
                  >
                    <Icon name={group.icon} strokeWidth={1.9} />
                    <span>{group.label}</span>
                    <Icon name="chevronDown" className="drawer-chevron" strokeWidth={2} />
                  </button>
                  <div id={`drawer-group-${group.id}`} className="drawer-sub" hidden={!isOpen}>
                    <Link className="drawer-sub-primary" href={group.primary.href}>
                      <Icon name={group.primary.icon ?? group.icon} strokeWidth={1.9} />
                      <span>
                        <b>{group.primary.label}</b>
                        {group.primary.note ? <small>{group.primary.note}</small> : null}
                      </span>
                    </Link>
                    {group.items.map((item) => (
                      <Link key={item.href + item.label} className="drawer-sub-item" href={item.href}>
                        <Icon name={item.icon ?? 'chevronRight'} strokeWidth={1.9} />
                        <span>{item.label}</span>
                        {item.note ? <em>{item.note}</em> : null}
                      </Link>
                    ))}
                  </div>
                </li>
              )
            })}
            {links.map((link) => (
              <li key={link.href}>
                <Link className="drawer-item" href={link.href}>
                  <Icon name={link.icon ?? 'chevronRight'} strokeWidth={1.9} />
                  <span>{link.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          <hr className="drawer-rule" />

          <div className="drawer-row">
            <span className="drawer-label">Theme</span>
            <ThemeToggle />
          </div>

          <hr className="drawer-rule" />

          <p className="drawer-label">Account</p>
          <ul className="drawer-list">
            {isAuthenticated ? (
              <>
                <li>
                  <Link className="drawer-item" href="/user/dashboard">
                    <Icon name="grid" strokeWidth={1.9} />
                    <span>Dashboard</span>
                  </Link>
                </li>
                <li>
                  <Link className="drawer-item" href="/user/orders">
                    <Icon name="clock" strokeWidth={1.9} />
                    <span>My orders</span>
                  </Link>
                </li>
                <li>
                  <Link className="drawer-item" href="/user/profile">
                    <Icon name="user" strokeWidth={1.9} />
                    <span>Profile</span>
                  </Link>
                </li>
                {accountSlot ? <li className="drawer-slot">{accountSlot}</li> : null}
              </>
            ) : (
              <>
                <li>
                  <Link className="drawer-item" href="/login">
                    <Icon name="user" strokeWidth={1.9} />
                    <span>Sign in</span>
                  </Link>
                </li>
                <li>
                  <Link className="drawer-item drawer-item--accent" href="/register">
                    <Icon name="sparkle" strokeWidth={1.9} />
                    <span>Create an account</span>
                  </Link>
                </li>
              </>
            )}
          </ul>
        </div>
      </aside>
    </div>
  )
}
