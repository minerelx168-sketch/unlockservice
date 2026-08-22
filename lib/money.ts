/**
 * Money is stored as integer US cents everywhere — the observed system
 * prices services from $0.04 to $1.49 and reports every balance at two
 * decimal places, so cents are exact and floats never enter the ledger.
 */

export function toCents(usd: number): number {
  return Math.round(usd * 100)
}

export function formatUsd(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`
}

/** Parses a user-entered amount like "12" or "12.50" into cents. */
export function parseUsd(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(trimmed)) return null
  const [whole, fraction = ''] = trimmed.split('.')
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
}
