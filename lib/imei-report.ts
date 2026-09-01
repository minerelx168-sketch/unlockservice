import { maskIdentifier } from './imei'

export type ReportItem = {
  key: string
  label: string
  value: string
}

export type ReportCheck = {
  key: string
  label: string
  status: 'passed' | 'attention' | 'info'
  value: string
}

export type ProviderReport = {
  schemaVersion: 1
  checkType: string
  source: string
  title: string
  summary: string
  sections: Array<{ title: string; items: ReportItem[] }>
  checks: ReportCheck[]
  nextStep: string
}

const FIELD_ALIASES: Record<string, string[]> = {
  brand: ['brand', 'manufacturer', 'make'],
  model: ['model', 'device', 'product', 'productname', 'product name', 'model name', 'model info'],
  modelDescription: ['model description', 'model configuration', 'model desc', 'product description'],
  modelNumber: ['model number', 'part number'],
  imei: ['imei', 'imei number', 'imei/sn'],
  imei2: ['imei2', 'imei2 number', 'imei 2'],
  meid: ['meid', 'meid number'],
  serial: ['serial', 'serial number', 'serialnumber', 'sn'],
  carrier: ['carrier', 'network', 'network name', 'operator'],
  country: ['country', 'purchase country', 'purchased in'],
  purchaseDate: ['estimated purchase date', 'purchasedate', 'purchase date', 'date'],
  productionDate: ['production date', 'manufacture date'],
  warranty: ['warranty', 'warranty status', 'coverage', 'coverage status'],
  warrantyStart: ['warranty start date', 'coverage start date'],
  warrantyEnd: ['warranty end date', 'coverage end date', 'warranty until'],
  deviceAge: ['device age', 'age'],
  soldBy: ['sold by', 'soldby', 'seller', 'sold to name'],
  activationStatus: ['activation status', 'activated'],
  activationPolicy: ['activation policy', 'activationpolicy', 'next tether policy', 'next activation policy'],
  simLock: ['sim lock', 'simlock', 'sim-lock', 'lock status', 'network lock', 'sim lock status'],
  refurbished: ['refurbished', 'refurbish', 'isrefurbish', 'is refurbished'],
  demo: ['demo device', 'demo', 'isdemo', 'is demo'],
  replacement: ['replacement', 'replacement device', 'replaced device', 'isreplacement', 'is replaced', 'isreplaced'],
  registered: ['registered', 'registered device', 'is registered'],
  loaner: ['loaner', 'loaner device'],
  appleCare: ['applecare eligible', 'apple care eligible'],
  fmi: ['find my iphone', 'find my', 'fmi', 'fmion', 'fmi status'],
  icloud: ['icloud status', 'icloudstatus', 'icloud', 'icloud lock'],
  lostMode: ['lost mode', 'lostmode'],
  blacklist: ['blacklist status', 'blackliststatus', 'blacklist', 'isblacklisted', 'us block status'],
  blacklistedBy: ['blacklisted by', 'blacklisted (fraud) by'],
  blacklistedCountry: ['blacklisted country', 'blacklisted (fraud) country'],
  blacklistedOn: ['blacklisted on', 'blacklisted (fraud) on'],
  blacklistReason: ['blacklist reason', 'blacklist description', 'note', 'details'],
  mdm: ['mdm', 'mdm status', 'mdm enrollment status', 'mobile device management'],
  knox: ['knox', 'knox guard', 'knox guard status', 'samsung lock', 'samsung status'],
}

const LABELS: Record<string, string> = {
  brand: 'Brand',
  model: 'Model',
  modelDescription: 'Model description',
  modelNumber: 'Model number',
  imei: 'IMEI',
  imei2: 'IMEI 2',
  meid: 'MEID',
  serial: 'Serial number',
  carrier: 'Carrier / network',
  country: 'Country',
  purchaseDate: 'Estimated purchase date',
  productionDate: 'Production date',
  warranty: 'Warranty / coverage',
  warrantyStart: 'Warranty start date',
  warrantyEnd: 'Warranty end date',
  deviceAge: 'Device age',
  soldBy: 'Sold by',
  activationStatus: 'Activation status',
  activationPolicy: 'Activation policy',
  simLock: 'SIM lock',
  refurbished: 'Refurbished',
  demo: 'Demo device',
  replacement: 'Replacement device',
  registered: 'Registered',
  loaner: 'Loaner device',
  appleCare: 'AppleCare eligible',
  fmi: 'Find My',
  icloud: 'iCloud',
  lostMode: 'Lost mode',
  blacklist: 'Blacklist',
  blacklistedBy: 'Blacklisted by',
  blacklistedCountry: 'Blacklisted country',
  blacklistedOn: 'Blacklisted on',
  blacklistReason: 'Blacklist details',
  mdm: 'MDM',
  knox: 'Knox Guard',
}

const SECTION_FIELDS = [
  ['Device', ['brand', 'model', 'modelDescription', 'modelNumber', 'imei', 'imei2', 'meid', 'serial']],
  ['Network and activation', ['carrier', 'simLock', 'activationStatus', 'activationPolicy', 'soldBy']],
  ['Coverage and origin', ['warranty', 'warrantyStart', 'warrantyEnd', 'purchaseDate', 'productionDate', 'country', 'deviceAge', 'appleCare']],
  ['Device history', ['refurbished', 'demo', 'replacement', 'registered', 'loaner']],
  ['Blacklist details', ['blacklistedBy', 'blacklistedCountry', 'blacklistedOn', 'blacklistReason']],
] as const

const CHECK_FIELDS = ['fmi', 'icloud', 'lostMode', 'blacklist', 'mdm', 'knox'] as const

const PRODUCT_FIELDS: Record<string, readonly string[]> = {
  APPLE_ICLOUD_STATUS: ['fmi', 'icloud'],
  BLACKLIST_SIMPLE: ['blacklist'],
  APPLE_BASIC: [
    'model', 'modelDescription', 'refurbished', 'demo', 'replacement',
    'fmi', 'icloud', 'blacklist', 'warranty', 'purchaseDate', 'country', 'simLock',
  ],
  APPLE_WARRANTY: [
    'model', 'imei', 'serial', 'activationStatus', 'warranty', 'warrantyEnd',
    'appleCare', 'purchaseDate', 'registered', 'loaner',
  ],
  APPLE_CARRIER_LITE: [
    'model', 'modelDescription', 'refurbished', 'demo', 'replacement',
    'purchaseDate', 'country', 'activationPolicy', 'simLock', 'carrier',
  ],
  BLACKLIST_FULL: [
    'brand', 'model', 'modelNumber', 'imei', 'blacklist', 'blacklistedBy',
    'blacklistedCountry', 'blacklistedOn', 'blacklistReason',
  ],
  SAMSUNG_INFO: [
    'brand', 'model', 'modelDescription', 'modelNumber', 'imei', 'serial',
    'carrier', 'country', 'warranty', 'warrantyEnd', 'productionDate', 'soldBy', 'knox',
  ],
  PIXEL_INFO: [
    'model', 'modelDescription', 'modelNumber', 'imei', 'imei2', 'serial',
    'country', 'purchaseDate', 'warranty', 'warrantyStart', 'warrantyEnd', 'deviceAge',
  ],
}

const PRODUCT_TITLES: Record<string, string> = {
  APPLE_ICLOUD_STATUS: 'Apple iCloud status report',
  BLACKLIST_SIMPLE: 'Worldwide blacklist report',
  APPLE_BASIC: 'Apple basic information report',
  APPLE_WARRANTY: 'Apple warranty and activation report',
  APPLE_CARRIER_LITE: 'Apple carrier report',
  BLACKLIST_FULL: 'Worldwide blacklist detail report',
  SAMSUNG_INFO: 'Samsung device report',
  PIXEL_INFO: 'Google Pixel device report',
}

const IDENTIFIER_FIELDS = new Set(['imei', 'imei2', 'meid', 'serial'])

function normalizedKey(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function normalizedCheckType(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '')
}

function safeText(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

function indexFields(input: Record<string, unknown>) {
  const indexed = new Map<string, unknown>()
  for (const [key, value] of Object.entries(input)) indexed.set(normalizedKey(key), value)
  return indexed
}

function firstValue(indexed: Map<string, unknown>, field: string) {
  for (const alias of FIELD_ALIASES[field] ?? []) {
    const value = indexed.get(normalizedKey(alias))
    if (value !== undefined && value !== null && safeText(value)) return value
  }
  return undefined
}

function displayValue(field: string, value: unknown) {
  const text = safeText(value)
  if (!text) return ''
  return IDENTIFIER_FIELDS.has(field) ? maskIdentifier(text) : text
}

function checkTone(field: string, value: string): ReportCheck['status'] {
  const normalized = value.toLowerCase()
  if (field === 'fmi' || field === 'mdm' || field === 'knox') {
    if (/\b(off|disabled|inactive|no|false)\b/.test(normalized)) return 'passed'
    if (/\b(on|enabled|active|yes|true)\b/.test(normalized)) return 'attention'
  }
  if (field === 'lostMode' || field === 'blacklist') {
    if (/\b(clean|off|not blacklisted|not lost|no|false)\b/.test(normalized)) return 'passed'
    if (/\b(blacklisted|lost|on|yes|true)\b/.test(normalized)) return 'attention'
  }
  if (field === 'icloud') {
    if (/\b(clean|off|disabled|no|false)\b/.test(normalized)) return 'passed'
    if (/\b(lost|locked|on|enabled|yes|true)\b/.test(normalized)) return 'attention'
  }
  return 'info'
}

function cleanSource(value: string) {
  const clean = value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(clean) ? clean : 'provider'
}

export function providerReportHasContent(report: ProviderReport) {
  return report.sections.some((section) => section.items.length > 0) || report.checks.length > 0
}

export function buildProviderReport(checkType: string, source: string, data: Record<string, unknown>): ProviderReport {
  const productCode = normalizedCheckType(checkType)
  const allowed = PRODUCT_FIELDS[productCode] ? new Set(PRODUCT_FIELDS[productCode]) : null
  const indexed = indexFields(data)
  const sections: ProviderReport['sections'] = []

  for (const [title, fields] of SECTION_FIELDS) {
    const items: ReportItem[] = []
    for (const field of fields) {
      if (allowed && !allowed.has(field)) continue
      const raw = firstValue(indexed, field)
      if (raw === undefined) continue
      const value = displayValue(field, raw)
      if (value) items.push({ key: field, label: LABELS[field], value })
    }
    if (items.length) sections.push({ title, items })
  }

  const checks: ReportCheck[] = []
  for (const field of CHECK_FIELDS) {
    if (allowed && !allowed.has(field)) continue
    const raw = firstValue(indexed, field)
    if (raw === undefined) continue
    const value = displayValue(field, raw)
    if (value) checks.push({ key: field, label: LABELS[field], value, status: checkTone(field, value) })
  }

  const model = displayValue('model', firstValue(indexed, 'model'))
  const title = model ? `${model} report` : (PRODUCT_TITLES[productCode] ?? 'Device report complete')
  const visibleFieldCount = sections.reduce((total, section) => total + section.items.length, 0) + checks.length

  return {
    schemaVersion: 1,
    checkType: productCode || checkType,
    source: cleanSource(source),
    title,
    summary:
      visibleFieldCount > 0
        ? `The provider returned ${visibleFieldCount} supported report field${visibleFieldCount === 1 ? '' : 's'} for this request.`
        : 'The provider completed the request but did not return any supported public report fields.',
    sections,
    checks,
    nextStep: 'Provider data is a point-in-time lookup. Run a fresh report if the device status may have changed.',
  }
}
