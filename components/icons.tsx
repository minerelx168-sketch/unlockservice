import type { ReactNode } from 'react'

/**
 * One line-style icon grid, drawn on a 24px box. Inline SVG rather than a
 * font or a sprite so a page still makes no external request, and so the
 * glyph inherits the surrounding colour token.
 */

const PATHS = {
  shieldCheck: (
    <>
      <path d="M12 3l7 3v6c0 4.4-3 7.9-7 9-4-1.1-7-4.6-7-9V6l7-3z" />
      <path d="M9.4 12.2l1.9 1.9 3.4-3.7" />
    </>
  ),
  shield: <path d="M12 3l7 3v6c0 4.4-3 7.9-7 9-4-1.1-7-4.6-7-9V6l7-3z" />,
  device: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.6" />
      <path d="M10.6 18.6h2.8" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="3" />
      <path d="M8.2 10.5V7.8a3.8 3.8 0 017.6 0v2.7" />
    </>
  ),
  bolt: <path d="M13.2 3L5.4 13.4h5.3L10 21l7.9-10.4h-5.4z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-3.7-3.7" />
    </>
  ),
  file: (
    <>
      <path d="M14 4H6v16h12V9z" />
      <path d="M14 4v5h4" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  moon: <path d="M20 14.4A8.4 8.4 0 019.6 4 8.6 8.6 0 1020 14.4z" />,
  sparkle: <path d="M12 4l1.9 4 4.4.6-3.2 3 .8 4.4L12 14l-3.9 2 .8-4.4-3.2-3 4.4-.6z" />,
  check: <path d="M4 13.5l4.6 4.5L20 6.6" />,
  checkSmall: <path d="M20 6.5L9.5 17 4 11.6" />,
  plus: (
    <>
      <path d="M12 6v12" />
      <path d="M6 12h12" />
    </>
  ),
  cross: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6L6 18" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h13" />
      <path d="M13 6l6 6-6 6" />
    </>
  ),
  pulse: <path d="M4 12h5l2-5 2 10 2-5h5" />,
  question: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 114 2.2c-.9.6-1.6 1-1.6 2" />
      <path d="M12 17h.01" />
    </>
  ),
  keypad: (
    <>
      <path d="M4 7.5h16v9H4z" />
      <path d="M8 11h.01" />
      <path d="M12 11h.01" />
      <path d="M16 11h.01" />
      <path d="M8 14h8" />
    </>
  ),
  window: (
    <>
      <path d="M4 6.5h16v11H4z" />
      <path d="M4 9.5h16" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3.2 2" />
    </>
  ),
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

export function Icon({
  name,
  strokeWidth = 1.8,
  className,
}: {
  name: IconName
  strokeWidth?: number
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  )
}
