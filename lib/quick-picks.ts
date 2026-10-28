import type { IconName } from '@/components/icons'
import type { PublicProviderProduct } from './public-provider-catalog'
import { serviceText } from './unlock-catalog-view'

export type QuickPick = {
  product: PublicProviderProduct
  icon: IconName
  /** The two-word name a buyer knows it by. */
  short: string
  /** The line under it: who it is for. */
  kicker: string
}

/* The reports most buyers reach for first, found by name so the chips
   follow the catalog rather than a hard-coded code. A pattern that finds
   nothing today simply has no chip. */
const WANTED: Array<{ pattern: RegExp; icon: IconName; short: string; kicker: string }> = [
  { pattern: /black ?list/i, icon: 'shield', short: 'Blacklist', kicker: 'Any brand' },
  { pattern: /carrier|sim ?lock|network|unlock status/i, icon: 'lock', short: 'Carrier & lock', kicker: 'Apple devices' },
  { pattern: /warranty|basic|info|activation/i, icon: 'device', short: 'Device facts', kicker: 'Model, warranty, dates' },
  { pattern: /knox|samsung/i, icon: 'grid', short: 'Samsung Knox', kicker: 'Knox Guard & lock' },
]

export function quickPicks(products: PublicProviderProduct[], max = WANTED.length): QuickPick[] {
  const picks: QuickPick[] = []
  for (const want of WANTED) {
    const product = products.find(
      (entry) => entry.status === 'available' && entry.priceAvailable !== false && want.pattern.test(serviceText(entry.name)) && !picks.some((pick) => pick.product === entry),
    )
    if (product) picks.push({ product, icon: want.icon, short: want.short, kicker: want.kicker })
    if (picks.length >= max) break
  }
  return picks
}

/** The report a landing page shows as its sample: the blacklist check if
 * one is listed, because that is the report the page is sold on. */
export function preferredSample<T extends { product: PublicProviderProduct }>(entries: T[]): T | undefined {
  return entries.find((entry) => /black ?list/i.test(entry.product.name)) ?? entries[0]
}
