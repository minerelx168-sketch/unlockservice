import { db } from './db'
import { validateClickId } from './attribution'

/** Staging only: no external upload until a Data Manager destination is configured. */
export function stageAdsPurchase(event: { transactionId: string; eventName: string; kind: string; paidAt: string; contextReference?: string }, body: Record<string, unknown>) {
  if (event.eventName !== 'purchase' || !event.contextReference) return
  const context = db().prepare('SELECT consent,internal,gclid,gbraid,wbraid FROM ga4_checkout_context WHERE kind=? AND reference=?')
    .get(event.kind, event.contextReference) as { consent: string; internal: number; gclid: string | null; gbraid: string | null; wbraid: string | null } | undefined
  if (context?.consent !== 'granted' || context.internal) return
  const field = (['gclid', 'wbraid', 'gbraid'] as const).find(key => validateClickId(context[key]))
  if (!field) return // Organic/AI visits must never be assigned an invented ad click.
  const events = body.events as { name?: string; params?: Record<string, unknown> }[] | undefined
  const params = events?.find(item => item.name === 'purchase')?.params
  if (!params || params.currency !== 'USD' || typeof params.value !== 'number' || !Number.isFinite(params.value) || params.value <= 0) return
  const margin = typeof params.gross_margin === 'number' && Number.isFinite(params.gross_margin) ? Math.round(params.gross_margin * 100) : null
  db().prepare(`INSERT OR IGNORE INTO ads_conversion_outbox(transaction_id,kind,context_reference,click_id_type,click_id,conversion_time,revenue_cents,gross_margin_cents,currency,state)
    VALUES(?,?,?,?,?,?,?,?,'USD','awaiting_configuration')`).run(event.transactionId,event.kind,event.contextReference,field,context[field],event.paidAt,Math.round(params.value * 100),margin)
}
