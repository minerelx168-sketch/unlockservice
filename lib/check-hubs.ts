import type { Phase2Key } from './i18n/phase2'
import { POLICY_SOURCES } from './unlock-policy-2026'

/**
 * The three 2026 check-only hubs. Each sells only diagnostic reports that are
 * live in the catalog; none claims an unlock for its own carrier.
 */
export const HUB_SLUGS = ['cricket-wireless', 'verizon-us', 't-mobile-us'] as const
export type HubSlug = (typeof HUB_SLUGS)[number]
export const HUB_PREFIXES = ['', '/es', '/fr-ca', '/pt', '/de', '/ar'] as const

export type HubConfig = {
  carrier: 'cricket' | 'verizon' | 'tmobile'
  title: Phase2Key
  summary: Phase2Key
  /** Report codes offered in the above-the-fold form, first is the default. */
  checks: string[]
  rows: Array<[Phase2Key, Phase2Key]>
  sources: readonly string[]
  honesty: { heading: Phase2Key; body: Phase2Key }
  waitlist?: boolean
  updated: string
}

export const HUBS: Record<HubSlug, HubConfig> = {
  'cricket-wireless': {
    carrier: 'cricket',
    title: 'Cricket Wireless unlock rules 2026: the 365-day policy and carrier check',
    summary: 'From July 1, 2026, Cricket requires 365 days (12 months) of paid service on the device before it unlocks a phone bought on or after that date. Phones bought before July 1, 2026 keep the earlier six-month rule. Requests go through the myCricket app or Cricket’s unlock page.',
    checks: ['APPLE_CARRIER_LITE', 'APPLE_CARRIER_PRO'],
    rows: [
      ['Bought before July 1, 2026', 'Six months of paid service on the device'],
      ['Bought on or after July 1, 2026', '365 days of paid service on the device'],
      ['All devices', 'Not reported lost, stolen or linked to fraud; request through the myCricket app or Cricket’s unlock page'],
    ],
    sources: POLICY_SOURCES.cricket,
    honesty: { heading: 'Cricket or AT&T? Check before you buy', body: 'A used iPhone that shows SIM Locked could be locked to Cricket (a 365-day wait for newer phones) or to its parent network AT&T. A clean AT&T iPhone can be unlocked now through our AT&T service at {att}. Run the {price} Apple Carrier Lite check first to see which network the phone is actually locked to before paying a seller or ordering an unlock.' },
    updated: '2026-11-13',
  },
  'verizon-us': {
    carrier: 'verizon',
    title: 'Verizon and Straight Talk unlock rules 2026: 60 days vs 365 days, and what to check first',
    summary: 'Verizon postpaid phones bought on or after January 27, 2026 unlock automatically once paid in full; earlier purchases follow the 60-day rule. Verizon prepaid brands, including Straight Talk and TracFone, now require 365 days of paid, active service for phones activated on or after January 20, 2026, replacing the earlier 60-day rule.',
    checks: ['VERIZON_USA_PRO', 'APPLE_CARRIER_LITE'],
    rows: [
      ['Postpaid, bought on or after January 27, 2026', 'Unlocks automatically once the device is paid in full through a secure payment method'],
      ['Postpaid, bought before January 27, 2026', '60 days after purchase'],
      ['Prepaid / Straight Talk / TracFone, activated on or after January 20, 2026', '365 days of paid, active service'],
      ['Prepaid, activated before January 20, 2026', '60 days after activation'],
    ],
    sources: [...POLICY_SOURCES.verizon, ...POLICY_SOURCES.straightTalk],
    honesty: { heading: 'No legitimate shortcut — so check before you buy', body: 'There is no lawful third-party shortcut around a Verizon lock, and iUnlockMobile does not sell Verizon unlocks. Before paying for a used phone sold as an unlocked Verizon device, run the Verizon USA status check ({verizon}) for clean, lost or financed status together with the Apple Carrier Lite check ({price}) to see whether a prepaid 365-day lock still applies.' },
    updated: '2026-11-13',
  },
  't-mobile-us': {
    carrier: 'tmobile',
    title: 'T-Mobile and Metro unlock rules 2026: 40-day and 365-day requirements, and a status check',
    summary: 'T-Mobile postpaid phones must be active on the network for at least 40 days, with device financing paid off in full and no balance due. T-Mobile prepaid phones need 365 days since activation, or a refill-based exception with extra conditions. Metro by T-Mobile requires 365 days.',
    checks: ['TMOBILE_USA', 'APPLE_CARRIER_LITE'],
    rows: [
      ['Postpaid', 'At least 40 days active on the network, device financing paid off, zero balance'],
      ['Prepaid', '365 days since activation, or a refill-based exception with extra conditions'],
      ['Metro by T-Mobile', '365 days of active service'],
    ],
    sources: POLICY_SOURCES.tmobile,
    honesty: { heading: 'We do not sell T-Mobile USA unlocks', body: 'To protect buyers from sites that take payment for an unlock they cannot deliver, iUnlockMobile does not sell T-Mobile USA unlocks. Before paying a seller cash, run the T-Mobile USA status check ({tmobile}) for financing (EIP) and blacklist status, and the Apple Carrier Lite check ({price}) for the lock.' },
    waitlist: true,
    updated: '2026-11-13',
  },
}

export const isHubSlug = (value: string): value is HubSlug => (HUB_SLUGS as readonly string[]).includes(value)
export const hubPath = (slug: HubSlug, prefix: string = '') => `${prefix}/check/${slug}`
/** hreflang map in the same shape as the rest of the site's language links. */
export function hubLanguages(slug: HubSlug): Record<string, string> {
  const tags = ['en-US', 'es-MX', 'fr-CA', 'pt-BR', 'de-AT', 'ar']
  return Object.fromEntries([...tags.map((tag, index) => [tag, hubPath(slug, HUB_PREFIXES[index])]), ['x-default', hubPath(slug)]])
}
/** Service IDs whose Product schema each hub carries. */
export const HUB_SCHEMA_IDS: Record<HubSlug, string[]> = { 'cricket-wireless': ['444', '445', '346'], 'verizon-us': ['423', '444'], 't-mobile-us': ['688', '444'] }
