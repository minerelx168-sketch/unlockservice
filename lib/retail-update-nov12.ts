// Targeted owner decision. Keep the signed October price sheet and supplier directory intact.
export const NOV12_PRICES: Readonly<Record<string, number>> = {
  UNLOCK_346: 800, CHECK_690: 195, CHECK_973: 195,
}
export const RETIRED_ATT_CODE = 'UNLOCK_718'
export const DISABLED_PRODUCT_CODES: ReadonlySet<string> = new Set([
  RETIRED_ATT_CODE, 'UNLOCK_926', 'UNLOCK_25', 'CHECK_661', 'CHECK_904', 'CHECK_702', 'CHECK_696',
])
export const NOV12_VERSION = '2026-11-12-retire-att-718-and-apple-case-retail'
