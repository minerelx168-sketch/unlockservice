import { parseReport, type ReportRow } from '@/lib/report-card-parse'
import { Icon } from './icons'

/**
 * Provider output rendered the way a buyer reads it: the conditions they
 * are checking for first, as badged rows, then everything else as
 * label/value rows. Text that does not parse falls back to the monospace block
 * unchanged, so unlock codes and prose are never mangled.
 *
 * React escapes every string: provider text is never executed as HTML.
 * The colour logic lives in lib/report-card-parse.ts, where it is tested.
 */

function Rows({ rows }: { rows: ReportRow[] }) {
  return (
    <dl className="report-card-rows">
      {rows.map((row, index) => (
        <div className="report-card-row" key={`${row.label || 'line'}-${index}`}>
          <dt>{row.label || '—'}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  )
}

type Limit = { critical?: number; identity?: number; details?: number }

export function ReportCard({
  text,
  fallbackClassName = 'provider-code-result',
  limit,
}: {
  text: string
  fallbackClassName?: string
  /** For a preview: how many rows of each group to show. Real reports are never cut. */
  limit?: Limit
}) {
  const parsed = parseReport(text)
  if (!parsed) return <pre className={fallbackClassName}>{text}</pre>
  const report = limit
    ? {
        ...parsed,
        critical: parsed.critical.slice(0, limit.critical ?? parsed.critical.length),
        rows: [
          ...parsed.critical.slice(0, limit.critical ?? parsed.critical.length),
          ...parsed.rows
            .filter((row) => !parsed.critical.includes(row))
            .slice(0, (limit.identity ?? parsed.identity.length) + (limit.details ?? parsed.details.length)),
        ],
      }
    : parsed

  const statusRows = report.critical
  const infoRows = report.rows.filter((row) => !statusRows.includes(row))

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
          <Rows rows={infoRows} />
        </section>
      ) : null}
    </div>
  )
}
