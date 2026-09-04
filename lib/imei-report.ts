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
  modelDescription: ['model description', 'model configuration', 'model desc', 'product description', 'config description'],
  modelNumber: ['model number', 'part number'],
  imei: ['imei', 'imei number', 'imei/sn'],
  imei2: ['imei2', 'imei2 number', 'imei 2'],
  meid: ['meid', 'meid number'],
  serial: ['serial', 'serial number', 'serialnumber', 'sn', 's/n'],
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
  mdm: ['mdm', 'mdm status', 'mdm enrollment status', 'mobile device management', 'mdm lock'],
  knox: ['knox', 'knox guard', 'knox guard status', 'samsung lock', 'samsung status'],
  partNumber: ['part number', 'mpn'],
  partType: ['part type', 'part number type'],
  modelRegion: ['model region', 'part number country', 'purchase region'],
  configCode: ['config code'],
  productLine: ['product line'],
  productVersion: ['product version'],
  validPurchaseDate: ['valid purchase date', 'is valid purchase date'],
  technicalSupport: ['telephone technical support'],
  technicalSupportEnd: ['telephone technical support expiration date'],
  repairCoverage: ['repairs and service coverage'],
  repairCoverageEnd: ['repairs and service coverage expiration date', 'repairs and service expiration date'],
  openRepairCase: ['open repair case'],
  caseHistory: ['cases history', 'case history', 'case details', 'cases'],
  repairHistory: ['repair history', 'repairs history'],
  replacementDetails: ['replacement details', 'replacement history'],
  status: ['status', 'eligibility status'],
  statusDescription: ['status description', 'eligibility description'],
  esnStatus: ['esn status'],
  esimSupported: ['esim supported'],
  fsn: ['unlock number (fsn)', 'fsn'],
  warrantyDescription: ['warranty description'],
  miActivationLock: ['mi activation lock'],
  keyLock: ['imei/keylock', 'keylock'],
  modelCode: ['model code'],
  itemCode: ['item code', 'item'],
  offerCode: ['offer code'],
  activationDate: ['activation date', 'first activation date'],
  shipmentDate: ['shipment date'],
  orderDate: ['order date'],
  warrantyDetails: ['warranty details', 'warranty entitlements', 'warranty history'],
  factoryCode: ['factory code'],
  fullModel: ['full model'],
  series: ['series'],
  subSeries: ['sub series'],
  machineType: ['machine type', 'mtm'],
  shipToCountry: ['ship to country', 'ship to country code'],
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
  partNumber: 'Part number',
  partType: 'Part type',
  modelRegion: 'Model region',
  configCode: 'Configuration code',
  productLine: 'Product line',
  productVersion: 'Product version',
  validPurchaseDate: 'Valid purchase date',
  technicalSupport: 'Telephone support',
  technicalSupportEnd: 'Telephone support until',
  repairCoverage: 'Repairs and service coverage',
  repairCoverageEnd: 'Repairs and service coverage until',
  openRepairCase: 'Open repair case',
  caseHistory: 'Case history',
  repairHistory: 'Repair history',
  replacementDetails: 'Replacement details',
  status: 'Status',
  statusDescription: 'Status details',
  esnStatus: 'ESN status',
  esimSupported: 'eSIM supported',
  fsn: 'Unlock number (FSN)',
  warrantyDescription: 'Warranty description',
  miActivationLock: 'MI activation lock',
  keyLock: 'IMEI / key lock',
  modelCode: 'Model code',
  itemCode: 'Item code',
  offerCode: 'Offer code',
  activationDate: 'Activation date',
  shipmentDate: 'Shipment date',
  orderDate: 'Order date',
  warrantyDetails: 'Warranty details',
  factoryCode: 'Factory code',
  fullModel: 'Full model',
  series: 'Series',
  subSeries: 'Sub-series',
  machineType: 'Machine type',
  shipToCountry: 'Ship-to country',
}

const SECTION_FIELDS = [
  ['Device', ['brand', 'model', 'fullModel', 'modelDescription', 'modelNumber', 'modelCode', 'modelRegion', 'partNumber', 'partType', 'configCode', 'productLine', 'productVersion', 'series', 'subSeries', 'machineType', 'imei', 'imei2', 'meid', 'serial']],
  ['Network and activation', ['carrier', 'simLock', 'activationStatus', 'activationPolicy', 'status', 'statusDescription', 'esnStatus', 'esimSupported', 'fsn', 'miActivationLock', 'keyLock', 'soldBy']],
  ['Coverage and origin', ['warranty', 'warrantyDescription', 'warrantyStart', 'warrantyEnd', 'warrantyDetails', 'technicalSupport', 'technicalSupportEnd', 'repairCoverage', 'repairCoverageEnd', 'validPurchaseDate', 'purchaseDate', 'activationDate', 'productionDate', 'shipmentDate', 'orderDate', 'country', 'shipToCountry', 'deviceAge', 'appleCare']],
  ['Device history', ['refurbished', 'demo', 'replacement', 'registered', 'loaner', 'openRepairCase', 'caseHistory', 'repairHistory', 'replacementDetails']],
  ['Device codes', ['factoryCode', 'itemCode', 'offerCode']],
  ['Blacklist details', ['blacklistedBy', 'blacklistedCountry', 'blacklistedOn', 'blacklistReason']],
] as const

const CHECK_FIELDS = ['fmi', 'icloud', 'lostMode', 'blacklist', 'mdm', 'knox'] as const

const APPLE_CARRIER_FIELDS = [
  'model', 'modelDescription', 'modelNumber', 'modelRegion', 'activationStatus',
  'technicalSupport', 'technicalSupportEnd', 'repairCoverage', 'repairCoverageEnd',
  'appleCare', 'validPurchaseDate', 'registered', 'refurbished', 'demo', 'replacement',
  'fmi', 'icloud', 'blacklist', 'warranty', 'purchaseDate', 'country',
  'activationPolicy', 'simLock', 'carrier',
] as const

const APPLE_GSX_FIELDS = [
  'model', 'modelDescription', 'modelNumber', 'configCode', 'productLine',
  'productVersion', 'imei', 'imei2', 'serial', 'purchaseDate', 'activationDate',
  'warranty', 'soldBy', 'country', 'activationPolicy', 'simLock', 'mdm', 'icloud',
  'caseHistory', 'repairHistory', 'replacementDetails',
] as const

const PRODUCT_FIELDS: Record<string, readonly string[]> = {
  APPLE_ICLOUD_STATUS: ['fmi', 'icloud'],
  APPLE_ICLOUD_CLEAN: ['fmi', 'icloud'],
  BLACKLIST_SIMPLE: ['blacklist'],
  APPLE_BASIC: [
    'model', 'modelDescription', 'refurbished', 'demo', 'replacement',
    'fmi', 'icloud', 'blacklist', 'warranty', 'purchaseDate', 'country', 'simLock',
  ],
  APPLE_WARRANTY: [
    'model', 'imei', 'serial', 'activationStatus', 'warranty', 'warrantyEnd',
    'appleCare', 'purchaseDate', 'registered', 'loaner',
  ],
  APPLE_PART_NUMBER: ['model', 'imei', 'partNumber', 'modelRegion', 'partType'],
  APPLE_CARRIER_LITE: [
    'model', 'modelDescription', 'refurbished', 'demo', 'replacement',
    'purchaseDate', 'country', 'activationPolicy', 'simLock', 'carrier',
  ],
  APPLE_CARRIER_PRO: APPLE_CARRIER_FIELDS,
  APPLE_CARRIER_PRO_PLUS: [...APPLE_CARRIER_FIELDS, 'openRepairCase', 'partNumber', 'partType'],
  APPLE_MAX_INFO: [
    ...APPLE_CARRIER_FIELDS, 'openRepairCase', 'mdm', 'blacklistedBy',
    'blacklistedCountry', 'blacklistedOn', 'blacklistReason', 'partNumber', 'partType',
  ],
  APPLE_MDM: ['model', 'imei', 'mdm'],
  APPLE_MDM_FMI: ['model', 'imei', 'mdm', 'fmi'],
  APPLE_GSX_TETHER: ['model', 'imei', 'serial', 'fmi', 'activationPolicy', 'simLock'],
  APPLE_CASE_REPAIR_HISTORY: [
    'model', 'modelDescription', 'imei', 'imei2', 'serial', 'caseHistory', 'replacementDetails',
  ],
  APPLE_SOLD_BY_COVERAGE: [
    'model', 'modelDescription', 'imei', 'imei2', 'meid', 'serial', 'productVersion',
    'carrier', 'mdm', 'icloud', 'caseHistory', 'replacementDetails', 'warranty',
    'purchaseDate', 'soldBy', 'country', 'activationPolicy', 'simLock',
  ],
  APPLE_FULL_GSX: APPLE_GSX_FIELDS,
  APPLE_GSX_LIGHT: APPLE_GSX_FIELDS,
  APPLE_GSX_MAX: APPLE_GSX_FIELDS,
  BLACKLIST_FULL: [
    'brand', 'model', 'modelNumber', 'imei', 'blacklist', 'blacklistedBy',
    'blacklistedCountry', 'blacklistedOn', 'blacklistReason',
  ],
  TMOBILE_USA: ['model', 'brand', 'imei', 'imei2', 'status', 'esnStatus'],
  TMOBILE_USA_PRO: ['model', 'brand', 'imei', 'imei2', 'esimSupported', 'status', 'statusDescription', 'esnStatus'],
  VERIZON_USA_PRO: ['model', 'imei', 'status', 'statusDescription', 'partNumber'],
  XIAOMI_STATUS: [
    'model', 'imei', 'serial', 'fsn', 'warranty', 'warrantyDescription',
    'warrantyStart', 'warrantyEnd', 'country', 'miActivationLock', 'keyLock',
  ],
  HUAWEI_INFO: [
    'modelDescription', 'modelCode', 'imei', 'serial', 'itemCode', 'offerCode',
    'country', 'warranty', 'activationDate', 'shipmentDate', 'orderDate', 'warrantyDetails',
  ],
  HONOR_INFO: [
    'modelDescription', 'modelCode', 'imei', 'serial', 'itemCode', 'offerCode',
    'country', 'warranty', 'activationDate', 'shipmentDate', 'orderDate', 'warrantyDetails',
  ],
  SAMSUNG_INFO: [
    'brand', 'model', 'modelDescription', 'modelNumber', 'imei', 'serial',
    'carrier', 'country', 'warranty', 'warrantyEnd', 'productionDate', 'soldBy', 'knox',
  ],
  SAMSUNG_KNOX: [
    'brand', 'model', 'modelDescription', 'modelNumber', 'imei', 'serial',
    'carrier', 'warranty', 'warrantyEnd', 'productionDate', 'knox',
  ],
  MOTOROLA_INFO: [
    'model', 'imei', 'imei2', 'serial', 'factoryCode', 'itemCode',
    'shipmentDate', 'shipToCountry', 'country', 'warranty', 'warrantyDetails',
  ],
  LENOVO_INFO: [
    'brand', 'model', 'fullModel', 'serial', 'series', 'subSeries', 'machineType',
    'warranty', 'warrantyStart', 'warrantyEnd', 'shipmentDate', 'shipToCountry',
    'country', 'warrantyDetails',
  ],
  PIXEL_INFO: [
    'model', 'modelDescription', 'modelNumber', 'imei', 'imei2', 'serial',
    'country', 'purchaseDate', 'warranty', 'warrantyStart', 'warrantyEnd', 'deviceAge',
  ],
}

const PRODUCT_TITLES: Record<string, string> = {
  APPLE_BASIC: 'Apple basic information report',
  APPLE_CARRIER_LITE: 'Apple carrier report',
  APPLE_CARRIER_PRO: 'Apple carrier pro report',
  APPLE_CARRIER_PRO_PLUS: 'Apple carrier pro plus report',
  APPLE_MAX_INFO: 'Apple maximum information report',
  APPLE_WARRANTY: 'Apple warranty and activation report',
  APPLE_PART_NUMBER: 'Apple part number report',
  APPLE_ICLOUD_STATUS: 'Apple iCloud status report',
  APPLE_ICLOUD_CLEAN: 'Apple iCloud clean or lost report',
  APPLE_MDM: 'Apple MDM status report',
  APPLE_MDM_FMI: 'Apple MDM and Find My report',
  APPLE_GSX_TETHER: 'Apple next-tether policy report',
  APPLE_CASE_REPAIR_HISTORY: 'Apple case and replacement report',
  APPLE_SOLD_BY_COVERAGE: 'Apple sold-by and coverage report',
  APPLE_FULL_GSX: 'Apple full GSX report',
  APPLE_GSX_LIGHT: 'Apple GSX report',
  APPLE_GSX_MAX: 'Apple GSX maximum report',
  BLACKLIST_SIMPLE: 'Worldwide blacklist report',
  BLACKLIST_FULL: 'Worldwide blacklist detail report',
  TMOBILE_USA: 'T-Mobile USA status report',
  TMOBILE_USA_PRO: 'T-Mobile USA pro status report',
  VERIZON_USA_PRO: 'Verizon USA status report',
  XIAOMI_STATUS: 'Xiaomi device status report',
  HUAWEI_INFO: 'Huawei device report',
  HONOR_INFO: 'Honor device report',
  SAMSUNG_INFO: 'Samsung device report',
  SAMSUNG_KNOX: 'Samsung Knox Guard report',
  MOTOROLA_INFO: 'Motorola device report',
  LENOVO_INFO: 'Lenovo device report',
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
  const allowed = new Set(PRODUCT_FIELDS[productCode] ?? [])
  const indexed = indexFields(data)
  const sections: ProviderReport['sections'] = []

  for (const [title, fields] of SECTION_FIELDS) {
    const items: ReportItem[] = []
    for (const field of fields) {
      if (!allowed.has(field)) continue
      const raw = firstValue(indexed, field)
      if (raw === undefined) continue
      const value = displayValue(field, raw)
      if (value) items.push({ key: field, label: LABELS[field], value })
    }
    if (items.length) sections.push({ title, items })
  }

  const checks: ReportCheck[] = []
  for (const field of CHECK_FIELDS) {
    if (!allowed.has(field)) continue
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
