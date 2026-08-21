'use client'

import { useEffect, useState } from 'react'
import { Icon } from './icons'

type Theme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'openline-theme'

/**
 * The token block in tokens.css does the actual work; this only flips the
 * attribute the FOUC guard in the layout already stamped, and remembers
 * the choice.
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    const stamped = document.documentElement.getAttribute('data-theme')
    setTheme(stamped === 'dark' ? 'dark' : 'light')
  }, [])

  function toggle() {
    const next: Theme =
      document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      /* private mode — the choice just does not persist */
    }
    setTheme(next)
  }

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      className="icon-action"
      onClick={toggle}
      aria-pressed={isDark}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
    >
      <Icon name="moon" />
    </button>
  )
}
