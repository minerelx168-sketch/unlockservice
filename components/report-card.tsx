import { parseReport, type ReportRow } from '@/lib/report-card-parse'
import { Icon } from './icons'

/**
 * Provider output rendered the way a buyer reads it: the conditions they
 * are checking for first, as badged rows, then who the device is, then
 * the rest. Text that does not parse falls back to the monospace block
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
        critical: parsed.critical.slice(0, limit.critical ?? parsed.critical.length),
        identity: parsed.identity.slice(0, limit.identity ?? parsed.identity.length),
        details: parsed.details.slice(0, limit.details ?? parsed.details.length),
      }
    : parsed

  return (
    <div className="report-card">
      {report.critical.length ? (
        <section className="report-card-group">
          <h3 className="report-card-heading">
            <span className="report-card-dot" aria-hidden="true" />
            Critical status
          </h3>
          <ul className="report-card-status-list">
            {report.critical.map((row, index) => (
              <li className={`report-card-status report-card-status--${row.tone}`} key={`${row.label}-${index}`}>
                <span className="report-card-status-label">{row.label}</span>
                <span className="report-card-badge">
                  <Icon name={row.tone === 'good' ? 'checkSmall' : row.tone === 'bad' ? 'cross' : 'info'} strokeWidth={2.4} />
                  {row.value}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {report.identity.length ? (
        <section className="report-card-group">
          <h3 className="report-card-heading">
            <span className="report-card-dot" aria-hidden="true" />
            Device information
          </h3>
          <Rows rows={report.identity} />
        </section>
      ) : null}

      {report.details.length ? (
        <section className="report-card-group">
          <h3 className="report-card-heading">
            <span className="report-card-dot" aria-hidden="true" />
            {report.identity.length || report.critical.length ? 'Additional details' : 'Report'}
          </h3>
          <Rows rows={report.details} />
        </section>
      ) : null}
    </div>
  )
}
