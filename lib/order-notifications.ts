import { randomUUID } from 'node:crypto'
import { emailDeliveryConfigured, sendTransactionalEmail } from './account-security'
import { db } from './db'
import { normalizeProviderCode, providerCodeFromData } from './provider-code'
import { publicOrigin } from './site'

type StoredResourceType = 'order' | 'paid_imei_report'
type SettlementEvent = 'success' | 'rejected'

type NotificationRow = {
  id: number
  user_id: number
  resource_type: StoredResourceType
  resource_id: number
  event: SettlementEvent
  attempts: number
  lease_token: string
  email: string
  imei: string | null
  unlock_code: string | null
  result_json: string | null
}

export type NotificationDeliverySummary = {
  claimed: number
  sent: number
  failed: number
  leaseLost: number
  suppressed: number
}

const LEASE_MS = 30_000
const MAX_BATCH = 100

/**
 * Call synchronously inside the transaction that settles credit and an unlock order.
 * A rollback then removes the event too; a duplicate callback cannot enqueue
 * another copy of the same event. IMEI checks and paid reports never call this.
 */
export function enqueueOrderNotification(
  resourceType: 'order',
  resourceId: number,
  userId: number,
  status: SettlementEvent,
): void {
  const connection = db()
  if (!connection.inTransaction) {
    throw new Error('Settlement notifications must be enqueued inside a database transaction.')
  }
  connection.prepare(`
    INSERT INTO order_notifications (user_id, resource_type, resource_id, event)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(resource_type, resource_id, event) DO NOTHING
  `).run(userId, resourceType, resourceId, status)
}

function suppressCheckNotifications(): number {
  const result = db().prepare(`
    UPDATE order_notifications
       SET sent_at = datetime('now'), last_error = 'email_suppressed_for_check_service',
           lease_token = NULL, lease_until = 0
     WHERE sent_at IS NULL AND resource_type != 'order'
  `).run()
  return result.changes
}

function claimNotification(id: number): NotificationRow | null {
  const connection = db()
  return connection.transaction(() => {
    const now = Date.now()
    const token = randomUUID()
    const claimed = connection.prepare(`
      UPDATE order_notifications
      SET attempts = attempts + 1, lease_token = ?, lease_until = ?
      WHERE id = ? AND resource_type = 'order'
        AND sent_at IS NULL AND available_at <= ? AND lease_until <= ?
    `).run(token, now + LEASE_MS, id, now, now)
    if (claimed.changes !== 1) return null
    return connection.prepare(`
      SELECT n.id, n.user_id, n.resource_type, n.resource_id, n.event,
             n.attempts, n.lease_token,
             COALESCE(NULLIF(o.delivery_email, ''), u.email) AS email,
             o.imei, o.unlock_code, o.result_json
      FROM order_notifications n
      JOIN users u ON u.id = n.user_id
      LEFT JOIN orders o
        ON n.resource_type = 'order' AND o.id = n.resource_id AND o.user_id = n.user_id
      WHERE n.id = ?
    `).get(id) as NotificationRow
  }).immediate()
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}

function parsedResult(value: string | null): Record<string, unknown> {
  if (!value) return {}
  try {
    const parsed = JSON.parse(value) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, unknown>
  } catch {
    return {}
  }
}

function unlockResultText(row: NotificationRow): string {
  const stored = parsedResult(row.result_json)
  const customerResult = Object.fromEntries(
    Object.entries(stored).filter(([key]) => key.toLowerCase() !== 'source'),
  )
  const lines = [
    row.imei ? `IMEI: ${row.imei}` : '',
    row.unlock_code ? `Unlock code: ${row.unlock_code}` : '',
    providerCodeFromData(customerResult),
  ].filter(Boolean)
  return normalizeProviderCode(lines.join('\n'))
}

function notificationMessage(row: NotificationRow) {
  let origin = publicOrigin()
  if (!/^https?:\/\//i.test(origin)) origin = 'https://iunlockmobile.com'
  const accountUrl = new URL(`/user/orders/${row.resource_id}`, origin).href

  if (row.event === 'rejected') {
    const message = 'The provider could not complete this unlock request. The reserved credit has been returned to your available balance.'
    return {
      subject: `Unlock order #${row.resource_id} was rejected — credit returned`,
      html: `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(accountUrl)}">View order</a></p>`,
      text: `${message}\n\nView order: ${accountUrl}`,
    }
  }

  const result = unlockResultText(row)
  if (!result) throw new Error('Unlock result is unavailable for email delivery.')
  const intro = 'Your unlock result is ready.'
  return {
    subject: `Unlock order #${row.resource_id} is complete`,
    html: `<p>${escapeHtml(intro)}</p><pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:16px;border:1px solid #dbe3ec;border-radius:10px;background:#f7f9fc;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace">${escapeHtml(result)}</pre><p><a href="${escapeHtml(accountUrl)}">View order</a></p>`,
    text: `${intro}\n\n${result}\n\nView order: ${accountUrl}`,
  }
}

/**
 * Run from the existing Provider polling worker with the same database and email configuration.
 * Delivery is at least once: a crash after Resend accepts an email but before
 * our acknowledgement requires retry. A stable Resend idempotency key suppresses
 * duplicate deliveries within its 24-hour window; it is not an exactly-once claim.
 */
export async function deliverOrderNotifications(limit = 20): Promise<NotificationDeliverySummary> {
  const connection = db()
  if (connection.inTransaction) {
    throw new Error('Notification delivery must run outside a database transaction.')
  }
  const boundedLimit = Number.isFinite(limit) ? Math.max(1, Math.min(MAX_BATCH, Math.floor(limit))) : 20
  const suppressed = suppressCheckNotifications()
  const now = Date.now()
  const candidates = connection.prepare(`
    SELECT id FROM order_notifications
    WHERE resource_type = 'order'
      AND sent_at IS NULL AND available_at <= ? AND lease_until <= ?
    ORDER BY available_at, id LIMIT ?
  `).all(now, now, boundedLimit) as Array<{ id: number }>
  const summary: NotificationDeliverySummary = { claimed: 0, sent: 0, failed: 0, leaseLost: 0, suppressed }

  for (const { id } of candidates) {
    const row = claimNotification(id)
    if (!row) continue
    summary.claimed += 1
    let failure: string | null = null
    try {
      if (!emailDeliveryConfigured()) {
        failure = 'delivery_unconfigured'
      } else {
        const message = notificationMessage(row)
        await sendTransactionalEmail(row.email, message.subject, message.html, message.text, {
          idempotencyKey: `settlement/order/${row.resource_id}/${row.event}`,
        })
      }
    } catch {
      failure = 'email_delivery_failed'
    }

    if (failure) {
      const delayMs = Math.min(3_600_000, 30_000 * 2 ** Math.min(row.attempts - 1, 7))
      const changed = connection.prepare(`
        UPDATE order_notifications SET available_at = ?, last_error = ?, lease_token = NULL, lease_until = 0
        WHERE id = ? AND lease_token = ? AND sent_at IS NULL
      `).run(Date.now() + delayMs, failure, row.id, row.lease_token)
      if (changed.changes === 1) summary.failed += 1
      else summary.leaseLost += 1
    } else {
      const changed = connection.prepare(`
        UPDATE order_notifications SET sent_at = datetime('now'), last_error = NULL, lease_token = NULL, lease_until = 0
        WHERE id = ? AND lease_token = ? AND sent_at IS NULL
      `).run(row.id, row.lease_token)
      if (changed.changes === 1) summary.sent += 1
      else summary.leaseLost += 1
    }
  }
  return summary
}
