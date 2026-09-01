type ProviderState = 'disabled' | 'enabled'
export type ActiveProviderMode = 'sync' | 'dhru'

export type ProviderService = {
  id: string
  mode: ActiveProviderMode
}

export type ProviderTiming = {
  totalMs: number
}

export type ProviderOutcome =
  | {
      status: 'processing'
      providerId: string
      retryAfterMs: number
      timing: ProviderTiming
    }
  | {
      status: 'completed'
      providerId: string | null
      data: Record<string, unknown>
      timing: ProviderTiming
    }
  | {
      status: 'unavailable'
      providerId: string | null
      code: string
      message: string
      retryable: boolean
      timing: ProviderTiming
    }

export type ProviderRequest = {
  imei: string
  service: ProviderService
}

export type ProviderConfiguration = {
  enabled: boolean
  name: string
  mode: ProviderState
  endpoint: string
  username: string
  apiKey: string
  dhruKey: string
  timeoutMs: number
}

const DEFAULT_TIMEOUT_MS = 30_000
const MIN_TIMEOUT_MS = 2_000
const MAX_TIMEOUT_MS = 60_000
const MAX_RESPONSE_BYTES = 1_000_000
const DEFAULT_RETRY_AFTER_MS = 8_000

function boundedInteger(raw: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return fallback
  return Math.max(min, Math.min(max, Math.trunc(parsed)))
}

function cleanProviderName(value: string | undefined) {
  const clean = (value ?? 'dhru').trim().toLowerCase()
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(clean) ? clean : 'dhru'
}

function cleanMode(value: string | undefined): ProviderState {
  const mode = value?.trim().toLowerCase()
  return mode === 'enabled' || mode === 'sync' || mode === 'dhru' ? 'enabled' : 'disabled'
}

function validHttpsEndpoint(value: string | undefined) {
  if (!value?.trim()) return ''
  try {
    const parsed = new URL(value.trim())
    if (parsed.protocol !== 'https:') return ''
    parsed.username = ''
    parsed.password = ''
    parsed.search = ''
    parsed.hash = ''
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return ''
  }
}

export function providerConfiguration(): ProviderConfiguration {
  const mode = cleanMode(process.env.IUNLOCKMOBILE_PROVIDER_MODE)
  const endpoint = validHttpsEndpoint(process.env.IUNLOCKMOBILE_PROVIDER_URL)
  const apiKey = process.env.IUNLOCKMOBILE_PROVIDER_API_KEY?.trim() ?? ''
  const dhruKey = process.env.IUNLOCKMOBILE_PROVIDER_DHRU_KEY?.trim() || apiKey
  const username = process.env.IUNLOCKMOBILE_PROVIDER_USERNAME?.trim() ?? ''
  const credentialsReady = Boolean(apiKey || (username && dhruKey))

  return {
    enabled: mode === 'enabled' && Boolean(endpoint) && credentialsReady,
    name: cleanProviderName(process.env.IUNLOCKMOBILE_PROVIDER_NAME),
    mode,
    endpoint,
    username,
    apiKey,
    dhruKey,
    timeoutMs: boundedInteger(
      process.env.IUNLOCKMOBILE_PROVIDER_TIMEOUT_MS,
      DEFAULT_TIMEOUT_MS,
      MIN_TIMEOUT_MS,
      MAX_TIMEOUT_MS,
    ),
  }
}

function parseServiceMap(raw: string | undefined): Record<string, ProviderService> {
  if (!raw?.trim()) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}

    const result: Record<string, ProviderService> = {}
    for (const [key, value] of Object.entries(parsed)) {
      if (!/^[a-z]+:[a-z0-9_-]{1,64}$/i.test(key)) continue
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue
      const record = value as Record<string, unknown>
      const id = String(record.id ?? '').trim()
      const mode = String(record.mode ?? '').trim().toLowerCase()
      if (!id || id.length > 128 || (mode !== 'sync' && mode !== 'dhru')) continue
      result[key] = { id, mode }
    }
    return result
  } catch {
    return {}
  }
}

export function unlockProviderService(key: string) {
  return parseServiceMap(process.env.IUNLOCKMOBILE_UNLOCK_SERVICE_MAP)[key]
}

export function imeiProviderService(checkType: string) {
  return parseServiceMap(process.env.IUNLOCKMOBILE_IMEI_SERVICE_MAP)[`check:${checkType}`]
}

export function redactProviderText(value: string) {
  return value
    .replace(/([?&](?:api_?key|apiaccesskey|key|token|secret|authorization)=)[^&\s]*/gi, '$1***')
    .replace(/(bearer\s+)[a-z0-9._~-]+/gi, '$1***')
}

function providerFailure(
  startedAt: number,
  code: string,
  message: string,
  retryable: boolean,
  providerId: string | null = null,
): ProviderOutcome {
  return {
    status: 'unavailable',
    providerId,
    code,
    message: redactProviderText(message).slice(0, 500),
    retryable,
    timing: { totalMs: Date.now() - startedAt },
  }
}

function scalarEntries(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean' || item === null) {
      out[key] = item
    }
  }
  return out
}

function extractTextDetails(value: string): Record<string, unknown> {
  const text = value
    .replace(/\\r\\n|\\n|\\r/g, '\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  const details: Record<string, unknown> = {}
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    const separator = line.indexOf(':')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const item = line.slice(separator + 1).trim()
    if (key && item && key.length <= 100 && item.length <= 2_000) details[key] = item
  }
  return details
}

function pluck(node: unknown, keys: string[]) {
  if (!node || typeof node !== 'object') return ''
  const root = node as Record<string, unknown>
  const candidates: unknown[] = [
    Array.isArray(root.SUCCESS) ? root.SUCCESS[0] : undefined,
    Array.isArray(root.ERROR) ? root.ERROR[0] : undefined,
    Array.isArray(root.success) ? root.success[0] : undefined,
    Array.isArray(root.error) ? root.error[0] : undefined,
    root.data,
    root,
  ]
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) continue
    const record = candidate as Record<string, unknown>
    for (const key of keys) {
      const value = record[key]
      if ((typeof value === 'string' || typeof value === 'number') && String(value).trim()) return String(value)
    }
  }
  return ''
}

function firstObjectRecord(value: unknown): Record<string, unknown> {
  if (Array.isArray(value)) {
    const first = value.find((item) => item && typeof item === 'object' && !Array.isArray(item))
    return first ? (first as Record<string, unknown>) : {}
  }
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function normalizedData(decoded: Record<string, unknown>, bodyField: unknown) {
  const details = typeof bodyField === 'string' ? extractTextDetails(bodyField) : scalarEntries(bodyField)
  Object.assign(
    details,
    scalarEntries(firstObjectRecord(decoded.object)),
    scalarEntries(firstObjectRecord(decoded.properties)),
  )
  return details
}

function statusWord(value: unknown) {
  if (typeof value === 'boolean') return value ? 'success' : 'failed'
  return String(value ?? '').trim().toLowerCase()
}

function successStatus(value: string) {
  return ['success', 'successful', 'ok', 'true', 'done', 'complete', 'completed'].includes(value)
}

function failureStatus(value: string) {
  return ['error', 'failed', 'failure', 'false', 'rejected', 'cancelled', 'canceled', 'declined'].includes(value)
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value = JSON.parse(text) as unknown
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

async function requestText(
  url: URL,
  config: ProviderConfiguration,
  request: { method?: 'GET' | 'POST'; body?: URLSearchParams } = {},
) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs)
  const startedAt = Date.now()
  try {
    const response = await fetch(url, {
      method: request.method ?? 'GET',
      body: request.body,
      redirect: 'error',
      signal: controller.signal,
      headers: {
        Accept: 'application/json, text/plain;q=0.9, text/html;q=0.5',
        ...(request.body ? { 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' } : {}),
        'User-Agent': 'iunlockmobile-provider/1.0',
      },
      cache: 'no-store',
    })
    const declaredLength = Number(response.headers.get('content-length') ?? 0)
    if (declaredLength > MAX_RESPONSE_BYTES) {
      return { ok: false as const, code: 'response_too_large', message: 'Provider response is too large.', retryable: false, startedAt }
    }
    const buffer = await response.arrayBuffer()
    if (buffer.byteLength > MAX_RESPONSE_BYTES) {
      return { ok: false as const, code: 'response_too_large', message: 'Provider response is too large.', retryable: false, startedAt }
    }
    const text = new TextDecoder().decode(buffer)
    if (!response.ok) {
      return {
        ok: false as const,
        code: `http_${response.status}`,
        message: response.status >= 500 ? 'The provider is temporarily unavailable.' : 'The provider rejected the request.',
        retryable: response.status === 408 || response.status === 429 || response.status >= 500,
        startedAt,
      }
    }
    return { ok: true as const, text, startedAt }
  } catch (error) {
    return {
      ok: false as const,
      code: error instanceof Error && error.name === 'AbortError' ? 'timeout' : 'network_error',
      message: 'The provider could not be reached.',
      retryable: true,
      startedAt,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function syncRequest(config: ProviderConfiguration, request: ProviderRequest) {
  const url = new URL(config.endpoint)
  if (config.name === 'imei.info' || config.name === 'imeiinfo') {
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${encodeURIComponent(request.service.id)}/${encodeURIComponent(request.imei)}/`
    url.searchParams.set('API_KEY', config.apiKey)
    url.searchParams.set('format', 'json')
    return { url, method: 'GET' as const }
  }
  if (config.name === 'unlock-service' || config.name === 'unlockservice') {
    const body = new URLSearchParams({
      service: request.service.id,
      imei: request.imei,
      key: config.apiKey,
    })
    return { url, method: 'POST' as const, body }
  }
  url.searchParams.set('format', 'beta')
  url.searchParams.set('key', config.apiKey)
  url.searchParams.set('imei', request.imei)
  url.searchParams.set('service', request.service.id)
  return { url, method: 'GET' as const }
}

function dhruUrl(config: ProviderConfiguration, action: 'placeimeiorder' | 'getimeiorder', values: Record<string, string>) {
  const url = new URL(config.endpoint)
  url.searchParams.set('username', config.username)
  url.searchParams.set('apiaccesskey', config.dhruKey)
  url.searchParams.set('action', action)
  for (const [key, value] of Object.entries(values)) url.searchParams.set(key, value)
  return url
}

async function submitSync(config: ProviderConfiguration, request: ProviderRequest): Promise<ProviderOutcome> {
  if (!config.apiKey) return providerFailure(Date.now(), 'provider_disabled', 'The synchronous provider key is not configured.', false)
  const requestDetails = syncRequest(config, request)
  const response = await requestText(requestDetails.url, config, requestDetails)
  if (!response.ok) return providerFailure(response.startedAt, response.code, response.message, response.retryable)

  const decoded = parseJson(response.text)
  if (!decoded) {
    const details = extractTextDetails(response.text)
    if (Object.keys(details).length) {
      return { status: 'completed', providerId: null, data: details, timing: { totalMs: Date.now() - response.startedAt } }
    }
    return providerFailure(response.startedAt, 'invalid_response', 'The provider returned an unreadable response.', false)
  }

  const rawStatus = decoded.status ?? decoded.result ?? decoded.success
  const normalized = statusWord(rawStatus)
  if (successStatus(normalized)) {
    const bodyField = decoded.response ?? decoded.result ?? decoded.data ?? decoded.object ?? {}
    return {
      status: 'completed',
      providerId: pluck(decoded, ['REFERENCEID', 'referenceid', 'reference_id', 'orderid', 'OrderID', 'id']) || null,
      data: normalizedData(decoded, bodyField),
      timing: { totalMs: Date.now() - response.startedAt },
    }
  }

  const message =
    pluck(decoded, ['FULL_DESCRIPTION', 'MESSAGE', 'message', 'description', 'error', 'response']) ||
    'The provider rejected the request.'
  return providerFailure(response.startedAt, 'provider_rejected', message, !failureStatus(normalized))
}

async function placeDhru(config: ProviderConfiguration, request: ProviderRequest): Promise<ProviderOutcome> {
  if (!config.username || !config.dhruKey) {
    return providerFailure(Date.now(), 'provider_disabled', 'The DHRU provider credentials are not configured.', false)
  }
  const response = await requestText(
    dhruUrl(config, 'placeimeiorder', { service: request.service.id, imei: request.imei }),
    config,
  )
  if (!response.ok) return providerFailure(response.startedAt, response.code, response.message, response.retryable)

  const decoded = parseJson(response.text)
  const providerId = pluck(decoded, ['REFERENCEID', 'referenceid', 'reference_id', 'orderid', 'OrderID', 'id'])
  if (providerId) {
    return {
      status: 'processing',
      providerId,
      retryAfterMs: DEFAULT_RETRY_AFTER_MS,
      timing: { totalMs: Date.now() - response.startedAt },
    }
  }
  const message = pluck(decoded, ['FULL_DESCRIPTION', 'MESSAGE', 'message', 'description', 'error']) || 'The provider rejected the order.'
  return providerFailure(response.startedAt, 'provider_rejected', message, false)
}

export async function submitProviderRequest(request: ProviderRequest): Promise<ProviderOutcome> {
  const config = providerConfiguration()
  if (!config.enabled) return providerFailure(Date.now(), 'provider_disabled', 'The provider is not configured.', false)
  if (request.service.mode === 'dhru') return placeDhru(config, request)
  return submitSync(config, request)
}

export async function pollProviderRequest(providerId: string): Promise<ProviderOutcome> {
  const config = providerConfiguration()
  const startedAt = Date.now()
  if (!config.enabled || !config.username || !config.dhruKey) {
    return providerFailure(startedAt, 'provider_disabled', 'The asynchronous provider is not configured.', false, providerId)
  }
  if (!providerId.trim()) return providerFailure(startedAt, 'provider_id_missing', 'The provider reference is missing.', false)

  const response = await requestText(dhruUrl(config, 'getimeiorder', { id: providerId }), config)
  if (!response.ok) {
    if (response.retryable) {
      return {
        status: 'processing',
        providerId,
        retryAfterMs: DEFAULT_RETRY_AFTER_MS,
        timing: { totalMs: Date.now() - response.startedAt },
      }
    }
    return providerFailure(response.startedAt, response.code, response.message, false, providerId)
  }

  const decoded = parseJson(response.text)
  const normalized = statusWord(pluck(decoded, ['STATUS', 'status']))
  const reply = pluck(decoded, ['REPLY', 'reply', 'response', 'output'])
  if (successStatus(normalized)) {
    return {
      status: 'completed',
      providerId,
      data: {
        ...extractTextDetails(reply),
        ...scalarEntries(decoded?.data),
      },
      timing: { totalMs: Date.now() - response.startedAt },
    }
  }
  if (failureStatus(normalized)) {
    const message = pluck(decoded, ['FULL_DESCRIPTION', 'MESSAGE', 'message', 'description']) || reply || 'The provider rejected the order.'
    return providerFailure(response.startedAt, 'provider_rejected', message, false, providerId)
  }
  return {
    status: 'processing',
    providerId,
    retryAfterMs: DEFAULT_RETRY_AFTER_MS,
    timing: { totalMs: Date.now() - response.startedAt },
  }
}
