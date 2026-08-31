import { db } from './db'
import { pollImeiCheck } from './imei-checks'
import { pollOrder } from './orders'
import { providerConfiguration } from './provider-api'

export type ProviderPollSummary = {
  enabled: boolean
  ordersSeen: number
  checksSeen: number
  completed: number
  unavailable: number
  processing: number
  errors: number
}

export async function pollProviderJobs(limit = 20): Promise<ProviderPollSummary> {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
  const summary: ProviderPollSummary = {
    enabled: providerConfiguration().enabled,
    ordersSeen: 0,
    checksSeen: 0,
    completed: 0,
    unavailable: 0,
    processing: 0,
    errors: 0,
  }
  if (!summary.enabled) return summary

  const orders = db()
    .prepare(
      `SELECT id, user_id
         FROM orders
        WHERE status = 'processing'
          AND provider_mode = 'dhru'
          AND provider_order_id IS NOT NULL
          AND (provider_last_polled_at IS NULL OR provider_last_polled_at <= datetime('now', '-8 seconds'))
        ORDER BY COALESCE(provider_last_polled_at, created_at) ASC
        LIMIT ?`,
    )
    .all(safeLimit) as Array<{ id: number; user_id: number }>

  for (const order of orders) {
    summary.ordersSeen += 1
    try {
      const result = await pollOrder(order.user_id, order.id)
      if (result.status === 'delivered') summary.completed += 1
      else if (result.status === 'unavailable') summary.unavailable += 1
      else summary.processing += 1
    } catch {
      summary.errors += 1
    }
  }

  const remaining = Math.max(0, safeLimit - orders.length)
  if (!remaining) return summary

  const checks = db()
    .prepare(
      `SELECT id, user_id
         FROM imei_checks
        WHERE status = 'processing'
          AND provider_mode = 'dhru'
          AND provider_check_id IS NOT NULL
          AND (provider_last_polled_at IS NULL OR provider_last_polled_at <= datetime('now', '-8 seconds'))
        ORDER BY COALESCE(provider_last_polled_at, created_at) ASC
        LIMIT ?`,
    )
    .all(remaining) as Array<{ id: number; user_id: number }>

  for (const check of checks) {
    summary.checksSeen += 1
    try {
      const result = await pollImeiCheck(check.user_id, check.id)
      if (result.status === 'completed') summary.completed += 1
      else if (result.status === 'unavailable') summary.unavailable += 1
      else summary.processing += 1
    } catch {
      summary.errors += 1
    }
  }

  return summary
}
