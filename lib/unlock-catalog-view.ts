import type { PublicProviderProduct } from './public-provider-catalog'

export function serviceText(value: string): string {
  return value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s{2,}/g, ' ').trim()
}

// Country labels describe the supplied service coverage, not an IMEI lookup result.
const COUNTRY_GROUPS: Record<string, string> = {
  'USA Networks': 'United States',
  'United Kingdom Networks': 'United Kingdom',
  'Canada Networks': 'Canada',
  'Austria Networks': 'Austria',
  'Japan Networks': 'Japan',
  'Romania Network': 'Romania',
}

export function unlockCategory(product: PublicProviderProduct): string {
  if (product.productCode === 'UNLOCK_346') return 'United States'
  if (product.productCode === 'UNLOCK_212') return 'EMEA'
  const group = serviceText(product.group)
  return COUNTRY_GROUPS[group] ?? (group.replace(/^\*+|\*+$/g, '').trim() || 'Other services')
}

export function unlockCategories(products: PublicProviderProduct[]): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>()
  for (const product of products) {
    const name = unlockCategory(product)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  // Explicit locale keeps server and browser ordering identical.
  return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, 'en'))
}

export function filterUnlockProducts(products: PublicProviderProduct[], category: string, query: string): PublicProviderProduct[] {
  const terms = query.trim().toLocaleLowerCase('en').split(/\s+/).filter(Boolean)
  return products.filter((product) => {
    if (category && unlockCategory(product) !== category) return false
    const text = serviceText(`${product.name} ${product.group} ${unlockCategory(product)} ${product.summary}`).toLocaleLowerCase('en')
    return terms.every((term) => text.includes(term))
  })
}

// Preview the owner's currently orderable carrier services in catalog priority,
// with one per country. Do not seed example products or expose the full catalog.
export function unlockPreviewProducts(products: PublicProviderProduct[]): PublicProviderProduct[] {
  const countries = new Set(Object.values(COUNTRY_GROUPS))
  const selected = new Set<string>()
  return products.filter((product) => {
    const category = unlockCategory(product)
    if (product.domain !== 'unlock' || product.status !== 'available' || !countries.has(category) || selected.has(category) || selected.size >= 4) return false
    selected.add(category)
    return true
  })
}
