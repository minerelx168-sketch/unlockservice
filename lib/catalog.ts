/**
 * The orderable catalog.
 *
 * Two things can be ordered, and they are priced differently:
 *
 *   Carrier unlock — the price comes from the carrier (some networks are
 *   simply harder and slower to get an authorisation from), while how the
 *   unlock arrives comes from the brand: Apple devices are released
 *   remotely, everything else is issued a code to type in.
 *
 *   Device service — a flat-priced job that does not depend on a network,
 *   such as removing an activation lock or reading a blacklist status.
 *
 * PLACEHOLDER PRICING. Every price and turnaround below is a plausible
 * schedule, not a quoted one. Replace them with your own supplier's terms
 * before taking money.
 */

export type Delivery = 'remote' | 'code'

export type BrandSeed = {
  id: number
  name: string
  /** How a completed unlock reaches the customer for this brand. */
  delivery: Delivery
}

export type CarrierSeed = {
  id: number
  name: string
  country: string
  /** What a network unlock costs on this carrier. */
  priceUsd: number
  /** Typical turnaround, quoted to the customer as a range. */
  etaHours: number
}

export type DeviceServiceSeed = {
  id: number
  name: string
  summary: string
  priceUsd: number
  etaHours: number
  /** Only offered for these brands; empty means every brand. */
  brandIds: number[]
}

export const BRANDS: BrandSeed[] = [
  { id: 1, name: 'Apple', delivery: 'remote' },
  { id: 2, name: 'Samsung', delivery: 'code' },
  { id: 3, name: 'Google', delivery: 'code' },
  { id: 4, name: 'Motorola', delivery: 'code' },
  { id: 5, name: 'OnePlus', delivery: 'code' },
  { id: 6, name: 'Xiaomi', delivery: 'code' },
  { id: 7, name: 'Sony', delivery: 'code' },
  { id: 8, name: 'Nokia', delivery: 'code' },
  { id: 9, name: 'Honor', delivery: 'code' },
  { id: 10, name: 'Huawei', delivery: 'code' },
]

export const CARRIERS: CarrierSeed[] = [
  // United States
  { id: 101, name: 'AT&T', country: 'United States', priceUsd: 24.99, etaHours: 24 },
  { id: 102, name: 'T-Mobile', country: 'United States', priceUsd: 39.99, etaHours: 48 },
  { id: 103, name: 'Verizon', country: 'United States', priceUsd: 19.99, etaHours: 12 },
  { id: 104, name: 'Metro by T-Mobile', country: 'United States', priceUsd: 44.99, etaHours: 72 },
  { id: 105, name: 'Cricket Wireless', country: 'United States', priceUsd: 29.99, etaHours: 24 },
  { id: 106, name: 'Boost Mobile', country: 'United States', priceUsd: 34.99, etaHours: 48 },
  { id: 107, name: 'US Cellular', country: 'United States', priceUsd: 27.99, etaHours: 36 },
  { id: 108, name: 'Dish', country: 'United States', priceUsd: 32.99, etaHours: 48 },
  // United Kingdom
  { id: 201, name: 'EE', country: 'United Kingdom', priceUsd: 21.99, etaHours: 24 },
  { id: 202, name: 'O2', country: 'United Kingdom', priceUsd: 18.99, etaHours: 12 },
  { id: 203, name: 'Vodafone', country: 'United Kingdom', priceUsd: 22.99, etaHours: 24 },
  { id: 204, name: 'Three', country: 'United Kingdom', priceUsd: 25.99, etaHours: 36 },
  { id: 205, name: 'Tesco Mobile', country: 'United Kingdom', priceUsd: 23.99, etaHours: 24 },
  // Canada
  { id: 301, name: 'Rogers', country: 'Canada', priceUsd: 26.99, etaHours: 24 },
  { id: 302, name: 'Bell', country: 'Canada', priceUsd: 26.99, etaHours: 24 },
  { id: 303, name: 'Telus', country: 'Canada', priceUsd: 28.99, etaHours: 36 },
  { id: 304, name: 'Freedom Mobile', country: 'Canada', priceUsd: 31.99, etaHours: 48 },
  { id: 305, name: 'Fido', country: 'Canada', priceUsd: 26.99, etaHours: 24 },
  // Australia
  { id: 401, name: 'Telstra', country: 'Australia', priceUsd: 29.99, etaHours: 48 },
  { id: 402, name: 'Optus', country: 'Australia', priceUsd: 27.99, etaHours: 36 },
]

export const DEVICE_SERVICES: DeviceServiceSeed[] = [
  {
    id: 501,
    name: 'Activation lock removal',
    summary: 'Clears an iCloud activation lock on a device you own but cannot sign into.',
    priceUsd: 89.99,
    etaHours: 72,
    brandIds: [1],
  },
  {
    id: 502,
    name: 'MDM profile removal',
    summary: 'Removes a remote management profile left behind by a previous owner.',
    priceUsd: 34.99,
    etaHours: 24,
    brandIds: [1],
  },
  {
    id: 503,
    name: 'Google account (FRP) removal',
    summary: 'Clears a factory reset protection lock on an Android device you own.',
    priceUsd: 29.99,
    etaHours: 24,
    brandIds: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
  {
    id: 504,
    name: 'Blacklist and carrier check',
    summary: 'Reports the network a device is locked to and whether it has been reported lost.',
    priceUsd: 0.99,
    etaHours: 1,
    brandIds: [],
  },
  {
    id: 505,
    name: 'Full device report',
    summary: 'Model, storage, warranty window, activation lock and SIM-lock state in one report.',
    priceUsd: 1.49,
    etaHours: 1,
    brandIds: [],
  },
]
