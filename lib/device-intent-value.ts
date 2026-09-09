import { luhnValid } from './imei'

export type DeviceDomain = 'imei_check' | 'unlock'
export type DeviceIntent = { imei: string; domain: DeviceDomain; productCode?: string; expiresAt: number }
export const DEVICE_INTENT_TTL_SECONDS = 15 * 60

export function deviceDomain(value: unknown): DeviceDomain | null {
  return value === 'imei_check' || value === 'unlock' ? value : null
}

/** Do not silently truncate a longer identifier or turn serial text into an IMEI. */
export function deviceImei(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 40 || !/^[\d\s-]*$/.test(value)) return null
  const digits = value.replace(/[\s-]/g, '')
  return /^\d{15}$/.test(digits) && luhnValid(digits) ? digits : null
}

export function parseDeviceIntent(raw: string | undefined, now = Date.now()): DeviceIntent | null {
  if (!raw || raw.length > 512) return null
  try {
    const value = JSON.parse(raw)
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const imei = deviceImei(value.imei)
    const domain = deviceDomain(value.domain)
    if (!imei || !domain || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= now ||
      value.expiresAt > now + DEVICE_INTENT_TTL_SECONDS * 1000) return null
    if (value.productCode !== undefined && (typeof value.productCode !== 'string' || !/^[A-Z0-9_]{2,64}$/.test(value.productCode))) return null
    return { imei, domain, productCode: value.productCode, expiresAt: value.expiresAt }
  } catch {
    return null
  }
}

export function intentImeiFor(intent: DeviceIntent | null, domain: DeviceDomain, productCode?: string) {
  return intent?.domain === domain && (!intent.productCode || !productCode || intent.productCode === productCode)
    ? intent.imei : undefined
}
