import { randomUUID } from 'node:crypto'
import { db } from './db'
import { ENGAGEMENT_PAGES } from './engagement-pages'

export class EngagementError extends Error {}
let lastPruned = 0
export function recordEngagement(userId: number, input: Record<string, unknown>, now = Date.now()): { userId: string; activeMs: number } {
  if (typeof input.visitId !== 'string' || !/^[a-f0-9-]{36}$/.test(input.visitId)
    || typeof input.page !== 'string' || !(ENGAGEMENT_PAGES as readonly string[]).includes(input.page)
    || !Number.isSafeInteger(input.activeMs) || (input.activeMs as number) < 0 || (input.activeMs as number) > 3_600_000) throw new EngagementError('Invalid activity.')
  return db().transaction(() => {
    const person = db().prepare("SELECT id FROM users WHERE id=? AND account_type!='admin' AND status='active' AND banned_at IS NULL").get(userId)
    if (!person) throw new EngagementError('Customer account required.')
    db().prepare('INSERT INTO analytics_identities(user_id,analytics_id) VALUES (?,?) ON CONFLICT(user_id) DO NOTHING').run(userId, 'u_' + randomUUID().replaceAll('-',''))
    const identity = db().prepare('SELECT analytics_id FROM analytics_identities WHERE user_id=?').get(userId) as { analytics_id: string }
    const existing = db().prepare('SELECT user_id,page,active_ms,started_at FROM customer_page_visits WHERE visit_id=?').get(input.visitId) as { user_id: number; page: string; active_ms: number; started_at: string } | undefined
    if (existing && (existing.user_id !== userId || existing.page !== input.page)) throw new EngagementError('Activity does not match this session.')
    const at = new Date(now).toISOString()
    const elapsed = existing ? Math.max(0,now-Date.parse(existing.started_at)) : 0
    const activeMs = existing ? Math.max(existing.active_ms,Math.min(input.activeMs as number,elapsed + 5_000)) : 0
    db().prepare(`INSERT INTO customer_page_visits(visit_id,user_id,page,active_ms,started_at,last_seen_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(visit_id) DO UPDATE SET active_ms=excluded.active_ms,last_seen_at=excluded.last_seen_at`).run(input.visitId,userId,input.page,activeMs,at,at)
    if (now-lastPruned>3_600_000) {
      db().prepare("DELETE FROM customer_page_visits WHERE visit_id IN (SELECT visit_id FROM customer_page_visits WHERE started_at < ? LIMIT 1000)").run(new Date(now-90*86_400_000).toISOString())
      lastPruned=now
    }
    return { userId: identity.analytics_id, activeMs }
  })()
}
