'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { groupImei, IMEI_LENGTH, luhnValid, normalizeImei } from '@/lib/imei'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { Icon } from './icons'

type CheckPayload = {
  id: number
  maskedImei: string
  imei?: string
  status: 'queued' | 'processing' | 'completed' | 'unavailable'
  provider: string
  result: Record<string, unknown> | null
  message?: string
  createdAt: string
}
type ValidationCheck = { key: string; label: string; status: 'passed' | 'failed' }
const STATUS: Record<CheckPayload['status'], { kicker: string; badge: string; label: string }> = {
  completed: { kicker: 'RESULT', badge: 'badge--success', label: 'Complete' },
  queued: { kicker: 'Check queued', badge: 'badge--pending', label: 'Queued' },
  processing: { kicker: 'Check processing', badge: 'badge--pending', label: 'Processing' },
  unavailable: { kicker: 'Check unavailable', badge: 'badge--error', label: 'Unavailable' },
}
function isLocalValidation(check: CheckPayload) {
  return check.provider === 'local-validation' || check.result?.kind === 'format_checksum'
}
function localResult(imei: string): Record<string, unknown> {
  return {
    kind: 'format_checksum',
    title: 'IMEI format check complete',
    summary: 'This free check validates the 15-digit format and Luhn checksum only. It does not look up carrier, blacklist, warranty, lock or other device data.',
    checks: [
      { key: 'format', label: '15-digit format', status: 'passed' },
      { key: 'checksum', label: 'Luhn checksum', status: 'passed' },
    ],
    imei,
  }
}
function validationChecks(result: Record<string, unknown> | null): ValidationCheck[] {
  if (!Array.isArray(result?.checks)) return []
  return result.checks.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    if (typeof row.label !== 'string' || (row.status !== 'passed' && row.status !== 'failed')) return []
    return [{ key: typeof row.key === 'string' ? row.key : row.label, label: row.label, status: row.status }]
  })
}
function displayLabel(key: string) {
  return key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}
function cleanResultForSave(check: CheckPayload) {
  if (isLocalValidation(check)) {
    const checks = validationChecks(check.result)
    return {
      title: 'IMEI format check complete',
      summary: String(check.result?.summary ?? 'Format and checksum validation only.'),
      checks: checks.map(({ label, status }) => ({ label, status })),
    }
  }
  return check.result
}
export function ImeiCheckForm({ csrfToken }: { csrfToken?: string }) {
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [check, setCheck] = useState<CheckPayload | null>(null)
  const startedRef = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (!check || !csrfToken || (check.status !== 'queued' && check.status !== 'processing')) return
    let cancelled = false
    const refreshFromDatabase = async () => {
      try {
        const response = await fetch(`/api/imei/checks/${check.id}`, { method: 'GET', credentials: 'same-origin', cache: 'no-store', headers: { 'X-Requested-With': 'XMLHttpRequest' } })
        const data = (await response.json()) as { success?: boolean; check?: CheckPayload }
        if (response.ok && data.success && data.check && !cancelled) setCheck(data.check)
      } catch { /* background refresh is best effort */ }
    }
    void refreshFromDatabase()
    const timer = window.setInterval(refreshFromDatabase, 5_000)
    return () => { cancelled = true; window.clearInterval(timer) }
  }, [check?.id, check?.status, csrfToken])
  function saveCheckResult() {
    if (!check?.result) return
    const clean = cleanResultForSave(check)
    const text = JSON.stringify(clean, null, 2)
    const blob = new Blob([`${text}\n`], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `imei-check-${check.id || 'local'}.json`
    document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url)
  }
  function change(event: FormEvent<HTMLInputElement>) {
    const digits = normalizeImei(event.currentTarget.value)
    if (digits && !startedRef.current) { startedRef.current = true; trackFunnelEvent('imei_input_started', { event_category: 'phone_check', service_category: 'free_check' }) }
    setValue(groupImei(digits))
    setError(digits.length === IMEI_LENGTH && !luhnValid(digits) ? 'That IMEI checksum does not match.' : null)
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const digits = normalizeImei(value)
    if (digits.length !== IMEI_LENGTH || !luhnValid(digits)) {
      setError(`Enter a valid ${IMEI_LENGTH}-digit IMEI.`); trackFunnelEvent('validation_result', { event_category: 'phone_check', service_category: 'free_check', validation_status: 'failed' }); inputRef.current?.focus(); return
    }
    setBusy(true); setError(null); setCheck(null)
    try {
      if (csrfToken) {
        const response = await fetch('/api/imei/checks', {
          method: 'POST', credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
          body: JSON.stringify({ imei: digits, csrfToken }),
        })
        const data = await response.json() as { success?: boolean; check?: CheckPayload; error?: string }
        if (!response.ok || !data.check || data.success === false) throw new Error(data.error ?? 'The IMEI check could not be completed.')
        setCheck(data.check)
      } else {
        setCheck({ id: 0, maskedImei: digits, imei: digits, status: 'completed', provider: 'local-validation', result: localResult(digits), createdAt: new Date().toISOString() })
      }
      trackFunnelEvent('validation_result', { event_category: 'phone_check', service_category: 'free_check', validation_status: 'passed' })
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : 'The IMEI check could not be completed.')
      trackFunnelEvent('validation_result', { event_category: 'phone_check', service_category: 'free_check', validation_status: 'error' })
    } finally { setBusy(false) }
  }
  function reset() { setCheck(null); setError(null); setValue(''); inputRef.current?.focus() }
  const checks = validationChecks(check?.result ?? null)
  return (
    <>
      <form className="unlock-quote" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="check-imei">IMEI number</label>
          <input id="check-imei" ref={inputRef} type="text" inputMode="numeric" autoComplete="off" spellCheck={false} placeholder="35 490912 345678 9" value={value} onChange={change} />
          <p className="field-note" data-state={error ? 'invalid' : 'idle'} aria-live="polite"><Icon name={error ? 'cross' : 'info'} strokeWidth={error ? 2.2 : 1.9} /><span>{error ?? 'Find the IMEI in Settings or dial *#06# on the phone.'}</span></p>
        </div>
        <button className="button button--primary button--wide unlock-submit" type="submit" disabled={busy}><Icon name="search" strokeWidth={1.9} />{busy ? 'Checking…' : 'Check IMEI'}</button>
        <p className="unlock-quote-note">Free format and checksum validation only. Choose a paid Phone Check for carrier, blacklist, warranty and device data.</p>
      </form>
      {check ? (
        <section className="card service-workbench-result" role="status" aria-live="polite">
          <div className="card-topline"><span className="kicker"><Icon name={check.status === 'completed' ? 'check' : 'info'} />{STATUS[check.status].kicker}</span><span className={`badge ${STATUS[check.status].badge}`}>{STATUS[check.status].label}</span></div>
          {check.status === 'completed' && isLocalValidation(check) ? (
            <>
              <h3 className="t-card">IMEI format check complete</h3>
              <p className="t-small">{String(check.result?.summary ?? 'This free check validates format and checksum only.')}</p>
              <table className="validation-results"><caption className="sr-only">IMEI format and checksum results</caption><thead><tr><th scope="col">Validation</th><th scope="col">Result</th></tr></thead><tbody>{(checks.length ? checks : validationChecks(localResult(check.imei ?? normalizeImei(value)))).map((item) => <tr key={item.key}><th scope="row">{item.label}</th><td className={item.status === 'passed' ? 'service-workbench-valid' : 'service-workbench-error'}>{item.status === 'passed' ? 'Passed' : 'Not passed'}</td></tr>)}</tbody></table>
            </>
          ) : (
            <><h3 className="t-card">IMEI {check.imei ?? check.maskedImei}</h3><p className="t-small">{String(check.result?.summary ?? check.message ?? 'The report is ready.')}</p>{check.status === 'completed' && check.result ? <div className="service-check-result-list">{Object.entries(check.result).filter(([key]) => !['source', 'demo', 'nextStep', 'checkType'].includes(key)).map(([key, result]) => <div className="service-check-result-row" key={key}><span>{displayLabel(key)}</span><strong>{typeof result === 'string' || typeof result === 'number' || typeof result === 'boolean' ? String(result) : JSON.stringify(result)}</strong></div>)}</div> : null}</>
          )}
          {check.status === 'completed' && check.result ? <div className="service-workbench-result-actions"><button className="button button--primary" type="button" onClick={saveCheckResult}>Save</button><button className="button button--quiet" type="button" onClick={reset}>Run another check</button><Link className="button button--quiet" href="/services/imei-check">Choose a paid Phone Check</Link><Link className="button button--quiet" href="/services/unlock">Choose an Unlock service</Link></div> : null}
        </section>
      ) : null}
    </>
  )
}
