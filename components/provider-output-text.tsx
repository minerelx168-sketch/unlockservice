/** Preserve provider values verbatim; only explicit Clean values get a positive colour. */
export function ProviderOutputText({ value, variant = 'table' }: { value: string; variant?: 'table' | 'plain' }) {
  // Free Check shows the saved provider response as escaped text, without parsing,
  // relabelling, filtering or interpreting any of its fields.
  if (variant === 'plain') return <pre className="provider-output-plain">{value}</pre>
  return <div className="provider-output">{value.split('\n').map((line, index) => {
    const pair = line.match(/^([^:\n]{1,80}):\s*(.*)$/)
    const clean = /^\s*clean\s*$/i.test(pair ? pair[2] : line)
    return pair
      ? <div className="provider-output__row" key={index}><span className="provider-output__label">{pair[1]}</span><span className={clean ? 'provider-output__value provider-output__value--clean' : 'provider-output__value'}>{pair[2]}</span></div>
      : <p className={clean ? 'provider-output__line provider-output__value--clean' : 'provider-output__line'} key={index}>{line || '\u00a0'}</p>
  })}</div>
}
