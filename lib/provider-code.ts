import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes } from 'node:crypto'

const VERSION = 1
const ALGORITHM = 'aes-256-gcm'
const AAD = Buffer.from('iunlockmobile:provider-code:v1', 'utf8')
const DEVELOPMENT_SECRET = 'local-imei-check-fingerprint-v1'
const MAX_CODE_BYTES = 1_000_000

type EncryptedProviderCode = {
  v: 1
  iv: string
  tag: string
  data: string
}

function rootSecret() {
  const configured = process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET?.trim()
  if (configured && configured.length >= 32) return configured
  if (process.env.NODE_ENV === 'production') throw new Error('Provider result encryption is unavailable.')
  return configured || DEVELOPMENT_SECRET
}

function encryptionKey() {
  return Buffer.from(
    hkdfSync(
      'sha256',
      Buffer.from(rootSecret(), 'utf8'),
      Buffer.from('iunlockmobile-provider-code-encryption-v1', 'utf8'),
      Buffer.from('aes-256-gcm', 'utf8'),
      32,
    ),
  )
}

function redactProviderSecrets(value: string) {
  return value
    .replace(/([?&](?:api_?key|apiaccesskey|key|token|secret|authorization)=)[^&\s]*/gi, '$1***')
    .replace(/(bearer\s+)[a-z0-9._~-]+/gi, '$1***')
}

export function normalizeProviderCode(value: string) {
  const normalized = redactProviderSecrets(value)
    .replace(/((?:api(?:access)?key|api[_ -]?key|token|secret|authorization)\s*[:=]\s*)\S+/gi, '$1***')
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .trim()

  if (!normalized) return ''
  const bytes = Buffer.from(normalized, 'utf8')
  if (bytes.length > MAX_CODE_BYTES) throw new Error('Provider result exceeds the storage limit.')
  return normalized
}

export function providerCodeFromData(data: Record<string, unknown>) {
  const lines: string[] = []
  for (const [key, raw] of Object.entries(data)) {
    if (!key.trim()) continue
    if (typeof raw !== 'string' && typeof raw !== 'number' && typeof raw !== 'boolean' && raw !== null) continue
    const value = raw === null ? 'null' : String(raw)
    lines.push(`${key}: ${value}`)
  }
  return normalizeProviderCode(lines.join('\n'))
}

export function providerCodeDigest(value: string) {
  return createHash('sha256').update(value, 'utf8').digest('hex')
}

export function encryptProviderCode(value: string) {
  const normalized = normalizeProviderCode(value)
  if (!normalized) return null
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv)
  cipher.setAAD(AAD)
  const encrypted = Buffer.concat([cipher.update(normalized, 'utf8'), cipher.final()])
  const envelope: EncryptedProviderCode = {
    v: VERSION,
    iv: iv.toString('base64url'),
    tag: cipher.getAuthTag().toString('base64url'),
    data: encrypted.toString('base64url'),
  }
  return JSON.stringify(envelope)
}

export function decryptProviderCode(value: string | null | undefined) {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as Partial<EncryptedProviderCode>
    if (parsed.v !== VERSION || !parsed.iv || !parsed.tag || !parsed.data) return null
    const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(parsed.iv, 'base64url'))
    decipher.setAAD(AAD)
    decipher.setAuthTag(Buffer.from(parsed.tag, 'base64url'))
    const plain = Buffer.concat([
      decipher.update(Buffer.from(parsed.data, 'base64url')),
      decipher.final(),
    ]).toString('utf8')
    return normalizeProviderCode(plain) || null
  } catch {
    return null
  }
}
