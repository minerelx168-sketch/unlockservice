import { db } from './db'

export type PurchaseItem = {
  item_id: string
  item_name: string
  price: number
  quantity: number
}
export type PurchaseConversion = {
  transactionId: string
  value: number
  currency: 'USD'
  newCustomer: boolean
  items?: PurchaseItem[]
}

type PurchaseKind = 'order' | 'paid_imei_report'

// Do not backfill old purchases when customers revisit their history after release.
// SQLite credit_ledger.created_at uses UTC datetime('now').
const TRACKING_STARTED_AT = Date.parse('2026-10-07T07:00:00Z')

/** Read-only: a completed order alone is not evidence of payment; the charge ledger is. */
export function purchaseConversion(
  userId: number,
  kind: PurchaseKind,
  orderId: number,
  priceCents: number,
): PurchaseConversion | null {
  if (!Number.isSafeInteger(userId) || userId < 1
      || !Number.isSafeInteger(orderId) || orderId < 1
      || !Number.isSafeInteger(priceCents) || priceCents < 1) return null

  const charge = db().prepare(
    `SELECT id, created_at FROM credit_ledger
      WHERE user_id = ? AND type = 'charge' AND ref_type = ? AND ref_id = ?
        AND amount_cents = ?
      ORDER BY id ASC LIMIT 1`,
  ).get(userId, kind, String(orderId), -priceCents) as { id: number; created_at: string } | undefined
  if (!charge) return null
  const chargedAt = Date.parse(`${charge.created_at.replace(' ', 'T')}Z`)
  if (!Number.isFinite(chargedAt) || chargedAt < TRACKING_STARTED_AT || chargedAt > Date.now() + 60_000) return null

  let item: PurchaseItem | undefined
  if (kind === 'order') {
    const row = db().prepare(`SELECT o.kind, o.carrier_id, o.service_id, b.name AS brand_name, c.name AS carrier_name, s.name AS service_name
      FROM orders o LEFT JOIN brands b ON b.id = o.brand_id LEFT JOIN carriers c ON c.id = o.carrier_id
      LEFT JOIN device_services s ON s.id = o.service_id WHERE o.id = ?`).get(orderId) as
      { kind: string; carrier_id: number | null; service_id: number | null; brand_name: string | null; carrier_name: string | null; service_name: string | null } | undefined
    if (row) {
      const itemName = row.kind === 'carrier_unlock'
        ? `${row.brand_name ?? 'Device'} network unlock — ${row.carrier_name ?? 'carrier'}`
        : `${row.service_name ?? 'Device service'}${row.brand_name ? ` — ${row.brand_name}` : ''}`
      if ((row.kind === 'carrier_unlock' && row.carrier_id) || (row.kind !== 'carrier_unlock' && row.service_id)) item = { item_id: row.kind === 'carrier_unlock' ? `carrier:${row.carrier_id}` : `service:${row.service_id}`, item_name: itemName, price: priceCents / 100, quantity: 1 }
    }
  } else {
    const row = db().prepare('SELECT product_code, product_name FROM paid_report_orders WHERE id = ?').get(orderId) as
      { product_code: string; product_name: string } | undefined
    if (row?.product_code && row.product_name) item = { item_id: row.product_code, item_name: row.product_name, price: priceCents / 100, quantity: 1 }
  }
  const earlierPurchase = db().prepare(
    `SELECT 1 FROM credit_ledger
      WHERE user_id = ? AND type = 'charge' AND ref_type IN ('order', 'paid_imei_report')
        AND id < ? LIMIT 1`,
  ).get(userId, charge.id)
  return {
    transactionId: `${kind === 'order' ? 'unlock' : 'report'}-${orderId}`,
    value: priceCents / 100,
    currency: 'USD',
    newCustomer: !earlierPurchase,
    ...(item ? { items: [item] } : {}),
  }
}
