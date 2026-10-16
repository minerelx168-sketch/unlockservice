/**
 * Reading an order number the way customers type it: "#1234", "Order 1234",
 * "1234 ", or the number alone. Anything that is not a positive integer
 * after the noise is removed is rejected — the IMEI, an invoice reference,
 * an email — so the lookup can never be aimed at another record type.
 */
export function parseOrderReference(value: unknown): number | null {
  if (typeof value !== 'string' || value.length > 40) return null
  const digits = value.replace(/^(?:\s*(?:order|ref(?:erence)?|no\.?|number|#))*\s*/i, '').trim()
  if (!/^\d{1,12}$/.test(digits)) return null
  const id = Number(digits)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

/** Only used to prefill the sign-in box; never trusted for anything else. */
export function cleanIdentityHint(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= 120 && !/[\s<>"'\\]/.test(trimmed) ? trimmed : null
}
