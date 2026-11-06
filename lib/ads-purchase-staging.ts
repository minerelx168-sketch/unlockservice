import { db } from './db'
import { stageAdsPurchase } from './ads-conversion-outbox'

/** OCI must not depend on GA4 being configured, available, or having sent the purchase. */
export function stageCompletedAdsPurchases(startAt: number, limit = 100) {
  if (!Number.isFinite(startAt)) return 0
  const rows = db().prepare(`SELECT * FROM (
    SELECT 'unlock-'||o.id AS transaction_id,'order' AS kind,o.idempotency_key AS reference,l.created_at AS paid_at,o.price_cents AS revenue
    FROM orders o JOIN credit_ledger l ON l.user_id=o.user_id AND l.ref_type='order' AND l.ref_id=CAST(o.id AS TEXT)
      AND l.type='charge' AND l.amount_cents=-o.price_cents
    WHERE o.status='delivered' AND o.source='website' AND o.price_cents>0
    UNION ALL
    SELECT 'report-'||o.id,'paid_imei_report',o.idempotency_key,l.created_at,o.price_cents
    FROM paid_report_orders o JOIN credit_ledger l ON l.user_id=o.user_id AND l.ref_type='paid_imei_report' AND l.ref_id=CAST(o.id AS TEXT)
      AND l.type='charge' AND l.amount_cents=-o.price_cents
    WHERE o.status='completed' AND o.source='website'
    UNION ALL
    SELECT 'guest-'||g.reference,'guest',g.reference,g.paid_at,
      CASE WHEN g.card_order_price_cents IS NULL THEN g.price_cents ELSE g.card_order_price_cents+g.fee_cents-g.tax_cents END
    FROM guest_checkouts g JOIN paid_report_orders p ON p.id=g.report_id AND p.user_id=g.user_id
    WHERE g.environment='live' AND g.state IN ('paid','processing','completed') AND g.payment_id IS NOT NULL
      AND g.paid_at IS NOT NULL AND p.status='completed'
  ) candidates
  WHERE julianday(paid_at)>=julianday(?) AND julianday(paid_at)>=julianday('now','-30 days')
    AND NOT EXISTS(SELECT 1 FROM ads_conversion_outbox a WHERE a.transaction_id=candidates.transaction_id)
    AND EXISTS(SELECT 1 FROM ga4_checkout_context c WHERE c.kind=candidates.kind AND c.reference=candidates.reference
      AND c.consent='granted' AND c.internal=0 AND (c.gclid IS NOT NULL OR c.gbraid IS NOT NULL OR c.wbraid IS NOT NULL))
  ORDER BY paid_at,transaction_id LIMIT ?`).all(new Date(startAt).toISOString(), Math.max(0, Math.min(500, limit))) as {
    transaction_id: string; kind: string; reference: string; paid_at: string; revenue: number
  }[]
  let staged = 0
  for (const row of rows) {
    stageAdsPurchase({ transactionId: row.transaction_id, eventName: 'purchase', kind: row.kind,
      paidAt: row.paid_at, contextReference: row.reference },
    { events: [{ name: 'purchase', params: { currency: 'USD', value: row.revenue / 100 } }] })
    if (db().prepare('SELECT 1 FROM ads_conversion_outbox WHERE transaction_id=?').get(row.transaction_id)) staged++
  }
  return staged
}
