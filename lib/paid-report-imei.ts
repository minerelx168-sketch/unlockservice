import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { normalizeImei } from './imei'

const VERSION = 1
const ALGORITHM = 'aes-256-gcm'
const AAD = Buffer.from('iunlockmobile:paid-report-imei:v1', 'utf8')
const DEVELOPMENT_SECRET = 'local-imei-check-fingerprint-v1'

type EncryptedPaidReportImei = {
  v: 1
  iv: string
  tag: string
  data: string
}

function rootSecret() {
  const configured = process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET?.trim()
  if (configured && configured.length >= 32) return configured
  if (process.env.NODE_ENV === 'production') throw new Error('Paid report IMEI encryption is unavailable.')
  return configured || DEVELOPMENT_SECRET
}

function encryptionKey() {
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(rootSecret(), 'utf8'),
      Buffer.from('iunlockmobile-paid-report-imei-encryption-v1', 'utf8'),
      Buffer.from('aes-256-gcm', 'utf8'),
      32,
    ),
  )
}

export function encryptPaidReportImei(value: string) {
  const imei = normalizeImei(value)
  if (!/^\d{15}$/.test(imei)) throw new Error('A valid 15-digit IMEI is required.')
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  cipher.setAAD(AAD)
  const encrypted = Buffer.concat([cipher.update(imei, 'utf8'), cipher.final()])
  const envelope: EncryptedPaidReportImei = {
    v: VERSION,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: encrypted.toString('base64url'),
  }
  return JSON.stringify(envelope)
}

export function decryptPaidReportImei(value: string | null | undefined) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<EncryptedPaidReportImei>
    if (parsed.v !== VERSION || !parsed.iv || !parsed.tag || !parsed.data) return null
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(parsed.iv, 'base64url'))
    decipher.setAAD(AAD)
    decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'))
    const plain = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    const imei = normalizeImei(plain)
    return /^\d{15}$/.test(imei) ? imei : null
  } catch {
    return null
  }
}
