/** Colour explicit Clean values only; never guess the meaning of numeric flags. */
export function ProviderOutputText({ value }: { value: string }) {
  const lines = value.split('\n')
  return <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: '0.875rem', lineHeight: 1.6 }}>{lines.map((line, index) => <span key={index} style={/^\s*(?:[^:]+:\s*)?clean\s*$/i.test(line) ? { color: '#15803d', fontWeight: 600 } : undefined}>{line}{index < lines.length - 1 ? '\n' : ''}</span>)}</pre>
}
