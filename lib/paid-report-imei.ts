import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto'
import { serviceIdentifier, serviceInputType, type ServiceInputType } from './service-identifier'

const VERSION = 1
const ALGORITHM = 'aes-256-gcm'
const AAD = Buffer.from('iunlockmobile:paid-report-imei:v1', 'utf8')
const DEVELOPMENT_SECRET = 'local-imei-check-fingerprint-v1'

type EncryptedPaidReportImei = {
  v: 1 | 2
  type?: ServiceInputType
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

export function encryptPaidReportImei(value: string, type: ServiceInputType = 'imei') {
  const imei = serviceIdentifier(value, type)
  if (!imei) throw new Error(type === 'imei' ? 'A valid 15-digit IMEI is required.' : 'A valid service identifier is required.')
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  cipher.setAAD(type === 'imei' ? AAD : Buffer.from(`iunlockmobile:paid-report-identifier:v2:${type}`))
  const encrypted = Buffer.concat([cipher.update(imei, 'utf8'), cipher.final()])
  const envelope: EncryptedPaidReportImei = {
    v: type === 'imei' ? VERSION : 2,
    ...(type === 'imei' ? {} : { type }),
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
    if ((parsed.v !== VERSION && parsed.v !== 2) || !parsed.iv || !parsed.tag || !parsed.data) return null
    const type = parsed.v === VERSION ? 'imei' : serviceInputType(parsed.type)
    if (!type) return null
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(parsed.iv, 'base64url'))
    decipher.setAAD(type === 'imei' ? AAD : Buffer.from(`iunlockmobile:paid-report-identifier:v2:${type}`))
    decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'))
    const plain = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    return parsed.v === VERSION ? (/^\d{15}$/.test(plain) ? plain : null) : serviceIdentifier(plain, type)
  } catch {
    return null
  }
}

