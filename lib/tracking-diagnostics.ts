import { db } from './db'

/** Operational diagnostics only; no browser identifiers or customer input. */
export function recordTrackingCapture(kind: 'topup' | 'order' | 'paid_imei_report', reference: string, userId: number, input: unknown, consent: boolean, enabled = true) {
  const user = db().prepare('SELECT account_type FROM users WHERE id=?').get(userId) as {account_type:string} | undefined
  if (!user || user.account_type === 'admin') return
  const context = input && typeof input === 'object' ? input as Record<string,unknown> : {}
  const valid = typeof context.clientId === 'string' && /^\d{1,20}\.\d{1,20}$/.test(context.clientId)
    && typeof context.sessionId === 'string' && /^\d{1,12}$/.test(context.sessionId) && Number(context.sessionId)>0
  const reason = !consent ? 'consent_not_granted' : !enabled ? 'server_tracking_disabled' : !valid ? 'browser_context_missing' : 'context_received'
  db().prepare("DELETE FROM tracking_capture_diagnostics WHERE created_at<datetime('now','-90 days')").run()
  db().prepare('INSERT OR IGNORE INTO tracking_capture_diagnostics(kind,reference,user_id,reason) VALUES(?,?,?,?)').run(kind,reference,userId,reason)
}
