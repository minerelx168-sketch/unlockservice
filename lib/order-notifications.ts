import { randomUUID } from 'node:crypto'
import { emailDeliveryConfigured, sendTransactionalEmail } from './account-security'
import { db } from './db'
import { publicOrigin } from './site'

type ResourceType = 'order' | 'paid_imei_report'
type SettlementEvent = 'success' | 'rejected'

type NotificationRow = {
  id: number
  user_id: number
  resource_type: ResourceType
  resource_id: number
  event: SettlementEvent
  attempts: number
  lease_token: string
  email: string
}

export type NotificationDeliverySummary = {
  claimed: number
  sent: number
  failed: number
  leaseLost: number
}

// Each email has a 10-second transport deadline. Claim only when it is about
// to be sent, so later entries in a batch do not expire while awaiting their turn.
const LEASE_MS = 30_000
const MAX_BATCH = 100

/**
 * Call synchronously inside the transaction that settles credit and the order.
 * A rollback then removes the event too; a duplicate callback cannot enqueue
 * another copy of the same event. No network work belongs in this transaction.
 */
export function enqueueOrderNotification(
  resourceType: ResourceType,
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

function claimNotification(id: number): NotificationRow | null {
  const connection = db()
  return connection.transaction(() => {
    const now = Date.now()
    const token = randomUUID()
    const claimed = connection.prepare(`
      UPDATE order_notifications
      SET attempts = attempts + 1, lease_token = ?, lease_until = ?
      WHERE id = ? AND sent_at IS NULL AND available_at <= ? AND lease_until <= ?
    `).run(token, now + LEASE_MS, id, now, now)
    if (claimed.changes !== 1) return null
    return connection.prepare(`
      SELECT n.id, n.user_id, n.resource_type, n.resource_id, n.event,
             n.attempts, n.lease_token, u.email
      FROM order_notifications n JOIN users u ON u.id = n.user_id
      WHERE n.id = ?
    `).get(id) as NotificationRow
  }).immediate()
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]!)
}

function notificationMessage(row: NotificationRow) {
  // Never trust request Host headers, callback URLs, or provider HTML in email.
  // Reject non-web configured schemes; users can always sign in to the default site.
  let origin = publicOrigin()
  if (!/^https?:\/\//i.test(origin)) origin = 'https://iunlockmobile.com'
  const path = row.resource_type === 'order'
    ? `/user/orders/${row.resource_id}`
    : `/user/reports/${row.resource_id}`
  const accountUrl = new URL(path, origin).href
  const kind = row.resource_type === 'order' ? 'Order' : 'IMEI report'
  const subject = row.event === 'success'
    ? `${kind} #${row.resource_id} is complete`
    : `${kind} #${row.resource_id} was rejected — credit returned`
  const message = row.event === 'success'
    ? 'Your result is ready. Sign in to your account to view it.'
    : 'The provider could not complete this request. The reserved credit has been returned to your available balance.'
  // No IMEI, unlock code, provider response, or other sensitive result leaves
  // the authenticated account page via a notification email.
  return {
    subject,
    html: `<p>${escapeHtml(message)}</p><p><a href="${escapeHtml(accountUrl)}">View in your account</a></p>`,
    text: `${message}\n\nView in your account: ${accountUrl}`,
  }
}

/**
 * Run from a scheduled worker with the same database and email configuration.
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
  const now = Date.now()
  // Snapshot a bounded set. A failed entry cannot be retried again in this batch,
  // and a competing worker must still acquire its own lease for each candidate.
  const candidates = connection.prepare(`
    SELECT id FROM order_notifications
    WHERE sent_at IS NULL AND available_at <= ? AND lease_until <= ?
    ORDER BY available_at, id LIMIT ?
  `).all(now, now, boundedLimit) as Array<{ id: number }>
  const summary: NotificationDeliverySummary = { claimed: 0, sent: 0, failed: 0, leaseLost: 0 }

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
          idempotencyKey: `settlement/${row.resource_type}/${row.resource_id}/${row.event}`,
        })
      }
    } catch {
      // Do not persist provider errors that may echo email addresses or secrets.
      failure = 'email_delivery_failed'
    }

    if (failure) {
      // Capped exponential backoff; pending events remain recoverable when mail
      // configuration or the provider comes back, without a tight retry loop.
      const delayMs = Math.min(3_600_000, 30_000 * 2 ** Math.min(row.attempts - 1, 7))
      const changed = connection.prepare(`
        UPDATE order_notifications SET available_at = ?, last_error = ?, lease_token = NULL, lease_until = 0
        WHERE id = ? AND lease_token = ? AND sent_at IS NULL
      `).run(Date.now() + delayMs, failure, row.id, row.lease_token)
      if (changed.changes === 1) summary.failed += 1
      else summary.leaseLost += 1
    } else {
      // A stale worker cannot acknowledge or clear a replacement worker's lease.
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
