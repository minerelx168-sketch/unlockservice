/** Database timestamps without an offset are UTC, never the viewer's local time. */
export function customerTimestamp(value: string | null | undefined): string | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})?$/.exec(value.trim())
  if (!match) return null
  const [, year, month, day, hour, minute, second = '00', fraction = '', offset = 'Z'] = match
  const calendar = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
  if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() !== Number(month) - 1
    || calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) return null
  const normalizedOffset = /^[+-]\d{4}$/.test(offset) ? `${offset.slice(0, 3)}:${offset.slice(3)}` : offset
  const date = new Date(`${year}-${month}-${day}T${hour}:${minute}:${second}${fraction.slice(0, 4)}${normalizedOffset}`)
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

export function validTimeZone(value: string | undefined): string {
  if (!value) return 'UTC'
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone
  } catch {
    return 'UTC'
  }
}

export function customerTime(value: string | null | undefined, timeZone = 'UTC', dateOnly = false) {
  const iso = customerTimestamp(value)
  if (!iso) return null
  const zone = validTimeZone(timeZone)
  const options: Intl.DateTimeFormatOptions = {
    timeZone: zone, calendar: 'gregory', year: 'numeric', month: 'short', day: 'numeric',
    ...(!dateOnly ? { hour: 'numeric' as const, minute: '2-digit' as const, hour12: true, timeZoneName: 'shortOffset' as const } : {}),
  }
  return {
    iso,
    text: new Intl.DateTimeFormat('en-US', options).format(new Date(iso)),
    title: `${zone} · ${iso.replace('T', ' ').replace('.000Z', ' UTC').replace('Z', ' UTC')}`,
  }
}

export type OrderMinuteCount = { at: string; count: number }

/** The server supplies counts for the signed-in account only, never order details. */
export function localTodayOrders(buckets: OrderMinuteCount[], timeZone: string, now: number): number {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: validTimeZone(timeZone), calendar: 'gregory', year: 'numeric', month: 'numeric', day: 'numeric' })
  const today = formatter.format(new Date(now))
  return buckets.reduce((sum, bucket) => {
    const iso = customerTimestamp(bucket.at)
    return iso && formatter.format(new Date(iso)) === today ? sum + bucket.count : sum
  }, 0)
}
