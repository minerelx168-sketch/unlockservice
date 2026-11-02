'use client'
import { useEffect } from 'react'
import type { ReactNode } from 'react'
import { reportCheckoutReminderOpen } from '@/lib/checkout-reminder-client'

/** Render only alongside an owned, open crypto payment page, never on an amount form. */
export function CheckoutReminderOpen({ kind, reference, csrfToken }: { kind: 'guest' | 'topup'; reference: string; csrfToken?: string }) {
  useEffect(() => {
    const observe = () => {
      if (document.visibilityState === 'visible') reportCheckoutReminderOpen(kind, reference, { csrfToken })
    }
    observe()
    document.addEventListener('visibilitychange', observe)
    return () => document.removeEventListener('visibilitychange', observe)
  }, [kind, reference, csrfToken])
  return null
}

/** Whop timing starts on the navigation attempt, not invoice/status page rendering. */
export function CheckoutReminderLink({ href, reference, csrfToken, children, className }: {
  href: string; reference: string; csrfToken?: string; children: ReactNode; className?: string
}) {
  return <a href={href} rel="noreferrer" className={className}
    onClick={() => reportCheckoutReminderOpen('topup', reference, { csrfToken })}>{children}</a>
}
