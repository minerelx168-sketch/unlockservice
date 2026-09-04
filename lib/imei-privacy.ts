import { createHmac } from 'node:crypto'

const DEVELOPMENT_SECRET = 'local-imei-check-fingerprint-v1'

/**
 * Raised when production is asked to fingerprint without a real key.
 *
 * Callers map this to a 503 rather than a validation error: the customer
 * did nothing wrong and retrying with a different IMEI will not help.
 */
export class FingerprintUnavailable extends Error {
  constructor() {
    super('IMEI checks are unavailable until the service is fully configured.')
    this.name = 'FingerprintUnavailable'
  }
}

/**
 * The point of storing a fingerprint rather than the IMEI is that the row
 * cannot be turned back into the number. An HMAC keyed with a constant that
 * ships in the source gives that away: the serial space behind a known TAC
 * is about a million wide, so anyone holding both the database and this
 * file can simply enumerate it. In production the key has to be a real one,
 * and long enough to be worth having.
 */
function secret(): string {
  const configured = process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET?.trim()
  if (configured && configured.length >= 32) return configured
  if (process.env.NODE_ENV === 'production') throw new FingerprintUnavailable()
  return configured || DEVELOPMENT_SECRET
}

/**
 * Produces a stable, non-reversible lookup fingerprint. The raw IMEI must never
 * be persisted by either the free-check or paid-report domain.
 */
export function fingerprintImei(imei: string) {
  return createHmac('sha256', secret()).update(imei).digest('hex')
}
