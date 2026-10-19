'use client'

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { customerTime, localTodayOrders, validTimeZone, type OrderMinuteCount } from '@/lib/customer-time'

const CustomerTimeZone = createContext<string | null>(null)

export function CustomerTimeProvider({ children }: { children: ReactNode }) {
  // Keep the server and first client render identical. UTC remains readable without JavaScript.
  const [timeZone, setTimeZone] = useState<string | null>(null)
  useEffect(() => {
    const detect = () => {
      try { setTimeZone(validTimeZone(new Intl.DateTimeFormat().resolvedOptions().timeZone)) }
      catch { setTimeZone('UTC') }
    }
    const resume = () => { if (document.visibilityState === 'visible') detect() }
    detect()
    window.addEventListener('focus', detect)
    document.addEventListener('visibilitychange', resume)
    return () => {
      window.removeEventListener('focus', detect)
      document.removeEventListener('visibilitychange', resume)
    }
  }, [])
  return <CustomerTimeZone.Provider value={timeZone}>{children}</CustomerTimeZone.Provider>
}

export function LocalTime({ value, dateOnly = false }: { value: string | null | undefined; dateOnly?: boolean }) {
  const zone = useContext(CustomerTimeZone) ?? 'UTC'
  const formatted = customerTime(value, zone, dateOnly)
  if (!formatted) return <span>—</span>
  return <time className="customer-local-time" dateTime={formatted.iso} title={formatted.title}>{formatted.text}</time>
}

export function CustomerTimeNotice() {
  const zone = useContext(CustomerTimeZone)
  return <p className="customer-time-notice">Time zone: <strong>{zone ?? 'UTC'}</strong>{zone ? ' · Device local time' : ''}</p>
}

export function LocalTodayOrders({ buckets, fallback }: { buckets: OrderMinuteCount[]; fallback: number }) {
  const zone = useContext(CustomerTimeZone)
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => {
    const update = () => setNow(Date.now())
    update()
    const timer = window.setInterval(update, 60_000)
    window.addEventListener('focus', update)
    return () => { clearInterval(timer); window.removeEventListener('focus', update) }
  }, [])
  return <>{zone && now !== null ? localTodayOrders(buckets, zone, now) : fallback}</>
}
