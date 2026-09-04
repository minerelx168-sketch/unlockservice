import { db } from './db'

export type ProviderResourceType = 'order' | 'imei_check' | 'paid_imei_report'
export type ProviderEventType =
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'unavailable'
  | 'manual_review'
  | 'poll_error'
  | 'timeout'

export type ProviderEvent = {
  resourceType: ProviderResourceType
  resourceId: number
  provider: string
  providerMode: string
  eventType: ProviderEventType
  idempotencyKey?: string
  statusCode?: number
  durationMs?: number
  errorCode?: string
  metadata?: Record<string, unknown>
}

const BLOCKED_KEY = /(imei|identifier|key|secret|token|authorization|password|url|raw|body|payload)/i

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 2) return undefined
  if (typeof value === 'string') return value.slice(0, 500)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1)).filter((item) => item !== undefined)
  if (value && typeof value === 'object') {
    const clean: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      if (BLOCKED_KEY.test(key)) continue
      const safe = sanitizeValue(item, depth + 1)
      if (safe !== undefined) clean[key] = safe
    }
    return clean
  }
  return undefined
}

function cleanText(value: string | undefined, max: number) {
  if (!value) return null
  return value.replace(/[\r\n\t]/g, ' ').trim().slice(0, max) || null
}

export function recordProviderEvent(event: ProviderEvent) {
  const metadata = sanitizeValue(event.metadata) as Record<string, unknown> | undefined
  const metadataJson = metadata && Object.keys(metadata).length ? JSON.stringify(metadata).slice(0, 4_000) : null
  db()
    .prepare(
      `INSERT OR IGNORE INTO provider_events
         (resource_type, resource_id, provider, provider_mode, event_type,
          idempotency_key, status_code, duration_ms, error_code, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.resourceType,
      event.resourceId,
      cleanText(event.provider, 64) ?? 'unknown',
      cleanText(event.providerMode, 16) ?? 'unknown',
      event.eventType,
      cleanText(event.idempotencyKey, 160),
      event.statusCode ?? null,
      event.durationMs === undefined ? null : Math.max(0, Math.min(Math.trunc(event.durationMs), 300_000)),
      cleanText(event.errorCode, 80),
      metadataJson,
    )
}
