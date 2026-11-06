import { db } from './db'
import { fingerprintImei } from './imei-privacy'
import { decryptProviderCode } from './provider-code'
import type { ProviderReport, ReportCheck, ReportItem } from './imei-report'
import { providerProductByCode } from './provider-products'
import { UNKNOWN_PLAN_MESSAGE, UNSUPPORTED_CARRIER_MESSAGE } from './unlock-policy'

type UnlockPolicyCarrier = 'att' | 'cspire'
type UnlockEligibilityStatus = 'not_applicable' | 'unknown' | 'supported' | 'unsupported'
type PlanType = 'postpaid' | 'contract' | 'prepaid' | 'mvno' | 'unknown'
type EvidenceLine = { key: string; value: string }

type UnlockEligibility = {
  status: UnlockEligibilityStatus
  blocksCheckout: boolean
  message?: string
  trustedCheckId?: number
  carrier?: UnlockPolicyCarrier
  planType?: PlanType
  hasTrustedResult: boolean
}

export type { UnlockEligibility }

type TrustedCarrierCheck = {
  id: number
  productCode: string
  report: ProviderReport | null
  providerCode: string | null
  observedAt: string
  source: 'paid' | 'cached'
}

const TRUSTED_CARRIER_CHECK = /^(APPLE_CARRIER_(LITE|PRO|PRO_PLUS)|APPLE_MAX_INFO)$/
const TRUSTED_CARRIER_PRODUCTS = "'APPLE_CARRIER_LITE', 'APPLE_CARRIER_PRO', 'APPLE_CARRIER_PRO_PLUS', 'APPLE_MAX_INFO'"
const UNSUPPORTED_CARRIER_NAMES = [
  'cricket',
  'metro',
  'metro pcs',
  'boost',
  'boost mobile',
  'straight talk',
  'tracfone',
  'visible',
  'mint mobile',
  'google fi',
  'us mobile',
  'consumer cellular',
  'total wireless',
  'simple mobile',
  'net10',
  'ultra mobile',
  'ting mobile',
  'republic wireless',
  'h2o wireless',
  'roam mobility',
]
const CARRIER_KEY = /^(?:carrier|carrier \/ network|carrier network|carrier name|network|network name|network operator|operator|provider)$/i
const PLAN_KEY = /^(?:plan|plan type|plan name|service plan|service type|rate plan|account plan|account type|account status|billing type|subscriber type|line type|tariff|contract|contract type|contract status|subscription|subscription type|mvno|prepaid|prepaid status|postpaid|postpaid status)$/i
const PREPAID_TERM = /\b(?:prepaid|pay[ -]?as[ -]?you[ -]?go|paygo)\b/i
const MVNO_TERM = /\b(?:mvno|mobile virtual network operator)\b/i
const POSTPAID_TERM = /\b(?:postpaid|post-paid)\b/i
const CONTRACT_TERM = /\bcontract(?:ual)?\b/i

function cleanText(value: unknown) {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') return ''
  return String(value).replace(/\r\n?/g, '\n').split('\n').map((line) => line.trim()).filter(Boolean).join('\n')
}

function canonicalKey(value: unknown) {
  const text = typeof value === 'string' ? value.trim() : ''
  // HTML is never a valid evidence label. In particular, do not let a styled
  // label such as <b>Carrier</b> turn an arbitrary value into carrier proof.
  if (!text || /[<>]/.test(text)) return ''
  return text.toLowerCase().replace(/[_-]+/g, ' ').replace(/\s*\/\s*/g, ' / ').replace(/\s+/g, ' ').trim()
}

function evidenceValue(value: unknown) {
  const text = cleanText(value)
  return text && !/[<>]/.test(text) ? text : ''
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function reportItem(value: unknown): ReportItem | null {
  const item = record(value)
  if (!item) return null
  if (typeof item.label === 'string' && /[<>]/.test(item.label)) return null
  const key = canonicalKey(item.key)
  const label = typeof item.label === 'string' ? item.label.trim() : ''
  const text = evidenceValue(item.value)
  if (!text || (!key && !label)) return null
  return { key, label: label || key, value: text }
}

function reportCheck(value: unknown): ReportCheck | null {
  const check = record(value)
  if (!check) return null
  if (typeof check.label === 'string' && /[<>]/.test(check.label)) return null
  const key = canonicalKey(check.key)
  const label = typeof check.label === 'string' ? check.label.trim() : ''
  const text = evidenceValue(check.value)
  const status = check.status === 'passed' || check.status === 'attention' || check.status === 'info' ? check.status : 'info'
  if (!text || (!key && !label)) return null
  return { key, label: label || key, value: text, status }
}

function normalizedReport(value: unknown): ProviderReport | null {
  const source = record(value)
  if (!source) return null
  const rawSections = Array.isArray(source.sections) ? source.sections : []
  const sections = rawSections.flatMap((sectionValue) => {
    const section = record(sectionValue)
    if (!section || !Array.isArray(section.items)) return []
    const items = section.items.map(reportItem).filter((item): item is ReportItem => item !== null)
    return items.length ? [{ title: cleanText(section.title) || 'Provider result', items }] : []
  })
  const checks = (Array.isArray(source.checks) ? source.checks : [])
    .map(reportCheck).filter((check): check is ReportCheck => check !== null)
  if (!sections.length && !checks.length) return null
  return {
    schemaVersion: 1,
    checkType: cleanText(source.checkType),
    source: cleanText(source.source),
    title: cleanText(source.title),
    summary: cleanText(source.summary),
    sections,
    checks,
    nextStep: cleanText(source.nextStep),
  }
}

/** Stored rows are normally one normalized report, but older cache rows may
 * wrap that report in an array. Accept only report-shaped objects or a simple
 * array of normalized rows; never treat arbitrary provider JSON as evidence. */
function parseReport(value: string | null): ProviderReport | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    const direct = normalizedReport(parsed)
    if (direct) return direct
    if (Array.isArray(parsed)) {
      for (const candidate of parsed) {
        const nested = normalizedReport(candidate)
        if (nested) return nested
      }
      const rows = parsed.map(reportItem).filter((item): item is ReportItem => item !== null)
      if (rows.length) return normalizedReport({ sections: [{ title: 'Provider result', items: rows }], checks: [] })
    }
    const object = record(parsed)
    for (const nestedValue of [object?.report, object?.result, object?.data]) {
      const nested = normalizedReport(nestedValue)
      if (nested) return nested
      if (Array.isArray(nestedValue)) {
        for (const candidate of nestedValue) {
          const candidateReport = normalizedReport(candidate)
          if (candidateReport) return candidateReport
        }
      }
    }
    return null
  } catch {
    return null
  }
}

function reportLines(report: ProviderReport | null): EvidenceLine[] {
  if (!report) return []
  const lines: EvidenceLine[] = []
  for (const section of Array.isArray(report.sections) ? report.sections : []) {
    for (const item of Array.isArray(section?.items) ? section.items : []) {
      if (/[<>]/.test(item?.key ?? '') || /[<>]/.test(item?.label ?? '')) continue
      const key = canonicalKey(item?.key) || canonicalKey(item?.label)
      const value = evidenceValue(item?.value)
      if (key && value) lines.push({ key, value })
    }
  }
  for (const check of Array.isArray(report.checks) ? report.checks : []) {
    if (/[<>]/.test(check?.key ?? '') || /[<>]/.test(check?.label ?? '')) continue
    const key = canonicalKey(check?.key) || canonicalKey(check?.label)
    const value = evidenceValue(check?.value)
    if (key && value) lines.push({ key, value })
  }
  return lines
}

function keyedLines(value: string) {
  return value.split(/\r?\n/).map((line) => {
    const separator = line.indexOf(':')
    if (separator < 1) return { key: '', value: evidenceValue(line) }
    return { key: canonicalKey(line.slice(0, separator)), value: evidenceValue(line.slice(separator + 1)) }
  }).filter((line) => line.value)
}

function carrierFromProduct(productCode: string): UnlockPolicyCarrier | null {
  const product = providerProductByCode(productCode)
  if (!product || product.domain !== 'unlock' || product.group !== 'USA Networks') return null
  const name = product.name.toLowerCase()
  if (/c\s*spire/.test(name)) return 'cspire'
  if (/at\s*&\s*t|at\s+and\s+t/.test(name)) return 'att'
  return null
}

function escaped(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function containsCarrier(text: string, name: string) {
  const words = escaped(name).replace(/\\ /g, '[ -]?')
  return new RegExp(`\\b${words}\\b`, 'i').test(text)
}

function carrierFromLines(lines: EvidenceLine[]): UnlockPolicyCarrier | 'unsupported' | null {
  const carrierLines = lines.filter(({ key }) => CARRIER_KEY.test(key))
  const text = carrierLines.map(({ value }) => value).join(' ').toLowerCase()
  if (!text) return null
  if (UNSUPPORTED_CARRIER_NAMES.some((name) => containsCarrier(text, name))) return 'unsupported'
  const carriers = new Set<UnlockPolicyCarrier>()
  if (/\bat\s*&\s*t\b|\bat\s+and\s+t\b/i.test(text)) carriers.add('att')
  if (/\bc\s*spire\b/i.test(text)) carriers.add('cspire')
  return carriers.size === 1 ? [...carriers][0] : null
}

function negativeFor(value: string, term: RegExp) {
  if (!term.test(value)) return true
  const escapedTerm = term.source.replace(/^\\b|\\b$/g, '')
  return new RegExp(`(?:not|no|without|non[- ]?|false)\\s*(?:${escapedTerm})`, 'i').test(value)
}

function planFromLines(lines: EvidenceLine[]): PlanType {
  const planLines = lines.filter(({ key, value }) => PLAN_KEY.test(key)
    || CARRIER_KEY.test(key) && (PREPAID_TERM.test(value) || MVNO_TERM.test(value) || POSTPAID_TERM.test(value) || CONTRACT_TERM.test(value)))
  let hasPrepaid = false
  let hasMvno = false
  let hasPostpaid = false
  let hasContract = false
  for (const { key, value } of planLines) {
    const text = `${key}: ${value}`
    const normalizedValue = value.trim()
    const keyNegative = /^(?:prepaid|mvno|postpaid|contract|contract type|contract status)$/i.test(key)
      && /^(?:no|false|0|none|not applicable)$/i.test(value.trim())
    const positiveKey = /^(?:prepaid|mvno|postpaid|contract|contract type|contract status)$/i.test(key)
      && /^(?:yes|true|1|active)$/i.test(normalizedValue)
    if (!keyNegative && (positiveKey && /^prepaid$/i.test(key) || PREPAID_TERM.test(value)) && !negativeFor(text, PREPAID_TERM)) hasPrepaid = true
    if (!keyNegative && (positiveKey && /^mvno$/i.test(key) || MVNO_TERM.test(value)) && !negativeFor(text, MVNO_TERM)) hasMvno = true
    if (!keyNegative && (positiveKey && /^postpaid$/i.test(key) || POSTPAID_TERM.test(value)) && !negativeFor(text, POSTPAID_TERM)) hasPostpaid = true
    if (!keyNegative && (positiveKey && /^(?:contract|contract type|contract status)$/i.test(key) || CONTRACT_TERM.test(value)) && !negativeFor(text, CONTRACT_TERM)) hasContract = true
  }
  if (hasMvno) return 'mvno'
  if (hasPrepaid) return 'prepaid'
  if (hasPostpaid && !hasContract) return 'postpaid'
  if (hasContract && !hasPostpaid) return 'contract'
  return 'unknown'
}

function unsupported(message = UNSUPPORTED_CARRIER_MESSAGE, trustedCheckId?: number, carrier?: UnlockPolicyCarrier, planType?: PlanType): UnlockEligibility {
  return { status: 'unsupported', blocksCheckout: true, message, trustedCheckId, carrier, planType, hasTrustedResult: true }
}

function uncertain(trustedCheckId: number, carrier?: UnlockPolicyCarrier, planType: PlanType = 'unknown'): UnlockEligibility {
  return {
    status: 'unknown',
    blocksCheckout: true,
    message: UNKNOWN_PLAN_MESSAGE,
    trustedCheckId,
    carrier,
    planType,
    hasTrustedResult: true,
  }
}

export function isTrustedCarrierCheckProduct(productCode: string) {
  return TRUSTED_CARRIER_CHECK.test(productCode.trim().toUpperCase())
}

export function isUsCarrierUnlockProduct(productCode: string) {
  return carrierFromProduct(productCode.trim().toUpperCase()) !== null
}

/**
 * Classify only explicit provider-carrier and provider-plan evidence. A carrier
 * name alone never proves postpaid eligibility, and an IMEI prefix is never
 * consulted. This pure function is also used by focused synthetic-ID tests.
 */
export function classifyUnlockEligibility(input: {
  productCode: string
  report?: ProviderReport | null
  providerCode?: string | null
  trustedCheckId?: number
}): UnlockEligibility {
  const productCarrier = carrierFromProduct(input.productCode.trim().toUpperCase())
  if (!productCarrier) return { status: 'not_applicable', blocksCheckout: false, hasTrustedResult: false }

  const lines = [...reportLines(input.report ?? null), ...keyedLines(cleanText(input.providerCode))]
  if (!lines.length) return uncertain(input.trustedCheckId ?? 0)
  const carrier = carrierFromLines(lines)
  const planType = planFromLines(lines)

  if (planType === 'prepaid' || planType === 'mvno' || carrier === 'unsupported') {
    const identifiedCarrier = carrier === 'att' || carrier === 'cspire' ? carrier : undefined
    return unsupported(UNSUPPORTED_CARRIER_MESSAGE, input.trustedCheckId, identifiedCarrier, planType)
  }
  if (carrier !== productCarrier) return unsupported(UNSUPPORTED_CARRIER_MESSAGE, input.trustedCheckId, carrier ?? undefined, planType)
  if (planType === 'postpaid' || planType === 'contract') {
    return { status: 'supported', blocksCheckout: false, trustedCheckId: input.trustedCheckId, carrier, planType, hasTrustedResult: true }
  }
  return uncertain(input.trustedCheckId ?? 0, carrier, planType)
}

function sqliteTimestamp(value: string) {
  const normalized = value.includes('T') || /z$/i.test(value) ? value : `${value.replace(' ', 'T')}Z`
  return Date.parse(normalized)
}

function newer(a: TrustedCarrierCheck, b: TrustedCarrierCheck) {
  const at = sqliteTimestamp(a.observedAt)
  const bt = sqliteTimestamp(b.observedAt)
  if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt) return at > bt ? a : b
  if (Number.isFinite(at) !== Number.isFinite(bt)) return Number.isFinite(at) ? a : b
  // IDs are only a same-table tie breaker. Never use IDs to compare the two
  // independent SQLite tables because they have independent sequences.
  if (a.source === b.source) return a.id >= b.id ? a : b
  return a.source === 'paid' ? a : b
}

function latestTrustedCarrierCheck(userId: number, imei: string): TrustedCarrierCheck | undefined {
  let fingerprint: string
  try {
    fingerprint = fingerprintImei(imei)
  } catch {
    return undefined
  }
  const paidRow = db().prepare(`
    SELECT id, product_code, report_json, provider_code_encrypted,
           COALESCE(completed_at, updated_at, created_at) AS observed_at
      FROM paid_report_orders
     WHERE user_id = ? AND imei_fingerprint = ? AND status = 'completed'
       AND product_code IN (${TRUSTED_CARRIER_PRODUCTS})
     ORDER BY COALESCE(completed_at, updated_at, created_at) DESC, id DESC
     LIMIT 1
  `).get(userId, fingerprint) as {
    id: number
    product_code: string
    report_json: string | null
    provider_code_encrypted: string | null
    observed_at: string
  } | undefined
  const checkRow = db().prepare(`
    SELECT id, check_type, result_json, updated_at AS observed_at
      FROM imei_checks
     WHERE user_id = ? AND imei_fingerprint = ? AND status = 'completed'
       AND upper(check_type) IN (${TRUSTED_CARRIER_PRODUCTS})
     ORDER BY updated_at DESC, id DESC
     LIMIT 1
  `).get(userId, fingerprint) as {
    id: number
    check_type: string
    result_json: string | null
    observed_at: string
  } | undefined
  const paid = paidRow && isTrustedCarrierCheckProduct(paidRow.product_code)
    ? {
        id: paidRow.id,
        productCode: paidRow.product_code,
        report: parseReport(paidRow.report_json),
        providerCode: decryptProviderCode(paidRow.provider_code_encrypted),
        observedAt: paidRow.observed_at,
        source: 'paid' as const,
      }
    : undefined
  const cached = checkRow && isTrustedCarrierCheckProduct(checkRow.check_type)
    ? (() => {
        const parsed = parseCarrierCheckResult(checkRow.result_json)
        return { id: checkRow.id, productCode: checkRow.check_type.toUpperCase(), ...parsed, observedAt: checkRow.observed_at, source: 'cached' as const }
      })()
    : undefined
  if (!paid && !cached) return undefined
  if (!paid) return cached
  if (!cached) return paid
  return newer(paid, cached)
}

function parseCarrierCheckResult(value: string | null) {
  if (!value) return { report: null as ProviderReport | null, providerCode: null as string | null }
  try {
    const parsed = JSON.parse(value) as unknown
    const object = record(parsed)
    const encrypted = typeof object?._providerCodeEncrypted === 'string' ? object._providerCodeEncrypted : null
    if (object) {
      const copy = { ...object }
      delete copy._providerCodeEncrypted
      return { report: normalizedReport(copy) ?? parseReport(JSON.stringify(copy)), providerCode: decryptProviderCode(encrypted) }
    }
    return { report: parseReport(value), providerCode: null }
  } catch {
    return { report: null, providerCode: null }
  }
}

/**
 * Read the latest completed carrier report owned by the authenticated user.
 * Missing evidence keeps the existing public flow available; a present but
 * ambiguous report is blocked so it cannot be presented as supported.
 */
export function getUnlockEligibility(userId: number | undefined, imei: string, productCode: string): UnlockEligibility {
  const normalizedProduct = productCode.trim().toUpperCase()
  if (!isUsCarrierUnlockProduct(normalizedProduct)) {
    return { status: 'not_applicable', blocksCheckout: false, hasTrustedResult: false }
  }
  const authenticatedUserId = typeof userId === 'number' && Number.isSafeInteger(userId) && userId > 0 ? userId : undefined
  if (authenticatedUserId === undefined || !/^\d{15}$/.test(imei)) {
    return { status: 'unknown', blocksCheckout: false, hasTrustedResult: false }
  }
  const trusted = latestTrustedCarrierCheck(authenticatedUserId, imei)
  if (!trusted) return { status: 'unknown', blocksCheckout: false, hasTrustedResult: false }
  return classifyUnlockEligibility({
    productCode: normalizedProduct,
    report: trusted.report,
    providerCode: trusted.providerCode,
    trustedCheckId: trusted.id,
  })
}
