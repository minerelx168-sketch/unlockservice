'use client'

/** Best-effort observation only: payment navigation never depends on it. */
export function reportCheckoutReminderOpen(kind: 'guest' | 'topup', reference: string, options: { csrfToken?: string; key?: string } = {}) {
  if (!/^[a-f0-9]{32}$/.test(reference)) return
  void fetch('/api/checkout/reminders/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, reference, ...(options.csrfToken ? { csrfToken: options.csrfToken } : {}), ...(options.key ? { key: options.key } : {}) }),
    keepalive: true,
    credentials: 'same-origin',
  }).catch(() => undefined)
}
