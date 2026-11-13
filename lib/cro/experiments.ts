/**
 * Deterministic A/B bucketing for the CRO-01..05 experiments.
 *
 * Isomorphic and dependency-free: middleware (Edge), server components, route
 * handlers and tests all import it. A visitor is identified only by a random
 * opaque id in the first-party `ium_cro_v1` cookie; the bucket for each
 * experiment is a stable hash of (visitor id, experiment id), so the same
 * visitor sees the same variant on every request and no assignment table is
 * needed. Nothing personal is stored or hashed.
 */
export const CRO_COOKIE = 'ium_cro_v1'
export const CRO_COOKIE_MAX_AGE = 30 * 24 * 60 * 60
/** Request header the middleware uses to hand a freshly minted id to the first render. */
export const CRO_HEADER = 'x-ium-cro'
/** Session cookie naming the AI assistant that referred this session (CRO-03). */
export const AI_REFERRAL_COOKIE = 'ium_ai_ref'
export const AI_HEADER = 'x-ium-ai'

export const EXPERIMENTS = {
  'CRO-01': 'Above-the-fold single-step $1.70 IMEI form on articles',
  'CRO-02': 'Instant $0 TAC model reveal with blurred carrier teaser',
  'CRO-03': 'AI-referral price-clarity micro-banner',
  'CRO-04': 'Mobile four quick-pick service pills',
  'CRO-05': 'Carrier Lite to Carrier Pro one-click order bump',
} as const
export type ExperimentId = keyof typeof EXPERIMENTS
export const EXPERIMENT_IDS = Object.keys(EXPERIMENTS) as ExperimentId[]
export type Variant = 'A' | 'B'
export type Overrides = Partial<Record<ExperimentId, Variant>>

const VISITOR_PATTERN = /^[a-f0-9]{32}$/

export function validVisitorId(value: unknown): string | null {
  return typeof value === 'string' && VISITOR_PATTERN.test(value) ? value : null
}

export function isExperimentId(value: unknown): value is ExperimentId {
  return typeof value === 'string' && Object.hasOwn(EXPERIMENTS, value)
}

/** 32-bit FNV-1a. Stable across runtimes; only used to split traffic. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash >>> 0
}

/** murmur3 fmix32: FNV's low bits only track character parity, so mix before splitting. */
function fmix32(value: number): number {
  let h = value >>> 0
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b) >>> 0
  h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35) >>> 0
  h ^= h >>> 16
  return h >>> 0
}

/** 50% control (A) : 50% variant (B), from the top bit of the mixed hash. */
export function bucket(visitorId: string, experiment: ExperimentId): Variant {
  return fmix32(fnv1a(`${visitorId}:${experiment}`)) >>> 31 === 0 ? 'A' : 'B'
}

/**
 * NEXT_PUBLIC_CRO_OVERRIDES, e.g. {"CRO-01":"variant","CRO-05":"variant"}.
 * "variant"/"B"/"winner" forces B, "control"/"A"/"off" forces A (turning the
 * test off). Anything malformed is ignored so a typo never breaks a page.
 */
export function parseOverrides(raw: string | undefined | null): Overrides {
  if (!raw) return {}
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return {} }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
  const result: Overrides = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!isExperimentId(key) || typeof value !== 'string') continue
    const normalized = value.trim().toLowerCase()
    if (['b', 'variant', 'winner'].includes(normalized)) result[key] = 'B'
    else if (['a', 'control', 'off'].includes(normalized)) result[key] = 'A'
  }
  return result
}

/* Read by computed key: Next inlines `process.env.NEXT_PUBLIC_*` at build
   time, which would make a new winner need a rebuild instead of a restart. */
const OVERRIDES_ENV = ['NEXT_PUBLIC_CRO_OVERRIDES', 'CRO_OVERRIDES']

export function envOverrides(): Overrides {
  for (const key of OVERRIDES_ENV) {
    const raw = process.env[key]
    if (raw) return parseOverrides(raw)
  }
  return {}
}

/** A forced experiment is no longer a test: its exposures are not counted. */
export function isForced(experiment: ExperimentId, overrides: Overrides): boolean {
  return Boolean(overrides[experiment])
}

export function variantFor(visitorId: string | null, experiment: ExperimentId, overrides: Overrides = {}): Variant {
  const forced = overrides[experiment]
  if (forced) return forced
  return visitorId ? bucket(visitorId, experiment) : 'A'
}

export function allVariants(visitorId: string | null, overrides: Overrides = {}): Record<ExperimentId, Variant> {
  return Object.fromEntries(EXPERIMENT_IDS.map((id) => [id, variantFor(visitorId, id, overrides)])) as Record<ExperimentId, Variant>
}

/** "CRO-01:B,CRO-02:A,…" — the string attached to checkout metadata. */
export function variantSummary(variants: Record<ExperimentId, Variant>): string {
  return EXPERIMENT_IDS.map((id) => `${id}:${variants[id]}`).join(',')
}

export function parseVariantSummary(value: unknown): Partial<Record<ExperimentId, Variant>> {
  const result: Partial<Record<ExperimentId, Variant>> = {}
  if (typeof value !== 'string' || value.length > 200) return result
  for (const part of value.split(',')) {
    const [id, variant] = part.split(':')
    if (isExperimentId(id) && (variant === 'A' || variant === 'B')) result[id] = variant
  }
  return result
}

export const ORDER_BUMP_FROM = 'APPLE_CARRIER_LITE'
export const ORDER_BUMP_TO = 'APPLE_CARRIER_PRO'

/**
 * CRO-05. The Lite → Pro swap is honoured only for a visitor in variant B who
 * ticked the box on a Lite order; every other combination keeps the code the
 * buyer chose. The IMEI and email are untouched, so nothing is re-entered.
 */
export function applyOrderBump(productCode: string, accepted: boolean, variant: Variant): { productCode: string; bumped: boolean } {
  if (variant === 'B' && accepted && productCode === ORDER_BUMP_FROM) return { productCode: ORDER_BUMP_TO, bumped: true }
  return { productCode, bumped: false }
}

/** Assistant referrers CRO-03 targets, by referrer host or utm_source. */
const AI_SOURCES: Array<[ai: string, pattern: RegExp]> = [
  ['chatgpt', /(^|\.)(chatgpt\.com|chat\.openai\.com|openai\.com)$|^chatgpt/i],
  ['perplexity', /(^|\.)perplexity\.ai$|^perplexity/i],
  ['claude', /(^|\.)claude\.ai$|^claude/i],
  ['copilot', /(^|\.)(copilot\.microsoft\.com|copilot\.com)$|^copilot/i],
  ['gemini', /(^|\.)gemini\.google\.com$|^gemini/i],
]

export function detectAiReferral(referrer: string | null | undefined, utmSource: string | null | undefined): string | null {
  const candidates: string[] = []
  if (utmSource && utmSource.length <= 64) candidates.push(utmSource.trim())
  if (referrer) {
    try { candidates.push(new URL(referrer).hostname.toLowerCase()) } catch { /* Not a URL. */ }
  }
  for (const candidate of candidates) {
    for (const [ai, pattern] of AI_SOURCES) if (pattern.test(candidate)) return ai
  }
  return null
}

export function validAiReferral(value: unknown): string | null {
  return typeof value === 'string' && AI_SOURCES.some(([ai]) => ai === value) ? value : null
}

/* ---------- Statistics ---------- */

/** Abramowitz–Stegun 7.1.26; |error| < 1.5e-7, ample for a p-value. */
function erf(x: number): number {
  const sign = x < 0 ? -1 : 1
  const ax = Math.abs(x)
  const t = 1 / (1 + 0.3275911 * ax)
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-ax * ax)
  return sign * y
}

export function normalCdf(z: number): number {
  return 0.5 * (1 + erf(z / Math.SQRT2))
}

/**
 * Pooled two-proportion z-test, B minus A. Two-sided p-value.
 * Returns z = 0, p = 1 when either arm is empty or the pooled rate is 0 or 1.
 */
export function twoProportionZTest(successA: number, totalA: number, successB: number, totalB: number): { z: number; p: number } {
  if (totalA <= 0 || totalB <= 0) return { z: 0, p: 1 }
  const pA = successA / totalA, pB = successB / totalB
  const pooled = (successA + successB) / (totalA + totalB)
  const se = Math.sqrt(pooled * (1 - pooled) * (1 / totalA + 1 / totalB))
  if (!Number.isFinite(se) || se === 0) return { z: 0, p: 1 }
  const z = (pB - pA) / se
  const p = Math.min(1, Math.max(0, 2 * (1 - normalCdf(Math.abs(z)))))
  return { z, p }
}

export const MIN_SESSIONS_PER_ARM = 250
export const SIGNIFICANCE = 0.05
export type ExperimentStatus = 'collecting_sample' | 'significant_winner_B' | 'significant_winner_A' | 'inconclusive'

export function experimentStatus(exposuresA: number, exposuresB: number, z: number, p: number): ExperimentStatus {
  if (exposuresA < MIN_SESSIONS_PER_ARM || exposuresB < MIN_SESSIONS_PER_ARM) return 'collecting_sample'
  if (p < SIGNIFICANCE) return z > 0 ? 'significant_winner_B' : 'significant_winner_A'
  return 'inconclusive'
}
