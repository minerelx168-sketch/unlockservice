'use client'

import { useEffect, useRef, useState } from 'react'

export function CopySnippet({ label, value, multiline = false, buttonLabel = 'Copy' }: {
  label: string
  value: string
  multiline?: boolean
  buttonLabel?: string
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const manual = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (state === 'manual') {
      manual.current?.focus()
      manual.current?.select()
    }
    if (state !== 'copied') return
    const timer = setTimeout(() => setState('idle'), 2500)
    return () => clearTimeout(timer)
  }, [state])

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      setState('manual')
      manual.current?.focus()
      manual.current?.select()
    }
  }

  return <div className="api-copy-block">
    <div className="api-copy-heading">
      <span>{label}</span>
      <button type="button" className="button button--quiet api-copy-button" aria-label={`Copy ${label}`} onClick={() => void copy()}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>
        </svg>
        {state === 'copied' ? 'Copied!' : buttonLabel}
      </button>
    </div>
    {multiline ? <pre><code>{value}</code></pre> : <code className="api-copy-value">{value}</code>}
    <span className="api-copy-status" role="status">{state === 'copied' ? `${label} copied to clipboard.` : ''}</span>
    {state === 'manual' ? <div className="api-copy-fallback">
      <p>Automatic copy is unavailable. Copy the selected text below.</p>
      <textarea ref={manual} readOnly value={value} rows={multiline ? 6 : 3} aria-label={`${label} — select to copy`} onFocus={event => event.target.select()}/>
    </div> : null}
  </div>
}
