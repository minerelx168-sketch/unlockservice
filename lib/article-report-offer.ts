// The featured article offer is separate from the report/tool defaults and editorial quotes.
export const ARTICLE_REPORT_CODE = 'APPLE_CARRIER_PRO_PLUS'
const reports = {
  APPLE_CARRIER_LITE: { id: '444', name: 'Apple Carrier (Lite)' },
  [ARTICLE_REPORT_CODE]: { id: '448', name: 'Apple Carrier (Pro Plus)' },
} as const
export type CarrierBoxCode = keyof typeof reports
export function carrierFunnelItem(code: string) {
  return Object.hasOwn(reports, code) ? reports[code as CarrierBoxCode] : undefined
}
export function carrierFunnelItemById(id: unknown) {
  return Object.values(reports).find(item => item.id === id)
}
