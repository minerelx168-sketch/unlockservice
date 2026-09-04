import { db } from './db'
import {
  charge,
  getBalance,
  hasCreditTransition,
  hold,
  InsufficientCredit,
  refund,
  type Balance,
} from './credits'
import { isValidImei, maskIdentifier, normalizeImei } from './imei'
import { fingerprintImei } from './imei-privacy'
import { buildProviderReport, providerReportHasContent, type ProviderReport } from './imei-report'
import {
  imeiProviderService,
  pollProviderRequest,
  providerConfiguration,
  submitProviderRequest,
  type ProviderOutcome,
  type ProviderService,
} from './provider-api'
import { recordProviderEvent } from './provider-events'
import { providerProductByCode } from './provider-products'
import { consumeAttempt } from './rate-limit'

export type PaidReportStatus = 'processing' | 'completed' | 'refunded' | 'manual_review'

export type PaidReportProduct = {
  code: string
  slug: string
  name: string
  summary: string
  group: string
  inputType: 'imei'
  priceCents: number
  providerCostMicros: number
  etaMinutes: number
  isActive: boolean
  sortOrder: number
  providerReady: boolean
}

type PaidReportProductRow = {
  code: string
  slug: string
  name: string
  summary: string
  input_type: 'imei'
  price_cents: number
  provider_cost_micros: number
  eta_minutes: number
  is_active: number
  sort_order: number
}

type PaidReportOrderRow = {
  id: number
  user_id: number
  product_code: string
  product_name: string
  input_type: 'imei'
  imei_fingerprint: string
  masked_imei: string
  status: PaidReportStatus
  price_cents: number
  provider_cost_micros: number
  source: string
  idempotency_key: string | null
  report_json: string | null
  provider_order_id: string | null
  provider_name: string | null
  provider_mode: string | null
  provider_service_id: string | null
  provider_last_polled_at: string | null
  provider_attempts: number
  provider_error_code: string | null
  error_message: string | null
  completed_at: string | null
  created_at: string
  updated_at: string
}

export type PaidReportView = {
  id: number
  productCode: string
  productName: string
  inputType: 'imei'
  maskedImei: string
  status: PaidReportStatus
  priceCents: number
  source: string
  report: ProviderReport | null
  message?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type PaidReportPayload = {
  success: true
  order: PaidReportView
  credit: {
    beforeCents: number
    heldCents: number
    chargedCents: number
    refundedCents: number
    balanceCents: number
  }
}

export type CreatePaidReportInput = {
  productCode: string
  imei: string
  idempotencyKey: string
}

export class PaidReportError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'product_unknown'
      | 'product_inactive'
      | 'provider_not_ready'
      | 'imei_missing'
      | 'imei_invalid'
      | 'idempotency_required'
      | 'idempotency_conflict'
      | 'rate_limited'
      | 'insufficient_credit'
      | 'report_not_found',
  ) {
    super(message)
    this.name = 'PaidReportError'
  }
}

const REPORT_RATE_LIMIT = 10
const REPORT_WINDOW_SECONDS = 60 * 60
const POLL_DEBOUNCE_MS = 5_000
const CREDIT_REF_TYPE = 'paid_imei_report'

const PRODUCT_SELECT = `
  SELECT code, slug, name, summary, input_type, price_cents,
         provider_cost_micros, eta_minutes, is_active, sort_order
    FROM paid_report_products
`

const ORDER_SELECT = `
  SELECT id, user_id, product_code, product_name, input_type,
         imei_fingerprint, masked_imei, status, price_cents,
         provider_cost_micros, source, idempotency_key, report_json,
         provider_order_id, provider_name, provider_mode, provider_service_id,
         provider_last_polled_at, provider_attempts, provider_error_code,
         error_message, completed_at, created_at, updated_at
    FROM paid_report_orders
`

function cleanProductCode(value: string) {
  const code = value.trim().toUpperCase()
  return /^[A-Z0-9_]{2,64}$/.test(code) ? code : ''
}

function mappingKey(productCode: string) {
  return productCode.toLowerCase()
}

function cleanIdempotencyKey(value: string) {
  const key = value.trim()
  if (!key) throw new PaidReportError('A request key is required.', 'idempotency_required')
  if (key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new PaidReportError('The request key is invalid.', 'idempotency_conflict')
  }
  return key
}

function parseReport(value: string | null): ProviderReport | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as unknown
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as ProviderReport) : null
  } catch {
    return null
  }
}

function productFromRow(row: PaidReportProductRow): PaidReportProduct {
  const config = providerConfiguration()
  const mapping = imeiProviderService(mappingKey(row.code))
  const catalogProduct = providerProductByCode(row.code)
  const approvedMapping = Boolean(
    catalogProduct?.status === 'available'
      && mapping?.mode === 'sync'
      && mapping.id === catalogProduct.serviceId,
  )
  return {
    code: row.code,
    slug: row.slug,
    name: row.name,
    summary: row.summary,
    group: catalogProduct?.group ?? 'Device checks',
    inputType: row.input_type,
    priceCents: row.price_cents,
    providerCostMicros: row.provider_cost_micros,
    etaMinutes: row.eta_minutes,
    isActive: row.is_active === 1,
    providerReady: row.is_active === 1 && config.enabled && approvedMapping,
    sortOrder: row.sort_order,
  }
}

function toView(row: PaidReportOrderRow): PaidReportView {
  return {
    id: row.id,
    productCode: row.product_code,
    productName: row.product_name,
    inputType: row.input_type,
    maskedImei: row.masked_imei,
    status: row.status,
    priceCents: row.price_cents,
    source: row.provider_name ?? 'provider',
    report: parseReport(row.report_json),
    message: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    completedAt: row.completed_at ?? undefined,
  }
}

function getProductRow(code: string): PaidReportProductRow | undefined {
  return db().prepare(`${PRODUCT_SELECT} WHERE code = ?`).get(code) as PaidReportProductRow | undefined
}

function rowForUser(userId: number, orderId: number): PaidReportOrderRow | undefined {
  return db().prepare(`${ORDER_SELECT} WHERE user_id = ? AND id = ?`).get(userId, orderId) as
    | PaidReportOrderRow
    | undefined
}

function rowForIdempotency(userId: number, idempotencyKey: string): PaidReportOrderRow | undefined {
  return db().prepare(`${ORDER_SELECT} WHERE user_id = ? AND idempotency_key = ?`).get(userId, idempotencyKey) as
    | PaidReportOrderRow
    | undefined
}

function reconcileSettlement(row: PaidReportOrderRow): PaidReportOrderRow {
  if (row.status === 'completed' || row.status === 'refunded') return row
  const refId = String(row.id)
  if (hasCreditTransition(CREDIT_REF_TYPE, refId, 'charge')) {
    db()
      .prepare(
        `UPDATE paid_report_orders
            SET status = 'completed', completed_at = COALESCE(completed_at, datetime('now')),
                updated_at = datetime('now')
          WHERE id = ? AND status IN ('processing', 'manual_review')`,
      )
      .run(row.id)
  } else if (hasCreditTransition(CREDIT_REF_TYPE, refId, 'refund')) {
    db()
      .prepare(
        `UPDATE paid_report_orders
            SET status = 'refunded', completed_at = COALESCE(completed_at, datetime('now')),
                updated_at = datetime('now')
          WHERE id = ? AND status IN ('processing', 'manual_review')`,
      )
      .run(row.id)
  }
  return (db().prepare(`${ORDER_SELECT} WHERE id = ?`).get(row.id) as PaidReportOrderRow) ?? row
}

function creditSnapshot(before: Balance, after: Balance, status: PaidReportStatus, priceCents: number) {
  return {
    beforeCents: before.availableCents,
    heldCents: status === 'processing' || status === 'manual_review' ? priceCents : 0,
    chargedCents: status === 'completed' ? priceCents : 0,
    refundedCents: status === 'refunded' ? priceCents : 0,
    balanceCents: after.availableCents,
  }
}

function payload(row: PaidReportOrderRow, before: Balance, after = getBalance(row.user_id)): PaidReportPayload {
  const current = reconcileSettlement(row)
  return {
    success: true,
    order: toView(current),
    credit: creditSnapshot(before, after, current.status, current.price_cents),
  }
}

function auditOutcome(row: PaidReportOrderRow, outcome: ProviderOutcome, eventKey: string) {
  const eventType =
    outcome.status === 'completed'
      ? 'completed'
      : outcome.status === 'processing'
        ? 'processing'
        : outcome.retryable
          ? outcome.code === 'timeout'
            ? 'timeout'
            : 'manual_review'
          : 'unavailable'
  recordProviderEvent({
    resourceType: 'paid_imei_report',
    resourceId: row.id,
    provider: row.provider_name ?? providerConfiguration().name,
    providerMode: row.provider_mode ?? 'unknown',
    eventType,
    idempotencyKey: eventKey,
    durationMs: outcome.timing.totalMs,
    errorCode: outcome.status === 'unavailable' ? outcome.code : undefined,
    metadata: { status: outcome.status, productCode: row.product_code },
  })
}

function settleCompleted(row: PaidReportOrderRow, report: ProviderReport, providerOrderId: string | null) {
  return db().transaction(() => {
    const current = db().prepare(`${ORDER_SELECT} WHERE id = ?`).get(row.id) as PaidReportOrderRow
    if (current.status === 'refunded') throw new Error('cannot deliver a refunded paid report')
    charge(current.user_id, current.price_cents, CREDIT_REF_TYPE, String(current.id))
    db()
      .prepare(
        `UPDATE paid_report_orders
            SET status = 'completed', report_json = ?, provider_order_id = COALESCE(?, provider_order_id),
                provider_error_code = NULL, error_message = NULL,
                completed_at = COALESCE(completed_at, datetime('now')), updated_at = datetime('now')
          WHERE id = ? AND status IN ('processing', 'manual_review', 'completed')`,
      )
      .run(JSON.stringify(report), providerOrderId, current.id)
    return db().prepare(`${ORDER_SELECT} WHERE id = ?`).get(current.id) as PaidReportOrderRow
  })()
}

function settleRefunded(row: PaidReportOrderRow, errorCode: string, message: string) {
  return db().transaction(() => {
    const current = db().prepare(`${ORDER_SELECT} WHERE id = ?`).get(row.id) as PaidReportOrderRow
    if (current.status === 'completed') throw new Error('cannot refund a completed paid report')
    refund(current.user_id, current.price_cents, CREDIT_REF_TYPE, String(current.id))
    db()
      .prepare(
        `UPDATE paid_report_orders
            SET status = 'refunded', provider_error_code = ?, error_message = ?,
                completed_at = COALESCE(completed_at, datetime('now')), updated_at = datetime('now')
          WHERE id = ? AND status IN ('processing', 'manual_review', 'refunded')`,
      )
      .run(errorCode, message, current.id)
    return db().prepare(`${ORDER_SELECT} WHERE id = ?`).get(current.id) as PaidReportOrderRow
  })()
}

function markManualReview(row: PaidReportOrderRow, errorCode: string, message: string) {
  db()
    .prepare(
      `UPDATE paid_report_orders
          SET status = 'manual_review', provider_error_code = ?, error_message = ?, updated_at = datetime('now')
        WHERE id = ? AND status IN ('processing', 'manual_review')`,
    )
    .run(errorCode, message, row.id)
  return db().prepare(`${ORDER_SELECT} WHERE id = ?`).get(row.id) as PaidReportOrderRow
}

function markProcessing(row: PaidReportOrderRow, providerOrderId: string, polled: boolean) {
  db()
    .prepare(
      `UPDATE paid_report_orders
          SET status = 'processing', provider_order_id = ?, provider_error_code = NULL,
              error_message = NULL,
              provider_last_polled_at = CASE WHEN ? = 1 THEN datetime('now') ELSE provider_last_polled_at END,
              provider_attempts = provider_attempts + CASE WHEN ? = 1 THEN 1 ELSE 0 END,
              updated_at = datetime('now')
        WHERE id = ? AND status IN ('processing', 'manual_review')`,
    )
    .run(providerOrderId, polled ? 1 : 0, polled ? 1 : 0, row.id)
  return db().prepare(`${ORDER_SELECT} WHERE id = ?`).get(row.id) as PaidReportOrderRow
}

function handleOutcome(
  row: PaidReportOrderRow,
  outcome: ProviderOutcome,
  before: Balance,
  eventKey: string,
): PaidReportPayload {
  auditOutcome(row, outcome, eventKey)

  if (outcome.status === 'completed') {
    const report = buildProviderReport(row.product_code, row.provider_name ?? 'provider', outcome.data)
    if (!providerReportHasContent(report)) {
      const reviewed = markManualReview(
        row,
        'unsupported_response',
        'The provider completed the lookup, but the result needs manual review before delivery. Your credit remains on hold.',
      )
      recordProviderEvent({
        resourceType: 'paid_imei_report',
        resourceId: row.id,
        provider: row.provider_name ?? providerConfiguration().name,
        providerMode: row.provider_mode ?? 'unknown',
        eventType: 'manual_review',
        idempotencyKey: `${eventKey}:unsupported`,
        errorCode: 'unsupported_response',
        metadata: { status: 'manual_review', productCode: row.product_code },
      })
      return payload(reviewed, before)
    }
    const completed = settleCompleted(row, report, outcome.providerId)
    return payload(completed, before)
  }

  if (outcome.status === 'processing') {
    const processing = markProcessing(row, outcome.providerId, false)
    return payload(processing, before)
  }

  if (outcome.retryable) {
    const reviewed = markManualReview(
      row,
      outcome.code,
      'The provider response is uncertain. Your credit remains on hold for manual review; this request will not be retried automatically.',
    )
    return payload(reviewed, before)
  }

  const refunded = settleRefunded(
    row,
    outcome.code,
    'The provider could not deliver this report. The full credit hold was released.',
  )
  return payload(refunded, before)
}

function providerReadyFor(product: PaidReportProductRow): { config: ReturnType<typeof providerConfiguration>; service: ProviderService } {
  const config = providerConfiguration()
  const service = imeiProviderService(mappingKey(product.code))
  const catalogProduct = providerProductByCode(product.code)
  if (
    !config.enabled
    || !service
    || catalogProduct?.status !== 'available'
    || service.mode !== 'sync'
    || service.id !== catalogProduct.serviceId
  ) {
    throw new PaidReportError('This paid report is not available yet.', 'provider_not_ready')
  }
  return { config, service }
}

export function listPaidReportProducts(): PaidReportProduct[] {
  const rows = db()
    .prepare(`${PRODUCT_SELECT} WHERE is_active = 1 ORDER BY sort_order, code`)
    .all() as PaidReportProductRow[]
  return rows.map(productFromRow)
}

export function getPaidReportProduct(code: string): PaidReportProduct | undefined {
  const row = getProductRow(cleanProductCode(code))
  return row ? productFromRow(row) : undefined
}

export function getPaidReport(userId: number, orderId: number): PaidReportView | undefined {
  const row = rowForUser(userId, orderId)
  return row ? toView(reconcileSettlement(row)) : undefined
}

export function listPaidReports(userId: number, limit = 50): PaidReportView[] {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
  const rows = db()
    .prepare(`${ORDER_SELECT} WHERE user_id = ? ORDER BY id DESC LIMIT ?`)
    .all(userId, safeLimit) as PaidReportOrderRow[]
  return rows.map((row) => toView(reconcileSettlement(row)))
}

export async function createPaidReport(
  userId: number,
  input: CreatePaidReportInput,
  source: 'website' | 'api' = 'website',
): Promise<PaidReportPayload> {
  const productCode = cleanProductCode(input.productCode)
  const product = getProductRow(productCode)
  if (!product) throw new PaidReportError('Choose a valid paid report.', 'product_unknown')
  if (product.is_active !== 1) throw new PaidReportError('This paid report is not active.', 'product_inactive')
  const { config, service } = providerReadyFor(product)

  const imei = normalizeImei(input.imei)
  if (!imei) throw new PaidReportError('Enter the device IMEI.', 'imei_missing')
  if (!isValidImei(imei)) throw new PaidReportError('Enter a valid 15-digit IMEI.', 'imei_invalid')
  const fingerprint = fingerprintImei(imei)
  const idempotencyKey = cleanIdempotencyKey(input.idempotencyKey)

  const existing = rowForIdempotency(userId, idempotencyKey)
  if (existing) {
    if (existing.product_code !== product.code || existing.imei_fingerprint !== fingerprint) {
      throw new PaidReportError('That request key was already used for a different report.', 'idempotency_conflict')
    }
    const balance = getBalance(userId)
    return payload(existing, balance, balance)
  }

  if (!consumeAttempt('paid-imei-report-user', String(userId), REPORT_RATE_LIMIT, REPORT_WINDOW_SECONDS)) {
    throw new PaidReportError('Too many paid report requests. Please try again later.', 'rate_limited')
  }

  const before = getBalance(userId)
  let row: PaidReportOrderRow
  try {
    row = db().transaction(() => {
      const inserted = db()
        .prepare(
          `INSERT INTO paid_report_orders
             (user_id, product_code, product_name, input_type, imei_fingerprint, masked_imei,
              status, price_cents, provider_cost_micros, source, idempotency_key,
              provider_name, provider_mode, provider_service_id, provider_attempts)
           VALUES (?, ?, ?, ?, ?, ?, 'manual_review', ?, ?, ?, ?, ?, ?, ?, 1)`,
        )
        .run(
          userId,
          product.code,
          product.name,
          product.input_type,
          fingerprint,
          maskIdentifier(imei),
          product.price_cents,
          product.provider_cost_micros,
          source,
          idempotencyKey,
          config.name,
          service.mode,
          service.id,
        )
      const orderId = Number(inserted.lastInsertRowid)
      hold(userId, product.price_cents, CREDIT_REF_TYPE, String(orderId))
      return db().prepare(`${ORDER_SELECT} WHERE id = ?`).get(orderId) as PaidReportOrderRow
    })()
  } catch (error) {
    const replay = rowForIdempotency(userId, idempotencyKey)
    if (replay) {
      if (replay.product_code !== product.code || replay.imei_fingerprint !== fingerprint) {
        throw new PaidReportError('That request key was already used for a different report.', 'idempotency_conflict')
      }
      const balance = getBalance(userId)
      return payload(replay, balance, balance)
    }
    if (error instanceof InsufficientCredit) {
      throw new PaidReportError('Not enough credit for this report. Add funds and try again.', 'insufficient_credit')
    }
    throw error
  }

  recordProviderEvent({
    resourceType: 'paid_imei_report',
    resourceId: row.id,
    provider: config.name,
    providerMode: service.mode,
    eventType: 'submitted',
    idempotencyKey: 'submit:1',
    metadata: { status: 'submitted', productCode: row.product_code },
  })

  let outcome: ProviderOutcome
  try {
    outcome = await submitProviderRequest({ imei, service })
  } catch {
    outcome = {
      status: 'unavailable',
      providerId: null,
      code: 'provider_exception',
      message: 'The provider could not be reached.',
      retryable: true,
      timing: { totalMs: 0 },
    }
  }
  return handleOutcome(row, outcome, before, 'submit:1:outcome')
}

function pollDebounced(row: PaidReportOrderRow) {
  if (!row.provider_last_polled_at) return false
  const timestamp = Date.parse(`${row.provider_last_polled_at}Z`)
  return Number.isFinite(timestamp) && Date.now() - timestamp < POLL_DEBOUNCE_MS
}

export async function pollPaidReport(userId: number, orderId: number): Promise<PaidReportPayload> {
  const original = rowForUser(userId, orderId)
  if (!original) throw new PaidReportError('Paid report not found.', 'report_not_found')
  const row = reconcileSettlement(original)
  const before = getBalance(userId)
  if (row.status !== 'processing') return payload(row, before, before)
  if (row.provider_mode !== 'dhru' || !row.provider_order_id || pollDebounced(row)) {
    return payload(row, before, before)
  }

  let outcome: ProviderOutcome
  try {
    outcome = await pollProviderRequest(row.provider_order_id)
  } catch {
    outcome = {
      status: 'unavailable',
      providerId: row.provider_order_id,
      code: 'poll_exception',
      message: 'The provider could not be reached.',
      retryable: true,
      timing: { totalMs: 0 },
    }
  }

  if (outcome.status === 'unavailable' && outcome.retryable) {
    db()
      .prepare(
        `UPDATE paid_report_orders
            SET provider_last_polled_at = datetime('now'), provider_attempts = provider_attempts + 1,
                provider_error_code = ?, updated_at = datetime('now')
          WHERE id = ? AND status = 'processing'`,
      )
      .run(outcome.code, row.id)
    auditOutcome(row, outcome, `poll:${row.provider_attempts + 1}:transient`)
    const current = rowForUser(userId, row.id)!
    return payload(current, before, getBalance(userId))
  }

  if (outcome.status === 'processing') {
    const processing = markProcessing(row, outcome.providerId, true)
    auditOutcome(row, outcome, `poll:${row.provider_attempts + 1}:processing`)
    return payload(processing, before, getBalance(userId))
  }

  return handleOutcome(row, outcome, before, `poll:${row.provider_attempts + 1}:outcome`)
}
