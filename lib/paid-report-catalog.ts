export type PaidReportProductSeed = {
  code: string
  slug: string
  name: string
  summary: string
  inputType: 'imei'
  priceCents: number
  providerCostMicros: number
  etaMinutes: number
  isActive: boolean
  sortOrder: number
}

/**
 * Curated candidate products adapted from the imeihub production catalog.
 *
 * The customer price is an integer-cent snapshot from the user-supplied selling
 * price catalog, not an activation. Every row is intentionally seeded inactive.
 * An operator must explicitly approve activation and add the matching Provider
 * service map before it can accept money or make a Provider request.
 */
export const PAID_REPORT_PRODUCTS: PaidReportProductSeed[] = [
  {
    code: 'APPLE_ICLOUD_STATUS',
    slug: 'apple-icloud-status',
    name: 'Apple iCloud ON / OFF',
    summary: 'Checks whether Find My activation lock is reported as on or off.',
    inputType: 'imei',
    priceCents: 1,
    providerCostMicros: 8_000,
    etaMinutes: 1,
    isActive: false,
    sortOrder: 10,
  },
  {
    code: 'BLACKLIST_SIMPLE',
    slug: 'blacklist-simple',
    name: 'Worldwide Blacklist — Simple',
    summary: 'Returns the current worldwide blacklist status reported by the Provider.',
    inputType: 'imei',
    priceCents: 1,
    providerCostMicros: 8_000,
    etaMinutes: 1,
    isActive: false,
    sortOrder: 20,
  },
  {
    code: 'APPLE_BASIC',
    slug: 'apple-basic',
    name: 'Apple Basic Info',
    summary: 'Model and supported device-state fields returned by the Provider.',
    inputType: 'imei',
    priceCents: 5,
    providerCostMicros: 30_000,
    etaMinutes: 1,
    isActive: false,
    sortOrder: 30,
  },
  {
    code: 'APPLE_WARRANTY',
    slug: 'apple-warranty',
    name: 'Apple Warranty & Activation',
    summary: 'Activation, coverage and purchase-date fields returned by the Provider.',
    inputType: 'imei',
    priceCents: 4,
    providerCostMicros: 15_000,
    etaMinutes: 1,
    isActive: false,
    sortOrder: 40,
  },
  {
    code: 'APPLE_CARRIER_LITE',
    slug: 'apple-carrier-lite',
    name: 'Apple Carrier Lite',
    summary: 'Carrier, activation-policy and SIM-lock fields returned by the Provider.',
    inputType: 'imei',
    priceCents: 6,
    providerCostMicros: 40_000,
    etaMinutes: 1,
    isActive: false,
    sortOrder: 50,
  },
  {
    code: 'BLACKLIST_FULL',
    slug: 'blacklist-full',
    name: 'Worldwide Blacklist — Full',
    summary: 'Blacklist status plus supported source, country, date and reason fields.',
    inputType: 'imei',
    priceCents: 5,
    providerCostMicros: 40_000,
    etaMinutes: 5,
    isActive: false,
    sortOrder: 60,
  },
  {
    code: 'SAMSUNG_INFO',
    slug: 'samsung-info',
    name: 'Samsung Info',
    summary: 'Model, warranty, carrier and country fields returned by the Provider.',
    inputType: 'imei',
    priceCents: 5,
    providerCostMicros: 30_000,
    etaMinutes: 1,
    isActive: false,
    sortOrder: 70,
  },
  {
    code: 'PIXEL_INFO',
    slug: 'pixel-info',
    name: 'Google Pixel Info',
    summary: 'Model, purchase, warranty and device-age fields returned by the Provider.',
    inputType: 'imei',
    priceCents: 10,
    providerCostMicros: 100_000,
    etaMinutes: 1,
    isActive: false,
    sortOrder: 80,
  },
]
