/**
 * AI revenue ledger: one row per real payment, keyed by the processor's
 * payment ID, so a replayed or duplicated webhook can never count a sale twice.
 *
 *   gross_profit = net_collected − payment_fee − supplier_cost − refunded
 *
 * net_collected excludes tax. payment_fee comes from Whop's amount_after_fees
 * when present (fee_estimated = 0) and otherwise from PAYMENT_FEE_BPS /
 * PAYMENT_FEE_FIXED_CENTS (fee_estimated = 1). Crypto (BEP20) has no platform
 * fee. Supplier cost is the owner's price sheet (catalog/service-margins.json).
 *
 * This ledger is measurement only: it never decides payment acceptance,
 * credit, fulfilment or refunds, and every write path swallows its own errors.
 */
import type { Whop } from '@whop/sdk'
import { db } from '../db'
import { parseUsd } from '../money'
import { serviceCostCents, serviceForCode } from '../service-margins'
import { attributedSource, type Touch } from './ai-attribution'

export type LedgerStatus = 'succeeded' | 'partially_refunded' | 'refunded'

export function grossProfitCents(input: { netCollectedCents: number; paymentFeeCents: number; supplierCostCents: number; refundedCents: number }): number {
  return input.netCollectedCents - input.paymentFeeCents - input.supplierCostCents - input.refundedCents
}

export function estimatedCardFeeCents(totalCents: number): number {
  const bps = Number(process.env.PAYMENT_FEE_BPS ?? 300)
  const fixed = Number(process.env.PAYMENT_FEE_FIXED_CENTS ?? 30)
  return Math.max(0, Math.round(totalCents * (Number.isFinite(bps) ? bps : 300) / 10_000) + (Number.isFinite(fixed) ? fixed : 30))
}

/** Store times in SQLite's 'YYYY-MM-DD HH:MM:SS' (UTC) so range queries compare correctly. */
export function sqliteTime(value: string): string {
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) return value
  const t = Date.parse(value)
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function statusFor(refundedCents: number, netCollectedCents: number): LedgerStatus {
  return refundedCents <= 0 ? 'succeeded' : refundedCents >= netCollectedCents ? 'refunded' : 'partially_refunded'
}

/** Snapshot of the visitor's AI attribution at checkout creation. First write wins. */
export function saveOrderAttribution(kind: 'guest' | 'crypto' | 'order', orderRef: string, ft: Touch | null, lt: Touch | null,
  extra: { skuId?: string | null; gaClientId?: string | null; gaSessionId?: string | null } = {}): void {
  try {
    if (!/^[A-Za-z0-9_-]{6,80}$/.test(orderRef)) return
    const { source, confidence } = attributedSource(ft, lt)
    const landing = lt ?? ft
    db().prepare(`INSERT OR IGNORE INTO order_ai_attribution (order_ref, kind, ai_source_ft, ai_source_lt, attribution_source, attribution_confidence,
      raw_referrer, utm_source, utm_medium, utm_campaign, landing_page_path, locale, sku_id, ga_client_id, ga_session_id, captured_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(orderRef, kind, ft?.source ?? 'direct', lt?.source ?? ft?.source ?? 'direct', source, confidence,
      landing?.raw_referrer ?? null, landing?.utm_source ?? null, landing?.utm_medium ?? null, landing?.utm_campaign ?? null,
      landing?.landing_page_path ?? null, landing?.locale ?? null, extra.skuId ?? null,
      extra.gaClientId && /^\d{1,20}\.\d{1,20}$/.test(extra.gaClientId) ? extra.gaClientId : null,
      extra.gaSessionId && /^\d{1,12}$/.test(extra.gaSessionId) ? extra.gaSessionId : null, landing?.captured_at ?? null)
  } catch { /* Attribution must never block checkout. */ }
}

export type SucceededInput = {
  paymentId: string; orderRef: string; kind: 'guest_card' | 'guest_crypto'; productCode: string | null; productName?: string
  grossCents: number; taxCents: number; paymentFeeCents: number | null; refundedCents?: number
  country?: string | null; customerType?: 'new' | 'returning' | null; paidAt: string
}

/** Inserts once per payment ID. Returns 'duplicate' for any repeat delivery. */
export function recordPaymentSucceeded(input: SucceededInput): 'inserted' | 'duplicate' {
  if (!/^[A-Za-z0-9:_-]{4,120}$/.test(input.paymentId)) throw new Error('Invalid payment id')
  if (!Number.isSafeInteger(input.grossCents) || input.grossCents < 0 || !Number.isSafeInteger(input.taxCents) || input.taxCents < 0) throw new Error('Invalid amount')
  const attribution = db().prepare('SELECT attribution_source, attribution_confidence, landing_page_path, locale, sku_id FROM order_ai_attribution WHERE order_ref=?')
    .get(input.orderRef) as { attribution_source: string; attribution_confidence: string; landing_page_path: string | null; locale: string | null; sku_id: string | null } | undefined
  const service = serviceForCode(input.productCode, input.productName)
  const cost = serviceCostCents(service.serviceId)
  const net = input.grossCents - input.taxCents
  const feeEstimated = input.paymentFeeCents === null
  const fee = input.paymentFeeCents ?? (input.kind === 'guest_crypto' ? 0 : estimatedCardFeeCents(input.grossCents))
  const refunded = Math.max(0, Math.min(net, input.refundedCents ?? 0))
  const profit = grossProfitCents({ netCollectedCents: net, paymentFeeCents: fee, supplierCostCents: cost ?? 0, refundedCents: refunded })
  const result = db().prepare(`INSERT OR IGNORE INTO ai_revenue_ledger (payment_id, order_ref, kind, sku_id, attribution_source, attribution_confidence,
    landing_page_path, locale, country, customer_type, gross_cents, tax_cents, net_collected_cents, payment_fee_cents, fee_estimated,
    supplier_cost_cents, cost_known, refunded_cents, gross_profit_cents, status, paid_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(input.paymentId, input.orderRef, input.kind, service.serviceId ?? attribution?.sku_id ?? input.productCode,
    attribution?.attribution_source ?? 'direct', attribution?.attribution_confidence ?? 'non_ai', attribution?.landing_page_path ?? null, attribution?.locale ?? null,
    input.country && /^[A-Z]{2}$/.test(input.country) ? input.country : null, input.customerType ?? null,
    input.grossCents, input.taxCents, net, fee, feeEstimated ? 1 : 0, cost ?? 0, cost === null ? 0 : 1, refunded, profit, statusFor(refunded, net), sqliteTime(input.paidAt))
  return result.changes ? 'inserted' : 'duplicate'
}

/** Applies a cumulative refund total. Lower or equal totals (replays, reordering) change nothing. */
export function recordPaymentRefunded(paymentId: string, cumulativeRefundedCents: number): 'updated' | 'unchanged' | 'missing' {
  const row = db().prepare('SELECT net_collected_cents, payment_fee_cents, supplier_cost_cents, refunded_cents FROM ai_revenue_ledger WHERE payment_id=?')
    .get(paymentId) as { net_collected_cents: number; payment_fee_cents: number; supplier_cost_cents: number; refunded_cents: number } | undefined
  if (!row) return 'missing'
  const refunded = Math.max(0, Math.min(row.net_collected_cents, Math.round(cumulativeRefundedCents)))
  if (refunded <= row.refunded_cents) return 'unchanged'
  const profit = grossProfitCents({ netCollectedCents: row.net_collected_cents, paymentFeeCents: row.payment_fee_cents, supplierCostCents: row.supplier_cost_cents, refundedCents: refunded })
  db().prepare(`UPDATE ai_revenue_ledger SET refunded_cents=?, gross_profit_cents=?, status=?, updated_at=datetime('now') WHERE payment_id=? AND refunded_cents<?`)
    .run(refunded, profit, statusFor(refunded, row.net_collected_cents), paymentId, refunded)
  return 'updated'
}

function usdCents(value: Whop.Money | null | undefined): number | null {
  if (!value || value.currency !== 'usd' || value.decimals !== 2) return null
  const cents = parseUsd(value.amount)
  return cents !== null && Number.isSafeInteger(cents) && cents >= 0 ? cents : null
}

/**
 * Mirror an authenticated, server-retrieved Whop payment into the ledger.
 * Called after settlement for both payment.succeeded and refund events.
 */
export function syncLedgerFromWhopPayment(payment: Whop.Payment): 'inserted' | 'duplicate' | 'updated' | 'unchanged' | 'missing' | 'skipped' {
  try {
    const ref = payment.metadata?.guest_reference
    if (typeof ref !== 'string' || !/^[a-f0-9]{32}$/.test(ref) || payment.metadata?.integration !== 'iunlockmobile-guest-v1') return 'skipped'
    if (payment.status !== 'paid' && !payment.paid_at) return 'skipped'
    const total = usdCents(payment.total)
    if (total === null) return 'skipped'
    const tax = usdCents(payment.tax_amount) ?? 0
    const afterFees = usdCents(payment.amount_after_fees)
    const refundedGross = usdCents(payment.refunded_amount) ?? 0
    const refundedTax = usdCents(payment.tax_refunded_amount) ?? 0
    const row = db().prepare('SELECT product_code, product_name, customer_user_id, email FROM guest_checkouts WHERE reference=?').get(ref) as
      { product_code: string; product_name: string; customer_user_id: number | null; email: string } | undefined
    if (!row) return 'skipped'
    let customerType: 'new' | 'returning' | null = null
    try {
      customerType = db().prepare(`SELECT 1 FROM ai_revenue_ledger l JOIN guest_checkouts g ON g.reference=l.order_ref
        WHERE lower(g.email)=lower(?) AND l.order_ref<>? LIMIT 1`).get(row.email, ref) ? 'returning' : 'new'
    } catch { customerType = null }
    const inserted = recordPaymentSucceeded({
      paymentId: payment.id, orderRef: ref, kind: 'guest_card', productCode: row.product_code, productName: row.product_name,
      grossCents: total, taxCents: tax, paymentFeeCents: afterFees !== null && afterFees <= total ? total - afterFees : null,
      refundedCents: Math.max(0, refundedGross - refundedTax), country: payment.billing_address?.country?.toUpperCase() ?? null,
      customerType, paidAt: payment.paid_at ?? payment.created_at,
    })
    if (inserted === 'duplicate' && refundedGross > 0) return recordPaymentRefunded(payment.id, refundedGross - refundedTax)
    return inserted
  } catch { return 'skipped' }
}

/** Crypto orders have no processor webhook: sweep paid and refunded rows idempotently. */
export function syncLedgerFromCryptoCheckouts(limit = 50): { inserted: number; refunded: number } {
  const stats = { inserted: 0, refunded: 0 }
  try {
    const rows = db().prepare(`SELECT reference, product_code, product_name, payment_id, paid_at, state, price_cents, tax_cents FROM guest_checkouts
      WHERE payment_method='crypto' AND paid_at IS NOT NULL AND payment_id IS NOT NULL AND environment='live'
      AND (NOT EXISTS (SELECT 1 FROM ai_revenue_ledger l WHERE l.payment_id='crypto:'||guest_checkouts.payment_id)
        OR (state='refunded' AND EXISTS (SELECT 1 FROM ai_revenue_ledger l WHERE l.payment_id='crypto:'||guest_checkouts.payment_id AND l.status<>'refunded')))
      ORDER BY paid_at LIMIT ?`).all(Math.max(1, Math.min(500, limit))) as
      { reference: string; product_code: string; product_name: string; payment_id: string; paid_at: string; state: string; price_cents: number; tax_cents: number }[]
    for (const row of rows) {
      const id = 'crypto:' + row.payment_id
      if (recordPaymentSucceeded({ paymentId: id, orderRef: row.reference, kind: 'guest_crypto', productCode: row.product_code, productName: row.product_name,
        grossCents: row.price_cents + (row.tax_cents ?? 0), taxCents: row.tax_cents ?? 0, paymentFeeCents: 0, paidAt: row.paid_at }) === 'inserted') stats.inserted++
      if (row.state === 'refunded' && recordPaymentRefunded(id, row.price_cents) === 'updated') stats.refunded++
    }
  } catch { /* Measurement only. */ }
  return stats
}

/** GA4 purchase parameters for an order (same transaction_id as every other purchase send). */
export function ledgerGa4Params(orderRef: string): Record<string, string | number> {
  try {
    const row = db().prepare(`SELECT attribution_source, attribution_confidence, sku_id, gross_profit_cents FROM ai_revenue_ledger
      WHERE order_ref=? ORDER BY paid_at LIMIT 1`).get(orderRef) as { attribution_source: string; attribution_confidence: string; sku_id: string | null; gross_profit_cents: number } | undefined
    const attribution = row ? null : db().prepare('SELECT attribution_source, attribution_confidence, sku_id FROM order_ai_attribution WHERE order_ref=?')
      .get(orderRef) as { attribution_source: string; attribution_confidence: string; sku_id: string | null } | undefined
    const source = row ?? attribution
    if (!source) return {}
    const out: Record<string, string | number> = { ai_source: source.attribution_source, attribution_confidence: source.attribution_confidence }
    if (source.sku_id) out.sku_id = source.sku_id
    if (row) out.gross_profit_usd = row.gross_profit_cents / 100
    return out
  } catch { return {} }
}
