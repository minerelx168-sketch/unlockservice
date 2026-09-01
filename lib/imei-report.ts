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
  model: ['model', 'device', 'product', 'productname', 'product name'],
  imei: ['imei', 'imei number'],
  serial: ['serial', 'serial number', 'serialnumber', 'sn'],
  carrier: ['carrier', 'network', 'network name', 'operator'],
  country: ['country', 'purchase country', 'purchased in'],
  purchaseDate: ['estimated purchase date', 'purchasedate', 'purchase date'],
  warranty: ['warranty', 'warranty status', 'coverage', 'coverage status'],
  soldBy: ['sold by', 'soldby', 'seller'],
  activationPolicy: ['activation policy', 'activationpolicy', 'next tether policy'],
  simLock: ['sim lock', 'simlock', 'sim-lock', 'lock status', 'network lock'],
  refurbished: ['refurbished', 'isrefurbish', 'is refurbished'],
  demo: ['demo device', 'isdemo', 'is demo'],
  replacement: ['replacement', 'isreplacement', 'is replaced', 'isreplaced'],
  fmi: ['find my iphone', 'find my', 'fmi', 'fmion'],
  icloud: ['icloud status', 'icloudstatus', 'icloud'],
  lostMode: ['lost mode', 'lostmode'],
  blacklist: ['blacklist status', 'blackliststatus', 'blacklist', 'isblacklisted'],
  mdm: ['mdm', 'mdm status', 'mobile device management'],
  knox: ['knox', 'knox guard', 'knox guard status'],
}

const LABELS: Record<string, string> = {
  brand: 'Brand',
  model: 'Model',
  imei: 'IMEI',
  serial: 'Serial number',
  carrier: 'Carrier / network',
  country: 'Country',
  purchaseDate: 'Estimated purchase date',
  warranty: 'Warranty / coverage',
  soldBy: 'Sold by',
  activationPolicy: 'Activation policy',
  simLock: 'SIM lock',
  refurbished: 'Refurbished',
  demo: 'Demo device',
  replacement: 'Replacement device',
  fmi: 'Find My',
  icloud: 'iCloud',
  lostMode: 'Lost mode',
  blacklist: 'Blacklist',
  mdm: 'MDM',
  knox: 'Knox Guard',
}

const SECTION_FIELDS = [
  ['Device', ['brand', 'model', 'imei', 'serial']],
  ['Network and activation', ['carrier', 'simLock', 'activationPolicy', 'soldBy']],
  ['Coverage and origin', ['warranty', 'purchaseDate', 'country']],
  ['Device history', ['refurbished', 'demo', 'replacement']],
] as const

const CHECK_FIELDS = ['fmi', 'icloud', 'lostMode', 'blacklist', 'mdm', 'knox'] as const

function normalizedKey(value: string) {
  return value.trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ')
}

function safeText(value: unknown) {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  if (typeof value !== 'string' && typeof value !== 'number') return ''
  return String(value)
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
  if (field === 'imei' || field === 'serial') return maskIdentifier(text)
  return text
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
    if (/\b(clean)\b/.test(normalized)) return 'passed'
    if (/\b(lost|locked)\b/.test(normalized)) return 'attention'
  }
  return 'info'
}

function cleanSource(value: string) {
  const clean = value.trim().toLowerCase()
  return /^[a-z0-9][a-z0-9._-]{0,63}$/.test(clean) ? clean : 'provider'
}

export function buildProviderReport(checkType: string, source: string, data: Record<string, unknown>): ProviderReport {
  const indexed = indexFields(data)
  const sections: ProviderReport['sections'] = []

  for (const [title, fields] of SECTION_FIELDS) {
    const items: ReportItem[] = []
    for (const field of fields) {
      const raw = firstValue(indexed, field)
      if (raw === undefined) continue
      const value = displayValue(field, raw)
      if (value) items.push({ key: field, label: LABELS[field], value })
    }
    if (items.length) sections.push({ title, items })
  }

  const checks: ReportCheck[] = []
  for (const field of CHECK_FIELDS) {
    const raw = firstValue(indexed, field)
    if (raw === undefined) continue
    const value = displayValue(field, raw)
    if (value) checks.push({ key: field, label: LABELS[field], value, status: checkTone(field, value) })
  }

  const model = displayValue('model', firstValue(indexed, 'model'))
  const title = model ? `${model} report` : 'Device report complete'
  const visibleFieldCount = sections.reduce((total, section) => total + section.items.length, 0) + checks.length

  return {
    schemaVersion: 1,
    checkType,
    source: cleanSource(source),
    title,
    summary:
      visibleFieldCount > 0
        ? `The provider returned ${visibleFieldCount} verified report field${visibleFieldCount === 1 ? '' : 's'} for this request.`
        : 'The provider completed the request but did not return any supported public report fields.',
    sections,
    checks,
    nextStep: 'Provider data is a point-in-time lookup. Run a fresh check if the device status may have changed.',
  }
}
