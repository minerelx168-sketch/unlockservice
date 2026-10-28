export const ATTRIBUTION_MAX_AGE_SECONDS = 90 * 24 * 60 * 60
export const PENDING_ATTRIBUTION_MAX_AGE_SECONDS = 60 * 60
export const CLICK_ID_FIELDS = ['gclid', 'gbraid', 'wbraid'] as const
export type ClickIdField = (typeof CLICK_ID_FIELDS)[number]
export type AttributionSnapshot = Partial<Record<ClickIdField, string>> & { consent: 'granted' }
const CLICK_ID_PATTERN = /^[A-Za-z0-9._~-]{1,128}$/

export function validateClickId(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length === 0 || value.length > 128) return undefined
  return CLICK_ID_PATTERN.test(value) ? value : undefined
}

export function parsePendingAttribution(value: unknown): Partial<Record<ClickIdField, string>> | null {
  if (typeof value !== 'string' || value.length > 512) return null
  const params = new URLSearchParams(value)
  const result: Partial<Record<ClickIdField, string>> = {}
  for (const field of CLICK_ID_FIELDS) {
    const valid = validateClickId(params.get(field) ?? undefined)
    if (valid) result[field] = valid
  }
  return Object.keys(result).length ? result : null
}

export function encodePendingAttribution(input: Partial<Record<ClickIdField, unknown>>): string | null {
  const params = new URLSearchParams()
  for (const field of CLICK_ID_FIELDS) {
    const valid = validateClickId(input[field])
    if (valid) params.set(field, valid)
  }
  return params.toString() || null
}
