// Read the first checkout snapshot, not the most recent browser click on a retry.
// An identifier is optional metadata: it must never determine payment acceptance.
import { validateClickId } from './attribution'
import { db } from './db'
import type { ConsentChoice } from './ga4'

export function whopClickMetadata(kind: 'guest' | 'topup', reference: string, consent: ConsentChoice): Record<string, string> {
  if (consent !== 'granted') return {}
  try {
    const row = db().prepare(`SELECT c.gclid FROM ga4_checkout_context c
      WHERE c.kind=? AND c.reference=? AND c.consent='granted' AND c.internal=0
      AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id=c.user_id AND u.account_type='admin')`).get(kind, reference) as { gclid: string | null } | undefined
    const gclid = validateClickId(row?.gclid)
    return gclid ? { gclid } : {}
  } catch { return {} }
}
