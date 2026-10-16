import { Icon } from './icons'

/**
 * Provider output arrives as "Key: Value" lines. Rendered as a report card —
 * label left, value right, with a status badge where the value states a
 * condition a buyer checks for. Text that does not parse falls back to the
 * monospace block unchanged, so unlock codes and prose are never mangled.
 *
 * React escapes every string: provider text is never executed as HTML.
 */

type Row = { label: string; value: string; tone: 'good' | 'warn' | 'bad' | null }

const GOOD = new Set(['clean', 'off', 'no', 'unlocked', 'valid', 'active', 'out of blacklist', 'not found', 'none'])
const BAD = new Set(['blacklisted', 'lost', 'stolen', 'barred', 'blocked', 'in blacklist', 'lost or stolen'])
const WARN = new Set(['on', 'yes', 'locked', 'expired', 'inactive', 'unknown'])

function tone(label: string, value: string): Row['tone'] {
  const v = value.trim().toLocaleLowerCase('en')
  if (GOOD.has(v)) return 'good'
  if (BAD.has(v)) return 'bad'
  if (WARN.has(v)) return 'warn'
  return null
}

function parseRows(text: string): Row[] | null {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  if (lines.length < 2) return null
  const rows: Row[] = []
  let matched = 0
  for (const line of lines) {
    const split = line.match(/^([^:]{1,48}):\s*(.+)$/)
    if (split) {
      matched += 1
      rows.push({ label: split[1].trim(), value: split[2].trim(), tone: tone(split[1], split[2]) })
    } else {
      rows.push({ label: '', value: line, tone: null })
    }
  }
  // Mostly labelled lines, or it is not a report — codes and prose stay verbatim.
  return matched >= Math.max(2, Math.ceil(lines.length * 0.6)) ? rows : null
}

export function ReportCard({ text, fallbackClassName = 'provider-code-result' }: { text: string; fallbackClassName?: string }) {
  const rows = parseRows(text)
  if (!rows) return <pre className={fallbackClassName}>{text}</pre>

  const statusRows = rows.filter((row) => row.tone !== null && row.label)
  const infoRows = rows.filter((row) => row.tone === null || !row.label)

  return (
    <div className="report-card">
      {statusRows.length ? (
        <section className="report-card-group">
          <h3 className="report-card-heading"><span className="report-card-dot" aria-hidden="true" />Status</h3>
          <ul className="report-card-status-list">
            {statusRows.map((row, index) => (
              <li className={`report-card-status report-card-status--${row.tone}`} key={`${row.label}-${index}`}>
                <span className="report-card-status-label">{row.label}</span>
                <span className="report-card-badge">
                  <Icon name={row.tone === 'good' ? 'checkSmall' : 'info'} strokeWidth={2.4} />
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {infoRows.length ? (
        <section className="report-card-group">
          <h3 className="report-card-heading"><span className="report-card-dot" aria-hidden="true" />Device information</h3>
          <dl className="report-card-rows">
            {infoRows.map((row, index) => (
              <div className="report-card-row" key={`${row.label || 'line'}-${index}`}>
                <dt>{row.label || '—'}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </div>
  )
}
