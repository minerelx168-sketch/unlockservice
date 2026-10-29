'use client'
import Link from 'next/link'
import { useRef, useState, type FormEvent } from 'react'
import { serviceIdentifier } from '@/lib/service-identifier'
import type { ProviderReport } from '@/lib/imei-report'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { Icon } from './icons'
import { ProviderOutputText } from './provider-output-text'

type Quota = { limit: number; used: number; remaining: number; resetAt: string }
type Check = { id: number; imei?: string; maskedImei: string; status: string; result: ProviderReport | null; providerCode?: string; message?: string }
export function ImeiCheckForm({ csrfToken, initialQuota, disabledReason, trackEvents = true }: { csrfToken?: string; initialQuota?: Quota; disabledReason?: string; trackEvents?: boolean }) {
  const [value, setValue] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const [check, setCheck] = useState<Check | null>(null), [quota, setQuota] = useState(initialQuota)
  const requestKey = useRef(''), inFlight = useRef(false), input = useRef<HTMLInputElement>(null)
  const exhausted = quota?.remaining === 0
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!csrfToken || disabledReason || inFlight.current || exhausted) return
    const imei = serviceIdentifier(value)
    if (!imei) { setError('Enter a valid 15-digit IMEI.'); input.current?.focus(); return }
    if (!requestKey.current) requestKey.current = crypto.randomUUID()
    inFlight.current = true; setBusy(true); setError('')
    try {
      const response = await fetch('/api/imei/checks', { method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        body: JSON.stringify({ imei, csrfToken, idempotencyKey: requestKey.current }) })
      const data = await response.json() as { success?: boolean; check?: Check; quota?: Quota; error?: string }
      if (data.quota) setQuota(data.quota)
      if (!response.ok || !data.check) throw new Error(data.error || 'Unable to complete this check.')
      setCheck(data.check)
      // A free provider lookup is never a purchase or payment conversion.
      if (trackEvents) trackFunnelEvent('validation_result', { service_category: 'free_check', validation_status: data.check.status === 'completed' ? 'passed' : 'error' })
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Unable to confirm the result. Retry this same request safely.') }
    finally { inFlight.current = false; setBusy(false) }
  }
  function reset() { requestKey.current = ''; setCheck(null); setValue(''); setError(''); input.current?.focus() }
  function save() {
    if (!check?.result) return
    const url = URL.createObjectURL(new Blob([JSON.stringify(check.providerCode ? { imei: check.imei, result: check.providerCode } : check.result, null, 2)], { type: 'application/json' }))
    const link = document.createElement('a'); link.href = url; link.download = `apple-free-check-${check.id}.json`; link.click(); URL.revokeObjectURL(url)
  }
  return <>
    {disabledReason ? <div className="apple-check-allowance" role="status"><strong>Account not ready</strong><p className="field-note">{disabledReason}</p></div> : csrfToken ? <div className="apple-check-allowance" aria-live="polite"><div className="apple-check-allowance-summary"><strong>{quota?.remaining ?? 3} of 3 free checks remaining today.</strong><span className="apple-check-allowance-meter" aria-hidden="true">{[1, 2, 3].map(slot => <span key={slot} data-available={slot <= (quota?.remaining ?? 3)} />)}</span></div><p className="field-note">Resets daily at 00:00 UTC. Each submitted check uses one allowance.</p></div> : <div className="apple-check-allowance"><strong>3 free checks. Every day.</strong><p className="field-note">Sign in with a verified account to use your free allowance.</p></div>}
    <form className="unlock-quote apple-check-input-form" onSubmit={submit} noValidate>
      <div className="field"><label htmlFor="check-imei">Apple device IMEI</label><input id="check-imei" ref={input} type="text" inputMode="numeric" autoComplete="off" maxLength={40} spellCheck={false} placeholder="Enter your 15-digit IMEI" aria-describedby="check-imei-help" value={value} disabled={busy || Boolean(disabledReason)} onChange={event => { setValue(event.currentTarget.value); requestKey.current = ''; setCheck(null); setError('') }} /><p id="check-imei-help" className="field-note">Find it in Settings → General → About, or dial <strong>*#06#</strong>.</p></div>
      {error ? <p role="alert" className="alert alert--error">{error}</p> : null}
      {csrfToken ? <button className="button button--primary button--wide unlock-submit" type="submit" disabled={busy || exhausted || Boolean(check) || Boolean(disabledReason)}><Icon name="search" />{disabledReason ? 'Account not ready' : busy ? 'Checking Apple data…' : exhausted ? 'Daily free limit reached' : 'Run Apple Free Check'}</button> : <Link className="button button--primary button--wide" href="/login?next=%2Fcheck">Sign in for Apple Free Check</Link>}
      <p className="unlock-quote-note">Apple Basic Info · No payment or credit required. Available fields depend on the device data returned.</p>
    </form>
    {exhausted ? <p className="alert" role="status">You have used today’s free checks. <Link href="/services/imei-check">Choose a paid Phone Check</Link> for more reports.</p> : null}
    {check ? <section className="service-workbench-result" aria-live="polite"><div className="service-workbench-result-head"><div><span className="kicker">APPLE FREE CHECK</span><h3 className="t-card">{check.status === 'completed' ? 'Your Apple result' : 'Check status'}</h3></div><span className={check.status === 'completed' ? 'badge badge--success' : 'badge badge--pending'}>{check.status}</span></div>
      <p className="t-small">IMEI {check.imei ?? check.maskedImei}</p>{check.message ? <p role="status">{check.message}</p> : null}
      {check.status === 'completed' && check.result ? <>
        {check.providerCode ? <ProviderOutputText value={check.providerCode} variant="plain" /> : <>
        <p className="field-note">The original provider response is unavailable for this older check. Saved report fields are shown below.</p>
        {check.result.sections.map(section => <section key={section.title}><h4>{section.title}</h4><dl className="service-check-result-list">{section.items.map(item => <div className="service-check-result-row" key={item.key}><dt>{item.label}</dt><dd className={/^clean$/i.test(item.value.trim()) ? 'service-workbench-valid' : undefined}>{item.value}</dd></div>)}</dl></section>)}
        {check.result.checks.length ? <dl className="service-check-result-list">{check.result.checks.map(item => <div className="service-check-result-row" key={item.key}><dt>{item.label}</dt><dd className={item.status === 'passed' ? 'service-workbench-valid' : undefined}>{item.value}</dd></div>)}</dl> : null}
        </>}
        <button className="button button--quiet" type="button" onClick={save}>Save result</button>
      </> : null}
      <div className="service-workbench-result-actions">{!exhausted ? <button className="button button--quiet" type="button" onClick={reset}>Check another Apple device</button> : null}<Link className="button button--primary" href="/services/imei-check">See paid Phone Check services</Link></div>
    </section> : null}
  </>
}
