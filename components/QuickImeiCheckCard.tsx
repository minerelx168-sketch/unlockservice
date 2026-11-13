'use client'
import { useActionState, useRef, useState } from 'react'
import { continueDeviceServiceAction } from '@/lib/device-intent-actions'
import type { GeoLocale } from '@/lib/geo-locales'
import { imeiStatus } from '@/lib/imei'
import { trackFunnelEvent } from '@/lib/funnel-analytics'
import { QUICK_IMEI_COPY } from './quick-imei-copy'
import styles from '@/styles/article-carrier-widget.module.css'

export type Option = { code: string; name: string; domain: string; cents: number }

const price = (cents: number, locale: GeoLocale) => {
  const n = (cents / 100).toFixed(2)
  return locale === 'fr' || locale === 'de' ? `${n.replace('.', ',')} $` : locale === 'pt' ? `US$ ${n.replace('.', ',')}` : `$${n}`
}

/**
 * Above-the-fold carrier check for article pages in every language, bound to
 * Apple Carrier Lite (ID 444). Submitting saves the IMEI as the device intent
 * and goes straight to checkout; AI attribution travels in first-party cookies
 * set by the middleware, so checkout picks it up without extra fields here.
 */
export function QuickImeiCheckCard({ locale, products, imei, heading = false }: { locale: GeoLocale; products: Option[]; imei?: string; heading?: boolean }) {
  const [state, action, pending] = useActionState(continueDeviceServiceAction, {})
  const [value, setValue] = useState(imei ?? '')
  const started = useRef(false)
  const t = QUICK_IMEI_COPY[locale]
  const status = imeiStatus(value)
  if (!products.length) return <p>{t.unavailable}</p>
  const meta = { source: 'article_quick_imei', service_category: 'imei_check', item_id: '444' }
  return <form className={'price-check ' + styles.form} action={action} aria-busy={pending} data-widget="quick-imei-check"
    onSubmit={() => trackFunnelEvent('imei_widget_submit', { ...meta, currency: 'USD', value: products[0].cents / 100, validation_status: status.valid ? 'success' : 'invalid' })}>
    {heading && <><span className="hero-chip">{t.chip} · {price(products[0].cents, locale)}</span><h2>{t.title}</h2></>}
    <p className="t-micro">{t.value}</p>
    <input type="hidden" name="locale" value={locale} /><input type="hidden" name="domain" value={products[0].domain} />
    {products.length > 1
      ? <label className="field">{t.service}<select name="productCode">{products.map(p => <option key={p.code} value={p.code}>{p.name} · {price(p.cents, locale)}</option>)}</select></label>
      : <input type="hidden" name="productCode" value={products[0].code} />}
    <label className="field">{t.imei}
      <input dir="ltr" name="imei" inputMode="numeric" autoComplete="off" maxLength={18} required aria-describedby="quick-imei-status"
        aria-invalid={status.complete && !status.valid} value={value}
        onChange={e => {
          const next = e.currentTarget.value
          setValue(next)
          const s = imeiStatus(next)
          e.currentTarget.setCustomValidity(!next || s.valid ? '' : t.invalid)
          if (s.digits && !started.current) { started.current = true; trackFunnelEvent('imei_input_started', meta) }
        }} />
    </label>
    <small id="quick-imei-status" aria-live="polite" data-valid={status.valid || undefined}
      style={status.valid ? { color: 'var(--success, #15803d)', fontWeight: 600 } : undefined}>
      {!status.digits ? t.hint : status.valid ? t.valid : status.complete ? t.invalid : t.left(15 - status.digits.length)}
    </small>
    <label className="field">{t.email}<input type="email" name="email" dir="ltr" autoComplete="email" maxLength={254} required /></label>
    {state.error && <p role="alert">{locale === 'en' ? state.error : t.error}</p>}
    <button className="button button--primary" type="submit" disabled={pending}>{pending ? t.pending : t.submit}</button>
    <small>{t.after} · {t.fee}</small>
  </form>
}
