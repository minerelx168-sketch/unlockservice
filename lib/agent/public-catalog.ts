/**
 * The only gate between the provider catalog and machine-readable surfaces
 * (/llms.txt, /llms-full.txt, /openapi.json, /api/agent/*, /api/mcp).
 *
 *   PUBLIC     — may be listed and quoted to crawlers and agents
 *   AUTH_ONLY  — exists for signed-in customers behind /api/user/unlock-more-services
 *   DISABLED   — never sold, never listed
 *
 * Anything not provably PUBLIC is excluded (fail closed).
 */
import { isMemberUnlock } from '../member-unlocks'

/** LOST (926, 25), Owner ID (661, 904, 702, 696), duplicate SKU (718). */
export const DISABLED_SERVICE_IDS = ['926', '25', '661', '904', '702', '696', '718'] as const
/** MDM / no-signal services and AT&T Past Due (1000): signed-in customers only. */
export const AUTH_ONLY_SERVICE_IDS = ['966', '967', '780', '1001', '344', '721', '430', '893', '931', '1000'] as const

/** Words that must never appear in an agent-facing response. */
export const FORBIDDEN_AGENT_TERMS = [/\bLOST\b/, /Owner ID/i, /Bypass/i, /\bMDM\b/i, /Past Due/i, /bit\.ly/i]

const blocked = new Set<string>([...DISABLED_SERVICE_IDS, ...AUTH_ONLY_SERVICE_IDS])

export type CatalogVisibility = 'PUBLIC' | 'AUTH_ONLY' | 'DISABLED'

export function serviceVisibility(row: { serviceId: string; productCode: string; name?: string; status?: string }): CatalogVisibility {
  if ((DISABLED_SERVICE_IDS as readonly string[]).includes(row.serviceId)) return 'DISABLED'
  if ((AUTH_ONLY_SERVICE_IDS as readonly string[]).includes(row.serviceId) || isMemberUnlock(row.productCode)) return 'AUTH_ONLY'
  if (row.status !== undefined && row.status !== 'available') return 'DISABLED'
  if (row.name && FORBIDDEN_AGENT_TERMS.some(term => term.test(row.name!))) return 'AUTH_ONLY'
  return 'PUBLIC'
}

export function isPublicAgentService(row: { serviceId: string; productCode: string; name?: string; status?: string }): boolean {
  return !blocked.has(row.serviceId) && serviceVisibility(row) === 'PUBLIC'
}

/** Returns the forbidden terms present in an agent-facing payload (empty = clean). */
export function forbiddenTermsIn(text: string): string[] {
  return FORBIDDEN_AGENT_TERMS.filter(term => term.test(text)).map(term => term.source)
}
