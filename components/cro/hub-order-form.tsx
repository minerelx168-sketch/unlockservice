'use client'
import { useActionState, useRef, useState } from 'react'
import { continueDeviceServiceAction } from '@/lib/device-intent-actions'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { formatUsd } from '@/lib/money'
import { tacHint } from '@/lib/tac-hints'
import type { GeoLocale } from '@/lib/geo-locales'
import { p2 } from '@/lib/i18n/phase2'
import { msg } from '@/lib/i18n/messages'
import styles from '@/styles/cro.module.css'

export type HubOption = { code: string; name: string; priceCents: number }

function luhn(digits: string): boolean {
  let sum = 0
  for (let index = 0; index < digits.length; index++) {
    let value = Number(digits[digits.length - 1 - index])
    if (index % 2 === 1) { value *= 2; if (value > 9) value -= 9 }
    sum += value
  }
  return sum % 10 === 0
}

/**
 * The above-the-fold check form on the 2026 hubs. Variant B of CRO-02 adds an
 * instant, offline preview once 15 digits pass the Luhn checksum: the device
 * family from a local TAC table and a blurred carrier field. Nothing is looked
 * up and the IMEI never leaves the browser until the visitor continues.
 */
export function HubOrderForm({ locale, options, teaser, initial }: { locale: GeoLocale; options: HubOption[]; teaser: boolean; initial?: string }) {
  const [state, action, pending] = useActionState(continueDeviceServiceAction, {})
  const [imei, setImei] = useState('')
  const [code, setCode] = useState(initial && options.some((option) => option.code === initial) ? initial : options[0]?.code ?? '')
  const shown = useRef(false)
  const digits = imei.replace(/\D/g, '')
  const complete = digits.length === 15
  const valid = complete && luhn(digits)
  const selected = options.find((option) => option.code === code) ?? options[0]
  if (!selected) return <p>{msg(locale, 'Unavailable online')}</p>
  return <form className={styles.form} action={action} aria-busy={pending}>
    <input type="hidden" name="domain" value="imei_check" />
    <input type="hidden" name="locale" value={locale} />
    {options.length > 1 ? <label>{p2(locale, 'Report')}<select name="productCode" value={code} onChange={(event) => setCode(event.currentTarget.value)}>{options.map((option) => <option key={option.code} value={option.code}>{option.name} · {formatUsd(option.priceCents)}</option>)}</select></label> : <input type="hidden" name="productCode" value={selected.code} />}
    <label htmlFor="hub-imei">{p2(locale, '15-digit IMEI')}</label>
    <input id="hub-imei" name="imei" type="text" dir="ltr" inputMode="numeric" autoComplete="off" required maxLength={20} placeholder="35xxxxxxxxxxxxx" value={imei}
      aria-invalid={complete && !valid} aria-describedby="hub-imei-note"
      onChange={(event) => {
        const next = event.currentTarget.value
        setImei(next)
        const raw = next.replace(/\D/g, '')
        if (teaser && raw.length === 15 && luhn(raw) && !shown.current) {
          shown.current = true
          trackFunnelEvent('cro02_teaser_shown', { experiment_id: 'CRO-02', variant: 'B', service_category: 'imei_check' })
        }
      }} />
    <small id="hub-imei-note" aria-live="polite">{complete && !valid ? p2(locale, 'Check the digits: this IMEI fails the checksum.') : msg(locale, 'Dial *#06# or find it in Settings. Check every digit before paying.')}</small>
    {teaser && valid ? <div className={styles.teaser} data-cro="CRO-02" aria-live="polite">
      <dl>
        <dt>✓</dt><dd>{p2(locale, 'IMEI checksum: valid (15 digits verified)')}</dd>
        <dt>{p2(locale, 'Device family')}</dt><dd>{tacHint(digits) ?? p2(locale, 'Apple iOS / GSM device')}</dd>
        <dt>{p2(locale, 'Locked network')}</dt><dd><span className={styles.blur} aria-hidden="true">••••••••••••</span></dd>
      </dl>
      <span className={styles.reveal}>{p2(locale, 'Reveal live carrier status — {price}', { price: formatUsd(selected.priceCents) })}</span>
    </div> : null}
    <label htmlFor="hub-email">{p2(locale, 'Email for your result')}</label>
    <input id="hub-email" name="email" type="email" dir="ltr" autoComplete="email" required maxLength={254} placeholder="you@example.com" />
    <button className="button button--primary" type="submit" disabled={pending || (complete && !valid)}>{pending ? p2(locale, 'Opening…') : `${p2(locale, 'Continue to secure checkout')} · ${formatUsd(selected.priceCents)}`}</button>
    {state.error ? <p role="alert">{locale === 'en' ? state.error : msg(locale, 'Try again')}</p> : null}
  </form>
}
