import { PROVIDER_PRODUCTS, type ProviderProduct } from './provider-products'
import { isMemberUnlock } from './member-unlocks'
import { DISABLED_PRODUCT_CODES } from './retail-update-nov12'

/**
 * OpenAI Agentic Commerce product feed (file-upload spec: one row per product,
 * nine required fields, no placeholders). Only PUBLIC services are eligible:
 * available in the catalog, not retired (DISABLED), not members-only
 * (AUTH_ONLY), priced, and accepted by checkout right now. The price is the
 * base price shown on `url`; the card fee is disclosed in the description.
 */
export const FEED_BRAND = 'iUnlockMobile'
export const FEED_FIELDS = ['item_id', 'title', 'description', 'url', 'brand', 'seller_name', 'image_url', 'availability', 'price'] as const
export const FEED_FLAGS = ['enable_search', 'enable_checkout'] as const
export type FeedRow = Record<(typeof FEED_FIELDS)[number], string> & Record<(typeof FEED_FLAGS)[number], 'true' | 'false'>

/** Never publishable, whatever the catalog says (retired, members-only or restricted). */
export const BLOCKED_SERVICE_IDS: ReadonlySet<string> = new Set(['718', '1000', '926', '25', '661', '904', '702', '696', '966', '967', '780', '1001', '344', '721', '430', '893', '931'])

type FeedEntry = { serviceId: string; path: string; title: string; description: string }
const CHECK = '/services/imei-check/apple-carrier-lock-status'

/** Curated, factual copy per service. Order is the feed order. */
export const FEED_ENTRIES: readonly FeedEntry[] = [
  { serviceId: '444', path: CHECK, title: 'Apple iPhone Carrier Lock Status Check (Lite) — Instant IMEI Report', description: 'Reports the carrier (network) policy and SIM-lock status recorded for an Apple iPhone or iPad by IMEI. A report only: it does not unlock the device or check theft reports.' },
  { serviceId: '445', path: CHECK, title: 'Apple iPhone Carrier Lock Status Check (Pro) — Carrier, SIM Lock and iCloud Status', description: 'Reports the carrier policy, SIM-lock status, iCloud (Find My) status and SIM configuration for an Apple device by IMEI. A report only: it does not unlock the device.' },
  { serviceId: '66', path: '/services/imei-check/blacklist-status', title: 'GSMA Blacklist Full Check — Worldwide IMEI Blacklist Status Report', description: 'Worldwide GSMA blacklist report by IMEI for any brand: whether the device is reported missing or stolen at the time of the lookup. It does not certify ownership or paid-off financing.' },
  { serviceId: '688', path: '/check/t-mobile-us', title: 'T-Mobile USA IMEI Status Check — Financing (EIP) and Blacklist Report', description: 'T-Mobile USA status report by IMEI showing financing (EIP) and blacklist status before you buy a used phone. A status report only; iUnlockMobile does not sell T-Mobile USA unlocks.' },
  { serviceId: '423', path: '/check/verizon-us', title: 'Verizon USA IMEI Status Check — Clean, Blacklisted or Financed Report', description: 'Verizon USA status report by IMEI showing whether the device is clean, blacklisted or still financed. A status report only; iUnlockMobile does not sell Verizon unlocks.' },
  { serviceId: '346', path: '/services/unlock/us', title: 'AT&T USA iPhone Unlock (Clean Devices) — Status Check and Permanent Unlock', description: 'AT&T USA status check and permanent carrier unlock for clean iPhones and phones: not blacklisted, not active on another AT&T account and no unpaid device balance. Card orders are refunded in full if AT&T refuses.' },
  { serviceId: '649', path: '/services/unlock/us', title: 'C Spire USA iPhone Unlock (Clean Devices)', description: 'Permanent C Spire USA carrier unlock for clean iPhones. Card orders are refunded in full if the carrier refuses.' },
  { serviceId: '289', path: '/services/unlock/canada', title: 'Vidéotron Canada iPhone Unlock (All Models, Premium)', description: 'Permanent Vidéotron Canada carrier unlock for iPhone, all models. Card orders are refunded in full if the carrier refuses.' },
  { serviceId: '39', path: '/services/unlock/canada', title: 'Telus / Koodo Canada iPhone Unlock (All Models, Clean Devices)', description: 'Permanent Telus or Koodo Canada carrier unlock for clean iPhones, all models. Card orders are refunded in full if the carrier refuses.' },
  { serviceId: '36', path: '/services/unlock/canada', title: 'Rogers / Fido Canada iPhone Unlock (All Models, Clean Devices)', description: 'Permanent Rogers or Fido Canada carrier unlock for clean iPhones, all models. Card orders are refunded in full if the carrier refuses.' },
  { serviceId: '329', path: '/services/unlock/canada', title: 'SaskTel Canada iPhone Unlock (All Models, Clean Devices)', description: 'Permanent SaskTel Canada carrier unlock for clean iPhones, all models. Card orders are refunded in full if the carrier refuses.' },
  { serviceId: '48', path: '/services/unlock/uk', title: 'EE / Orange / T-Mobile UK iPhone Unlock (Clean, 6+ Months Old)', description: 'Permanent EE, Orange or T-Mobile UK carrier unlock for clean iPhones at least six months old, all models. Card orders are refunded in full if the carrier refuses.' },
  { serviceId: '49', path: '/services/unlock/uk', title: 'EE / Orange / T-Mobile UK iPhone Unlock (XR to 14 Pro Max, Premium)', description: 'Permanent EE, Orange or T-Mobile UK carrier unlock for iPhone XR to iPhone 14 Pro Max at least six months old. Card orders are refunded in full if the carrier refuses.' },
  { serviceId: '461', path: '/services/unlock/uk', title: 'Vodafone UK iPhone Unlock (All Models, Clean Devices)', description: 'Permanent Vodafone UK carrier unlock for clean iPhones, all models. Card orders are refunded in full if the carrier refuses.' },
  { serviceId: '294', path: '/services/unlock/japan', title: 'NTT Docomo Japan iPhone Unlock (All Models, Clean Devices)', description: 'Permanent NTT Docomo Japan carrier unlock for clean iPhones, all models. Card orders are refunded in full if the carrier refuses.' },
  { serviceId: '453', path: '/services/unlock/japan', title: 'au KDDI Japan iPhone Unlock (All Models, Clean Devices)', description: 'Permanent au (KDDI) Japan carrier unlock for clean iPhones, all models. Card orders are refunded in full if the carrier refuses.' },
  { serviceId: '589', path: '/services/unlock/japan', title: 'SoftBank Japan iPhone Unlock (All Models, Clean Devices)', description: 'Permanent SoftBank Japan carrier unlock for clean iPhones, all models. Card orders are refunded in full if the carrier refuses.' },
]

export const itemIdFor = (serviceId: string) => `IUM-SKU-${serviceId}`
export const productCardPath = (serviceId: string) => `/api/product-card/${itemIdFor(serviceId)}.png`
export const feedPrice = (cents: number) => `${(cents / 100).toFixed(2)} USD`

/** What checkout would accept right now for a product code. */
export type LiveOffer = { priceCents: number; orderable: boolean }
export type LiveResolver = (productCode: string) => LiveOffer | null

/** The PUBLIC gate shared by the feed, the product cards and page schema. */
export function publicFeedProduct(serviceId: string, resolve: LiveResolver): { product: ProviderProduct; offer: LiveOffer } | null {
  if (BLOCKED_SERVICE_IDS.has(serviceId)) return null
  const product = PROVIDER_PRODUCTS.find((entry) => entry.serviceId === serviceId)
  if (!product || product.status !== 'available' || DISABLED_PRODUCT_CODES.has(product.productCode) || isMemberUnlock(product.productCode)) return null
  const offer = resolve(product.productCode)
  if (!offer || !offer.orderable || !Number.isSafeInteger(offer.priceCents) || offer.priceCents <= 0) return null
  return { product, offer }
}

export function feedEntry(serviceId: string): FeedEntry | undefined {
  return FEED_ENTRIES.find((entry) => entry.serviceId === serviceId)
}

export function buildFeedRows(origin: string, resolve: LiveResolver): FeedRow[] {
  return FEED_ENTRIES.flatMap((entry) => {
    const found = publicFeedProduct(entry.serviceId, resolve)
    if (!found) return []
    const { product, offer } = found
    const eta = product.etaLabel.replace(/\s+/g, ' ').trim()
    const url = new URL(entry.path, origin)
    url.searchParams.set('product', product.productCode)
    return [{
      item_id: itemIdFor(entry.serviceId),
      title: entry.title,
      description: `${entry.description} Estimated delivery: ${eta}. Price is the single-order base in USD; card payments add a 5% card fee shown before payment, crypto (USDT/USDC) adds none. No subscription.`,
      url: url.href,
      brand: FEED_BRAND,
      seller_name: FEED_BRAND,
      image_url: origin + productCardPath(entry.serviceId),
      availability: 'in_stock',
      price: feedPrice(offer.priceCents),
      enable_search: 'true',
      enable_checkout: 'false',
    }]
  })
}

const COLUMNS = [...FEED_FIELDS, ...FEED_FLAGS]

/** RFC 4180: quote every cell that holds a comma, quote or line break; double inner quotes. */
export function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

export function feedCsv(rows: FeedRow[]): string {
  return [COLUMNS.join(','), ...rows.map((row) => COLUMNS.map((column) => csvCell(row[column])).join(','))].join('\r\n') + '\r\n'
}

export function feedJsonl(rows: FeedRow[]): string {
  return rows.map((row) => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '')
}

/** Catalog-only resolver for tests and offline tooling (no database). */
export const catalogResolver: LiveResolver = (code) => {
  const product = PROVIDER_PRODUCTS.find((entry) => entry.productCode === code)
  return product ? { priceCents: product.priceCents, orderable: product.status === 'available' } : null
}
