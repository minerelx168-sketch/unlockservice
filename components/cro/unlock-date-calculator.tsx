'use client'
import { useId, useState } from 'react'
import { cricketEligibility, verizonEligibility, tmobileEligibility, parseDate, type Eligibility } from '@/lib/unlock-policy-2026'
import type { GeoLocale } from '@/lib/geo-locales'
import { markets, locales } from '@/lib/geo-locales'
import { p2 } from '@/lib/i18n/phase2'
import styles from '@/styles/cro.module.css'

export type CalculatorCarrier = 'cricket' | 'verizon' | 'tmobile'

const plans: Record<CalculatorCarrier, string[]> = { cricket: [], verizon: ['prepaid', 'straight-talk', 'postpaid'], tmobile: ['postpaid', 'prepaid', 'metro'] }

/** $0, offline: date arithmetic over the published waiting periods only. */
export function UnlockDateCalculator({ locale, carrier }: { locale: GeoLocale; carrier: CalculatorCarrier }) {
  const id = useId()
  const [date, setDate] = useState('')
  const [plan, setPlan] = useState(plans[carrier][0] ?? '')
  const today = new Date().toISOString().slice(0, 10)
  let result: Eligibility | null = null
  if (parseDate(date) && date <= today) {
    result = carrier === 'cricket' ? cricketEligibility(date, today)
      : carrier === 'verizon' ? verizonEligibility(date, plan as 'prepaid' | 'straight-talk' | 'postpaid', today)
      : tmobileEligibility(date, plan as 'postpaid' | 'prepaid' | 'metro', today)
  }
  const tag = markets[locales.indexOf(locale)] ?? 'en-US'
  const readable = (value: string) => new Intl.DateTimeFormat(tag, { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
  const label = (value: string) => value === 'straight-talk' ? 'Straight Talk / TracFone' : value === 'prepaid' ? (carrier === 'verizon' ? 'Verizon · ' : '') + p2(locale, 'Prepaid') : value === 'postpaid' ? p2(locale, 'Postpaid') : p2(locale, 'Metro by T-Mobile')
  return <div className={styles.calc}>
    <label htmlFor={id + 'date'}>{p2(locale, 'Purchase or activation date')}</label>
    <input id={id + 'date'} type="date" max={today} value={date} onChange={(event) => setDate(event.currentTarget.value)} />
    {plans[carrier].length ? <fieldset><legend>{p2(locale, 'Plan type')}</legend>{plans[carrier].map((value) => <label key={value}><input type="radio" name={id + 'plan'} value={value} checked={plan === value} onChange={() => setPlan(value)} /> {label(value)}</label>)}</fieldset> : null}
    <div className={styles.calcResult} aria-live="polite">
      {!result ? <p>{p2(locale, 'Choose a date to see the rule that applies.')}</p> : <>
        <p><strong>{result.waitDays === null ? p2(locale, 'Rule: released once the device is paid in full (no fixed waiting period).')
          : result.rule === 'cricket_six_months' ? p2(locale, 'Rule: six months of paid service.')
          : p2(locale, 'Rule: {days} days of paid, active service.', { days: result.waitDays })}</strong></p>
        {result.eligibleOn ? <p>{p2(locale, 'Waiting period ends on {date}.', { date: readable(result.eligibleOn) })}</p> : null}
        {result.timeRequirementMet === true ? <p>{p2(locale, 'The waiting period has passed. Request the unlock from the carrier.')}</p>
          : result.daysRemaining !== null ? <p>{p2(locale, '{days} days remaining.', { days: result.daysRemaining })}</p> : null}
      </>}
      <p><small>{p2(locale, 'Free and offline. It checks the waiting period only; the carrier also checks payment, account standing and fraud flags.')}</small></p>
    </div>
  </div>
}
