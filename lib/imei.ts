/**
 * IMEI helpers.
 *
 * An IMEI is 15 digits whose last digit is a Luhn check digit, so a
 * mistyped number can be caught before it ever reaches a lookup provider.
 * Kept free of DOM and framework imports so the same check runs in the
 * browser field and in any server route that accepts an identifier.
 */

export const IMEI_LENGTH = 15

/** Strips everything that is not a digit and caps the result at 15. */
export function normalizeImei(value: string): string {
  return value.replace(/\D/g, '').slice(0, IMEI_LENGTH)
}

/** Standard Luhn checksum, as used by the IMEI check digit. */
export function luhnValid(digits: string): boolean {
  if (digits.length === 0) return false
  let sum = 0
  let double = false
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let value = digits.charCodeAt(i) - 48
    if (value < 0 || value > 9) return false
    if (double) {
      value *= 2
      if (value > 9) value -= 9
    }
    sum += value
    double = !double
  }
  return sum % 10 === 0
}

/** True only for a full-length IMEI whose check digit agrees. */
export function isValidImei(value: string): boolean {
  const digits = normalizeImei(value)
  return digits.length === IMEI_LENGTH && luhnValid(digits)
}

/** Display grouping: reporting body, then the serial, then the check digit. */
export function groupImei(digits: string): string {
  const groups = [digits.slice(0, 2), digits.slice(2, 8), digits.slice(8, 14), digits.slice(14, 15)]
  return groups.filter(Boolean).join(' ')
}

/**
 * Masks an identifier for display: first two and last four characters,
 * so a report can be read aloud or shared without exposing the number.
 */
export function maskIdentifier(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length <= 6) return trimmed
  return `${trimmed.slice(0, 2)}${'·'.repeat(Math.max(trimmed.length - 6, 1))}${trimmed.slice(-4)}`
}
