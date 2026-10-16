import type { ReactNode } from 'react'

/**
 * One line-style icon grid, drawn on a 24px box. Inline SVG rather than a
 * font or a sprite so a page still makes no external request, and so the
 * glyph inherits the surrounding colour token.
 */

const PATHS = {
  /**
   * The brand mark: an open padlock whose body carries a phone's
   * proportions and home bar. The shackle is a hook with no right leg at
   * all — an earlier version stopped the leg just short of the body and
   * at any real size the two strokes merged, so it read as locked. If the
   * mark is redrawn, keep the shackle open to the air.
   */
  unlockMark: (
    <>
      <rect x="6.5" y="10" width="11" height="11.5" rx="3.2" />
      <path d="M9.2 10V6.8a3.1 3.1 0 0 1 6.2 0" />
      <path d="M10.6 18.2h2.8" />
    </>
  ),
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
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4 7 8 6 8-6" />
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
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5V5" />
      <path d="M12 19v2.5" />
      <path d="M2.5 12H5" />
      <path d="M19 12h2.5" />
      <path d="M5.3 5.3l1.8 1.8" />
      <path d="M16.9 16.9l1.8 1.8" />
      <path d="M5.3 18.7l1.8-1.8" />
      <path d="M16.9 7.1l1.8-1.8" />
    </>
  ),
  chevronDown: <path d="M6 9l6 6 6-6" />,
  chevronRight: <path d="M9 6l6 6-6 6" />,
  arrowLeft: (
    <>
      <path d="M19 12H6" />
      <path d="M11 6l-6 6 6 6" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.6" />
      <path d="M4.8 20a7.2 7.2 0 0114.4 0" />
    </>
  ),
  logout: (
    <>
      <path d="M10 4H6a2 2 0 00-2 2v12a2 2 0 002 2h4" />
      <path d="M14 8l4 4-4 4" />
      <path d="M18 12H9" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 010 18" />
      <path d="M12 3a14 14 0 000 18" />
    </>
  ),
  star: <path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9L12 16.9l-5.3 2.8 1.1-5.9-4.3-4.1 5.9-.8z" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 01-14.3 4.9" />
      <path d="M4 12a8 8 0 0114.3-4.9" />
      <path d="M18.5 3.5v4h-4" />
      <path d="M5.5 20.5v-4h4" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16" />
      <path d="M10.6 6.1A10 10 0 0121.5 12a15 15 0 01-3 3.6" />
      <path d="M6.6 6.9A14.7 14.7 0 002.5 12s3.5 6.5 9.5 6.5a9.4 9.4 0 004-.9" />
      <path d="M9.9 9.9a2.8 2.8 0 004 4" />
    </>
  ),
  wallet: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18" />
      <path d="M16 14.5h.01" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4z" />
      <path d="M12 6v12" />
    </>
  ),
  home: (
    <>
      <path d="M4 11l8-7 8 7" />
      <path d="M6 10v10h12V10" />
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
