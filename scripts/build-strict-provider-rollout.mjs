import fs from 'node:fs'
import path from 'node:path'

const livePath = process.argv[2]
if (!livePath) throw new Error('Usage: node scripts/build-strict-provider-rollout.mjs <live-catalog.json>')
const root = process.cwd()
const catalogPath = path.join(root, 'catalog/provider-products.json')
const manifestPath = path.join(root, 'catalog/provider-rollout-strict.json')
const live = JSON.parse(fs.readFileSync(livePath, 'utf8'))
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))
const liveByCode = new Map(live.products.map((product) => [product.productCode, product]))

function gateReasons(product) {
  const reasons = []
  if (product.preferredProtocol === 'none' || product.liveCost == null) reasons.push('missing_provider_service')
  if (product.status === 'hidden_restricted') reasons.push('restricted')
  if (product.status === 'hidden_reprice') reasons.push('reprice_required')
  if (product.inputType !== 'imei') reasons.push('unsupported_input')
  if ((product.requiredFields ?? []).length > 0) reasons.push('additional_fields_required')
  if (product.margin == null || product.margin <= 0) reasons.push('non_positive_margin')
  return reasons
}

const paidServiceMap = {}
const blocked = []
let approvedImei = 0
let approvedUnlock = 0
let approvedPhp = 0
let approvedDhru = 0

const products = catalog.products.map((product) => {
  const current = liveByCode.get(product.productCode)
  if (!current) throw new Error(`Missing live gate row for ${product.productCode}`)
  const reasons = gateReasons(current)
  const approved = reasons.length === 0
  const next = {
    ...product,
    status: approved
      ? 'available'
      : reasons.includes('restricted')
        ? 'hidden_restricted'
        : reasons.includes('reprice_required') || reasons.includes('non_positive_margin') || reasons.includes('missing_provider_service')
          ? 'hidden_reprice'
          : 'coming_soon',
    providerCostMicros: current.liveCost == null
      ? product.providerCostMicros
      : Math.round(Number(current.liveCost) * 1_000_000),
    etaLabel: current.liveTime || product.etaLabel,
  }
  if (approved) {
    paidServiceMap[`product:${product.productCode.toLowerCase()}`] = {
      id: String(product.serviceId),
      mode: current.preferredProtocol === 'php' ? 'sync' : 'dhru',
    }
    if (product.domain === 'imei_check') approvedImei += 1
    else approvedUnlock += 1
    if (current.preferredProtocol === 'php') approvedPhp += 1
    else if (current.preferredProtocol === 'dhru') approvedDhru += 1
  } else {
    blocked.push({ productCode: product.productCode, serviceId: String(product.serviceId), reasons })
  }
  return next
})

const approved = Object.keys(paidServiceMap).length
if (approved !== 99 || approvedImei !== 45 || approvedUnlock !== 54 || approvedPhp !== 35 || approvedDhru !== 64) {
  throw new Error(`Strict rollout mismatch: ${approved}/${approvedImei}/${approvedUnlock}/${approvedPhp}/${approvedDhru}`)
}
if (blocked.length !== 31) throw new Error(`Blocked rollout mismatch: ${blocked.length}/31`)

catalog.version = '2026-09-08-strict-rollout'
catalog.source = 'Owner-approved strict positive-margin rollout joined to live PHP/DHRU Provider catalogs on 2026-09-08'
catalog.products = products
const manifest = {
  version: catalog.version,
  policy: 'strict_positive_margin',
  approvedCounts: { total: approved, imeiCheck: approvedImei, unlock: approvedUnlock, php: approvedPhp, dhru: approvedDhru },
  blockedCount: blocked.length,
  paidServiceMap,
  blocked,
}
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`)
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`)
console.log(JSON.stringify({ version: catalog.version, approvedCounts: manifest.approvedCounts, blockedCount: blocked.length }))
