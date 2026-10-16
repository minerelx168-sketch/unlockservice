import type { ReactNode } from 'react'
import { badgeFor, type SampleRow } from '@/lib/sample-report'
import { Icon, type IconName } from './icons'

export type SampleFact = { icon: IconName; text: string }

type Props = {
  eyebrow: string
  title: string
  /** What the data is. Always says "example" in some form: this card is never a live lookup. */
  pill: string
  icon?: IconName
  /** Two short monospace facts under the title. */
  meta: [string, string]
  /** A masked identifier, shown exactly as given. Never pass a real one. */
  imei?: string
  rows: SampleRow[]
  facts: SampleFact[]
  action?: ReactNode
  className?: string
}

/**
 * The report preview on a landing page, in the shape a buyer will meet
 * on the order page: numbered rows, a label with a small icon, the value
 * on the right, and a badge on the rows that carry a verdict. Everything
 * on it is marked as an example — it shows the format a report arrives in,
 * never a result for a real device.
 */
export function SampleReportCard({ eyebrow, title, pill, icon = 'shield', meta, imei, rows, facts, action, className = '' }: Props) {
  return (
    <aside className={`sample-card ${className}`.trim()} aria-label={`${eyebrow}: ${title}`}>
      <header className="sample-card-head">
        <span className="icon-tile icon-tile--sm" aria-hidden="true">
          <Icon name={icon} />
        </span>
        <span className="sample-card-title">
          <small>{eyebrow}</small>
          <b>{title}</b>
        </span>
        <span className="sample-card-pill">
          <i aria-hidden="true" />
          {pill}
        </span>
      </header>

      <p className="sample-card-meta">
        <span>{meta[0]}</span>
        <span>{meta[1]}</span>
      </p>

      {imei ? (
        <div className="sample-card-imei">
          <span>IMEI</span>
          <b>{imei}</b>
        </div>
      ) : null}

      <ol className="sample-card-rows">
        {rows.map((row, index) => {
          const badge = badgeFor(row.tone)
          return (
            <li key={`${row.label}-${index}`} data-tone={row.tone ?? undefined}>
              <em aria-hidden="true">{String(index + 1).padStart(2, '0')}</em>
              <span className="sample-card-label">
                <Icon name={row.icon} strokeWidth={1.9} />
                {row.label}
              </span>
              <span className="sample-card-value">
                {row.value}
                {badge ? (
                  <span className="sample-card-badge">
                    <Icon name={row.tone === 'good' ? 'checkSmall' : row.tone === 'bad' ? 'cross' : 'info'} strokeWidth={2.4} />
                    {badge}
                  </span>
                ) : null}
              </span>
            </li>
          )
        })}
      </ol>

      <ul className="sample-card-facts">
        {facts.map((fact) => (
          <li key={fact.text}>
            <Icon name={fact.icon} strokeWidth={2} />
            {fact.text}
          </li>
        ))}
      </ul>

      {action ? <div className="sample-card-action">{action}</div> : null}
    </aside>
  )
}

/**
 * A phone, drawn here, that sits behind the sample card on a wide screen.
 * Decorative: the card is the content.
 */
export function PhoneArt() {
  return (
    <svg className="phone-art" viewBox="0 0 220 440" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id="phone-art-body" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--surface-strong)" />
          <stop offset="1" stopColor="var(--page-tint)" />
        </linearGradient>
      </defs>
      <rect x="6" y="6" width="208" height="428" rx="40" fill="url(#phone-art-body)" stroke="var(--line-strong)" strokeWidth="2" />
      <rect x="16" y="16" width="188" height="408" rx="32" stroke="var(--line)" strokeWidth="1.5" />
      <rect x="24" y="24" width="86" height="86" rx="22" fill="var(--surface)" stroke="var(--line-strong)" strokeWidth="1.5" />
      <circle cx="46" cy="46" r="11" fill="var(--page-tint)" stroke="var(--line-strong)" strokeWidth="1.5" />
      <circle cx="88" cy="46" r="11" fill="var(--page-tint)" stroke="var(--line-strong)" strokeWidth="1.5" />
      <circle cx="46" cy="88" r="11" fill="var(--page-tint)" stroke="var(--line-strong)" strokeWidth="1.5" />
      <circle cx="46" cy="46" r="4" fill="var(--primary)" opacity=".55" />
      <circle cx="88" cy="46" r="4" fill="var(--primary)" opacity=".55" />
      <circle cx="46" cy="88" r="4" fill="var(--primary)" opacity=".55" />
      <circle cx="88" cy="86" r="5" fill="var(--primary)" opacity=".25" />
      <rect x="214" y="120" width="4" height="46" rx="2" fill="var(--line-strong)" />
      <rect x="2" y="96" width="4" height="24" rx="2" fill="var(--line-strong)" />
      <rect x="2" y="134" width="4" height="46" rx="2" fill="var(--line-strong)" />
    </svg>
  )
}
