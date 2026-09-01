import { createHmac } from 'node:crypto'

/**
 * Produces a stable, non-reversible lookup fingerprint. The raw IMEI must never
 * be persisted by either the free-check or paid-report domain.
 */
export function fingerprintImei(imei: string) {
  const secret = process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET ?? 'local-imei-check-fingerprint-v1'
  return createHmac('sha256', secret).update(imei).digest('hex')
}
