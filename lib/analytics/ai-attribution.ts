/**
 * AI referral attribution.
 *
 * Edge-safe (no Node imports): middleware.ts classifies every document
 * navigation and keeps two first-party cookies for 30 days:
 *   ium_attr_ft — first touch, written once
 *   ium_attr_lt — last non-direct touch, replaced on each non-direct arrival
 *
 * Only a referrer host or an explicit UTM marker may produce a "confirmed" AI
 * source. Organic search, direct and paid traffic are always "non_ai", so they
 * can never inflate the AI referral numbers. The cookies carry a source
 * classification and a landing path only; no identifiers.
 */
export const ATTR_FT_COOKIE = 'ium_attr_ft'
export const ATTR_LT_COOKIE = 'ium_attr_lt'
export const ATTR_MAX_AGE_SECONDS = 30 * 24 * 60 * 60

export const AI_SOURCES = ['chatgpt_search', 'chatgpt_custom_gpt', 'perplexity', 'claude', 'copilot', 'gemini_app', 'other_ai'] as const
export type AiSource = (typeof AI_SOURCES)[number]
export type Confidence = 'confirmed' | 'probable' | 'non_ai'
export type Channel = 'ai' | 'organic_search' | 'paid' | 'referral' | 'direct' | 'internal'

export type Touch = {
  source: AiSource | Channel
  confidence: Confidence
  channel: Channel
  raw_referrer: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  landing_page_path: string
  locale: string
  captured_at: string
}

export type TouchInput = {
  referrer?: string | null
  url: string | URL
  ownHosts?: string[]
  now?: Date
}

const LOCALES = ['es', 'fr-ca', 'pt', 'de', 'ar'] as const
const SAFE = /^[A-Za-z0-9._~:+\-/ ]{1,100}$/

function clean(value: string | null | undefined, max = 100): string | null {
  if (!value) return null
  const v = value.trim().slice(0, max)
  return SAFE.test(v) ? v : null
}
function host(value: string): string | null {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, '') } catch { return null }
}
const is = (h: string, domain: string) => h === domain || h.endsWith('.' + domain)

/** Exact, documented AI referrers and UTM markers. */
function confirmedAi(refHost: string | null, utmSource: string, utmMedium: string): AiSource | null {
  if (utmSource === 'chatgpt_gpt_store' || utmMedium === 'custom_gpt') return 'chatgpt_custom_gpt'
  if (utmSource === 'chatgpt.com' || (refHost && (is(refHost, 'chatgpt.com') || is(refHost, 'chat.openai.com')))) return 'chatgpt_search'
  if (utmSource === 'perplexity.ai' || utmSource === 'perplexity' || (refHost && is(refHost, 'perplexity.ai'))) return 'perplexity'
  if (utmSource === 'claude.ai' || (refHost && is(refHost, 'claude.ai'))) return 'claude'
  if (refHost && (is(refHost, 'copilot.microsoft.com') || is(refHost, 'edgeservices.bing.com'))) return 'copilot'
  if (refHost && is(refHost, 'gemini.google.com')) return 'gemini_app'
  return null
}
/** Weaker signals: an AI-looking UTM or a smaller assistant's referrer. */
function probableAi(refHost: string | null, utmSource: string, rawReferrer: string): AiSource | null {
  if (/chatgpt|openai/.test(utmSource) || rawReferrer.startsWith('android-app://com.openai.chatgpt')) return 'chatgpt_search'
  if (/perplexity/.test(utmSource)) return 'perplexity'
  if (/claude|anthropic/.test(utmSource)) return 'claude'
  if (/copilot/.test(utmSource)) return 'copilot'
  if (/gemini|bard/.test(utmSource)) return 'gemini_app'
  if (refHost && ['you.com', 'phind.com', 'meta.ai', 'chat.deepseek.com', 'poe.com', 'chat.mistral.ai', 'grok.com'].some(d => is(refHost, d))) return 'other_ai'
  return null
}
const SEARCH = ['google.', 'bing.com', 'duckduckgo.com', 'search.yahoo.com', 'yandex.', 'ecosia.org', 'search.brave.com', 'baidu.com', 'naver.com']

export function localeOf(path: string): string {
  const first = path.split('/')[1] ?? ''
  return (LOCALES as readonly string[]).includes(first) ? first : 'en'
}

export function classifyTouch(input: TouchInput): Touch {
  const url = typeof input.url === 'string' ? new URL(input.url) : input.url
  const q = url.searchParams
  const utmSource = (q.get('utm_source') ?? '').trim().toLowerCase()
  const utmMedium = (q.get('utm_medium') ?? '').trim().toLowerCase()
  const rawReferrer = (input.referrer ?? '').trim()
  const refHost = rawReferrer ? host(rawReferrer) : null
  const own = (input.ownHosts ?? ['iunlockmobile.com']).map(h => h.toLowerCase().replace(/^www\./, ''))
  // Referrer is stored without its query string: it can carry search terms or tokens.
  let referrer: string | null = null
  if (refHost) { try { const r = new URL(rawReferrer); referrer = clean(`${r.hostname}${r.pathname}`.slice(0, 160), 160) } catch { referrer = null } }
  else if (rawReferrer.startsWith('android-app://')) referrer = clean(rawReferrer.slice(0, 80), 80)
  const base = {
    raw_referrer: referrer,
    utm_source: clean(q.get('utm_source')), utm_medium: clean(q.get('utm_medium')), utm_campaign: clean(q.get('utm_campaign')),
    landing_page_path: clean(url.pathname, 160) ?? '/', locale: localeOf(url.pathname),
    captured_at: (input.now ?? new Date()).toISOString(),
  }
  const confirmed = confirmedAi(refHost, utmSource, utmMedium)
  if (confirmed) return { ...base, source: confirmed, confidence: 'confirmed', channel: 'ai' }
  const probable = probableAi(refHost, utmSource, rawReferrer)
  if (probable) return { ...base, source: probable, confidence: 'probable', channel: 'ai' }
  let channel: Channel
  if (refHost && own.some(h => is(refHost, h))) channel = 'internal'
  else if (q.has('gclid') || q.has('gbraid') || q.has('wbraid') || q.has('msclkid') || /^(cpc|ppc|paid|paidsearch|display)$/.test(utmMedium)) channel = 'paid'
  else if (utmMedium === 'organic' || (refHost && SEARCH.some(s => refHost.includes(s)))) channel = 'organic_search'
  else if (refHost || utmSource) channel = 'referral'
  else channel = 'direct'
  return { ...base, source: channel, confidence: 'non_ai', channel }
}

const SOURCES = new Set<string>([...AI_SOURCES, 'organic_search', 'paid', 'referral', 'direct', 'internal'])
const CONFIDENCES = new Set(['confirmed', 'probable', 'non_ai'])
const CHANNELS = new Set(['ai', 'organic_search', 'paid', 'referral', 'direct', 'internal'])

function b64encode(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function b64decode(text: string): string {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'))
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)))
}

export function encodeTouch(touch: Touch): string { return b64encode(JSON.stringify(touch)) }

/** Strict parse: anything unexpected is discarded rather than trusted. */
export function decodeTouch(value: string | null | undefined): Touch | null {
  if (!value || value.length > 1500 || !/^[A-Za-z0-9_-]+$/.test(value)) return null
  try {
    const d = JSON.parse(b64decode(value)) as Record<string, unknown>
    if (!d || typeof d !== 'object') return null
    if (!SOURCES.has(String(d.source)) || !CONFIDENCES.has(String(d.confidence)) || !CHANNELS.has(String(d.channel))) return null
    if (typeof d.captured_at !== 'string' || !Number.isFinite(Date.parse(d.captured_at))) return null
    const str = (v: unknown, max = 100) => typeof v === 'string' ? clean(v, max) : null
    return {
      source: d.source as Touch['source'], confidence: d.confidence as Confidence, channel: d.channel as Channel,
      raw_referrer: str(d.raw_referrer, 160), utm_source: str(d.utm_source), utm_medium: str(d.utm_medium), utm_campaign: str(d.utm_campaign),
      landing_page_path: str(d.landing_page_path, 160) ?? '/', locale: typeof d.locale === 'string' && /^(en|es|fr-ca|pt|de|ar)$/.test(d.locale) ? d.locale : 'en',
      captured_at: d.captured_at,
    }
  } catch { return null }
}

/** What the middleware should write for this navigation. */
export function nextTouches(current: { ft: Touch | null; lt: Touch | null }, touch: Touch): { ft: Touch | null; lt: Touch | null } {
  if (touch.channel === 'internal') return { ft: null, lt: null }
  return {
    ft: current.ft ? null : touch,
    lt: touch.channel === 'direct' ? null : touch,
  }
}

/** The single source that reports use: a confirmed or probable AI last touch wins, then first touch. */
export function attributedSource(ft: Touch | null, lt: Touch | null): { source: string; confidence: Confidence } {
  for (const t of [lt, ft]) if (t && t.confidence === 'confirmed') return { source: t.source, confidence: 'confirmed' }
  for (const t of [lt, ft]) if (t && t.confidence === 'probable') return { source: t.source, confidence: 'probable' }
  const t = lt ?? ft
  return { source: t?.source ?? 'direct', confidence: 'non_ai' }
}

/** Whop metadata values must be short strings. Missing values are omitted. */
export function attributionMetadata(ft: Touch | null, lt: Touch | null, extra: { skuId?: string | null; gaClientId?: string | null; gaSessionId?: string | null; internalOrderId?: string | null } = {}): Record<string, string> {
  const { confidence } = attributedSource(ft, lt)
  const landing = lt ?? ft
  const out: Record<string, string | null | undefined> = {
    ai_source_ft: ft?.source ?? 'direct',
    ai_source_lt: lt?.source ?? ft?.source ?? 'direct',
    attribution_confidence: confidence,
    landing_page_path: landing?.landing_page_path,
    locale: landing?.locale,
    sku_id: extra.skuId,
    ga_client_id: extra.gaClientId && /^\d{1,20}\.\d{1,20}$/.test(extra.gaClientId) ? extra.gaClientId : null,
    ga_session_id: extra.gaSessionId && /^\d{1,12}$/.test(extra.gaSessionId) ? extra.gaSessionId : null,
    internal_order_id: extra.internalOrderId,
  }
  return Object.fromEntries(Object.entries(out).filter((e): e is [string, string] => typeof e[1] === 'string' && e[1].length > 0).map(([k, v]) => [k, v.slice(0, 160)]))
}
