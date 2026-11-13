import { db } from '../db'
import { EXPERIMENT_IDS, MIN_SESSIONS_PER_ARM, experimentStatus, parseVariantSummary, twoProportionZTest, type ExperimentId, type Variant } from './experiments'
import { marginCents, serviceForCode } from '../service-margins'

/** First exposure wins; a repeat impression from the same visitor is a no-op. */
export function recordExposure(visitor: string, experiment: ExperimentId, variant: Variant): boolean {
  const result = db().prepare('INSERT OR IGNORE INTO cro_exposures (visitor,experiment,variant) VALUES (?,?,?)').run(visitor, experiment, variant)
  return result.changes > 0
}

export function recordCheckout(input: { reference: string; visitor: string; variants: string; productCode: string; orderBump: boolean }) {
  db().prepare('INSERT OR IGNORE INTO cro_checkouts (reference,visitor,variants,product_code,order_bump) VALUES (?,?,?,?,?)')
    .run(input.reference, input.visitor, input.variants.slice(0, 200), input.productCode, input.orderBump ? 1 : 0)
}

export type ArmResult = {
  exposures: number
  begin_checkout: number
  verified_purchases: number
  paid_cvr_pct: number
  gross_profit_usd: number
  gross_profit_per_session: number
  order_bumps_accepted?: number
}
export type ExperimentReport = {
  experiment_id: ExperimentId
  A: ArmResult
  B: ArmResult
  z_score: number
  p_value: number
  min_sessions_per_arm: number
  status: ReturnType<typeof experimentStatus>
}

type CheckoutRow = { visitor: string; variants: string; reference: string; order_bump: number; paid: number; product_code: string; price_cents: number | null }

const round = (value: number, places = 2) => Math.round(value * 10 ** places) / 10 ** places

/**
 * Paid means settled by the verified payment path (Whop webhook or confirmed
 * crypto transfer) and not refunded. Revenue never comes from the browser.
 * A visitor counts in the arm of its recorded exposure only, so traffic that
 * never saw the experiment does not dilute either side.
 */
export function croReport(since?: string): ExperimentReport[] {
  const from = since && /^\d{4}-\d{2}-\d{2}$/.test(since) ? since : '1970-01-01'
  const exposures = db().prepare('SELECT experiment, variant, visitor FROM cro_exposures WHERE first_at >= ?').all(from) as { experiment: string; variant: Variant; visitor: string }[]
  const checkouts = db().prepare(`SELECT c.visitor, c.variants, c.reference, c.order_bump, c.product_code, g.price_cents,
      CASE WHEN g.paid_at IS NOT NULL AND g.state NOT IN ('pending','refunded','refund_pending') AND g.review_reason IS NULL THEN 1 ELSE 0 END AS paid
    FROM cro_checkouts c LEFT JOIN guest_checkouts g ON g.reference = c.reference WHERE c.created_at >= ?`).all(from) as CheckoutRow[]

  const byVisitor = new Map<string, CheckoutRow[]>()
  for (const row of checkouts) byVisitor.set(row.visitor, [...(byVisitor.get(row.visitor) ?? []), row])

  return EXPERIMENT_IDS.map((experiment) => {
    const arms: Record<Variant, ArmResult> = { A: emptyArm(), B: emptyArm() }
    for (const exposure of exposures.filter((entry) => entry.experiment === experiment)) {
      const arm = arms[exposure.variant]
      arm.exposures++
      const rows = (byVisitor.get(exposure.visitor) ?? []).filter((row) => parseVariantSummary(row.variants)[experiment] === exposure.variant)
      if (rows.length) arm.begin_checkout++
      const paid = rows.filter((row) => row.paid === 1)
      if (paid.length) arm.verified_purchases++
      for (const row of paid) {
        const service = serviceForCode(row.product_code)
        arm.gross_profit_usd += marginCents(service.serviceId, row.price_cents ?? 0).valueCents / 100
        if (row.order_bump) arm.order_bumps_accepted = (arm.order_bumps_accepted ?? 0) + 1
      }
    }
    for (const arm of Object.values(arms)) {
      arm.paid_cvr_pct = arm.exposures ? round(100 * arm.verified_purchases / arm.exposures, 3) : 0
      arm.gross_profit_usd = round(arm.gross_profit_usd)
      arm.gross_profit_per_session = arm.exposures ? round(arm.gross_profit_usd / arm.exposures, 4) : 0
    }
    const { z, p } = twoProportionZTest(arms.A.verified_purchases, arms.A.exposures, arms.B.verified_purchases, arms.B.exposures)
    return { experiment_id: experiment, A: arms.A, B: arms.B, z_score: round(z, 4), p_value: round(p, 6),
      min_sessions_per_arm: MIN_SESSIONS_PER_ARM, status: experimentStatus(arms.A.exposures, arms.B.exposures, z, p) }
  })
}

function emptyArm(): ArmResult {
  return { exposures: 0, begin_checkout: 0, verified_purchases: 0, paid_cvr_pct: 0, gross_profit_usd: 0, gross_profit_per_session: 0 }
}
