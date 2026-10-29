import { serviceDescriptionBlocks } from '@/lib/service-description'

/** Plain React text only: provider descriptions never execute HTML. */
export function ServiceDescription({ value, compact = false }: { value: string; compact?: boolean }) {
  const blocks = serviceDescriptionBlocks(value)
  const content = <div className="service-description">
    {blocks.map((block, index) => block.kind === 'table' ? (
      <div className="service-description__table-block" key={index}>
        <div className="service-description__table-scroll" role="region" aria-label="Service details comparison" tabIndex={0}>
          <table><thead><tr>{block.headings.map((heading, column) => <th scope="col" key={column}>{heading}</th>)}</tr></thead>
            <tbody>{block.rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, column) => column === 0
              ? <th scope="row" key={column}>{cell}</th>
              : <td key={column}>{block.headings.includes('SIM-Lock') && /^(Yes|No)$/.test(cell)
                ? <span className={`service-description__feature service-description__feature--${cell.toLowerCase()}`} aria-label={cell === 'Yes' ? 'Included' : 'Not included'} title={cell === 'Yes' ? 'Included' : 'Not included'}>{cell === 'Yes' ? '✓' : '✕'}</span>
                : cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="service-description__table-hint">Scroll across to see all details.</p>
      </div>
    ) : <p className="service-description__text" key={index}>{block.text}</p>)}
  </div>
  return compact && (value.length > 500 || blocks.some(block => block.kind === 'table'))
    ? <details className="service-description__details"><summary>Service details and requirements</summary>{content}</details>
    : content
}
