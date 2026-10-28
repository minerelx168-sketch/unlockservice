/** Display grouping only. The processing domain, price and availability stay on the product. */
export type ServiceDomain = 'imei_check' | 'unlock'

export const SERVICE_GROUPS: Record<ServiceDomain, readonly string[]> = {
  imei_check: [
    'Featured',
    'Apple IMEI Check',
    'GSX Services (Instant)',
    'GSX Services',
    'GSX Services (Picture)',
    'Status Check Services',
    'Other IMEI Check',
    'Number Check HLR & PING',
  ],
  unlock: [
    'Icloud Bad Case Remove Service',
    'iCloud Remove Service',
    'MDM Remove Service',
    '***HOT SERVICES***',
    'Xiaomi',
    'MDM Bypass',
    'iCloud ID Find Services',
    'USA Networks',
    'United Kingdom Networks',
    'Canada Networks',
    'Austria Networks',
    'Japan Networks',
    'Romania Network',
    'Nokia',
    'Alcatel',
    'HTC',
    'Motorola',
    'Sony',
    'LG',
  ],
}

export function serviceGroupLabel(value: string) {
  return value.replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '').replace(/\s{2,}/g, ' ').trim()
}

function groupKey(value: string) {
  return serviceGroupLabel(value).toLowerCase()
}

export function storefrontDomain(product: { group: string; domain: ServiceDomain }): ServiceDomain {
  const key = groupKey(product.group)
  if (SERVICE_GROUPS.imei_check.some((group) => groupKey(group) === key)) return 'imei_check'
  if (SERVICE_GROUPS.unlock.some((group) => groupKey(group) === key)) return 'unlock'
  return product.domain
}

/** Stable group order shared by every customer service selector and catalog. */
export function groupServices<T extends { group: string }>(products: readonly T[]) {
  const order = [...SERVICE_GROUPS.imei_check, ...SERVICE_GROUPS.unlock]
  const positions = new Map(order.map((group, index) => [groupKey(group), index]))
  const groups = new Map<string, { group: string; products: T[] }>()
  for (const product of products) {
    const key = groupKey(product.group)
    if (!groups.has(key)) groups.set(key, { group: serviceGroupLabel(product.group), products: [] })
    groups.get(key)!.products.push(product)
  }
  return [...groups.values()].sort((left, right) => {
    const a = positions.get(groupKey(left.group)) ?? order.length
    const b = positions.get(groupKey(right.group)) ?? order.length
    return a - b || left.group.localeCompare(right.group, 'en')
  })
}
