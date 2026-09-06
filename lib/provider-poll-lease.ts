import { randomUUID } from 'node:crypto'
import { db } from './db'
import { providerConfiguration } from './provider-api'

type PollResource = 'order' | 'imei_check' | 'paid_imei_report'

/**
 * The browser and worker share this claim before either contacts a provider.
 * The lease survives process boundaries and expires if a process is killed.
 * Allow the provider's full timeout plus a margin before another poll can run.
 */
export function claimProviderPoll(resource: PollResource, id: number): (() => void) | null {
  const now = Date.now()
  const token = randomUUID()
  const expiresAt = now + providerConfiguration().timeoutMs + 5_000
  const claimed = db().prepare(`
    INSERT INTO provider_poll_leases (resource_type, resource_id, token, expires_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(resource_type, resource_id) DO UPDATE
      SET token = excluded.token, expires_at = excluded.expires_at
      WHERE provider_poll_leases.expires_at <= ?
  `).run(resource, id, token, expiresAt, now)
  if (claimed.changes !== 1) return null

  // Remove only our own claim: an expired owner must not delete a newer lease.
  return () => {
    db().prepare(`
      DELETE FROM provider_poll_leases
      WHERE resource_type = ? AND resource_id = ? AND token = ?
    `).run(resource, id, token)
  }
}
