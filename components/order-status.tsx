/** State reads as shape and colour together, so a list scans at a glance. */
export function OrderStatusBadge({ status }: { status: 'processing' | 'delivered' | 'unavailable' }) {
  const map = {
    delivered: { className: 'badge badge--success', label: 'Unlocked' },
    processing: { className: 'badge badge--pending', label: 'With the carrier' },
    unavailable: { className: 'badge badge--error', label: 'Refunded' },
  } as const
  return <span className={map[status].className}>{map[status].label}</span>
}

/** "24 hours" reads better than "24" and matches how the quote is given. */
export function formatEta(hours: number): string {
  if (hours <= 1) return 'about an hour'
  if (hours < 24) return `up to ${hours} hours`
  const days = Math.round(hours / 24)
  return days === 1 ? 'up to 24 hours' : `up to ${days} days`
}
