import Database from 'better-sqlite3'
import { readFileSync } from 'node:fs'
import { PROVIDER_PRODUCTS, etaMinutesFromLabel } from '../lib/provider-products'
import approved from '../catalog/owner-selling-prices-20261028.json'
import directory from '../catalog/storefront-service-directory.json'

// Operational command, never run during app startup. Back up the DB before --apply.
const path = process.env.IUNLOCKMOBILE_DB
if (!path) throw new Error('Set IUNLOCKMOBILE_DB explicitly.')
const products = PROVIDER_PRODUCTS.filter(product => product.status === 'available')
const prices = new Map(approved.prices.map(row => [row.serviceId, row.sellingPriceCents]))
const ids = new Set(directory.services.map(row => row.serviceId))
if (products.length !== 128 || prices.size !== 129 || ids.size !== 129) throw new Error('Catalog count mismatch.')
const snapshot = process.argv.find(arg => arg.startsWith('--provider-snapshot='))?.split('=')[1]
if (!snapshot) throw new Error('Supply the read-only DHRU service-list snapshot.')
const response = JSON.parse(readFileSync(snapshot, 'utf8'))
type LiveService = { SERVICEID: string; CREDIT: number; [key: string]: unknown }
const live = new Map<string, LiveService>()
for (const group of Object.values(response.SUCCESS?.[0]?.LIST ?? {}) as { SERVICES: Record<string, LiveService> }[]) {
  for (const service of Object.values(group.SERVICES)) live.set(String(service.SERVICEID), service)
}
if (live.size !== products.length + 1) throw new Error('Provider directory changed; reconcile before applying.')
for (const p of products) {
  const current = live.get(p.serviceId)
  if (!ids.has(p.serviceId) || prices.get(p.serviceId) !== p.priceCents || !current) throw new Error(`Unapproved service: ${p.productCode}`)
  if (Math.round(Number(current.CREDIT) * 1e6) !== p.providerCostMicros) throw new Error(`Provider cost changed: ${p.productCode}`)
  if (p.priceCents * 1000000 < p.providerCostMicros * 130) throw new Error(`Price below cost +30%: ${p.productCode}`)
  if (Object.entries(current).some(([key, value]) => key.startsWith('Requires.') && !['None', 'No', '0', ''].includes(String(value)))) throw new Error(`Additional fields required: ${p.productCode}`)
}
const connection = new Database(path, { fileMustExist: true })
connection.pragma('busy_timeout = 10000')
const before = connection.prepare('SELECT count(*) AS count FROM paid_report_products WHERE is_active=1').get()
if (process.argv.includes('--apply')) {
  connection.transaction(() => {
    connection.prepare('UPDATE paid_report_products SET is_active=0, updated_at=datetime(\'now\')').run()
    const upsert = connection.prepare(`INSERT INTO paid_report_products
      (code,slug,name,summary,input_type,price_cents,provider_cost_micros,eta_minutes,is_active,sort_order)
      VALUES (@code,@slug,@name,@summary,@inputType,@priceCents,@providerCostMicros,@etaMinutes,1,@sortOrder)
      ON CONFLICT(code) DO UPDATE SET slug=excluded.slug,name=excluded.name,summary=excluded.summary,
        input_type=excluded.input_type,price_cents=excluded.price_cents,provider_cost_micros=excluded.provider_cost_micros,
        eta_minutes=excluded.eta_minutes,is_active=1,sort_order=excluded.sort_order,updated_at=datetime('now')`)
    for (const p of products) upsert.run({ ...p, code: p.productCode, etaMinutes: etaMinutesFromLabel(p.etaLabel) })
    connection.prepare('INSERT OR IGNORE INTO schema_migrations(version) VALUES (?)').run('2026-10-28-owner-selling-prices-v1')
  }).immediate()
}
console.log(JSON.stringify({ applied: process.argv.includes('--apply'), approved: products.length, before,
  active: connection.prepare('SELECT count(*) AS count FROM paid_report_products WHERE is_active=1').get(),
  integrity: connection.pragma('integrity_check', { simple: true }) }))
connection.close()
