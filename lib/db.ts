import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { BRANDS, CARRIERS, DEVICE_SERVICES } from './catalog'
import { toCents } from './money'

/**
 * SQLite so the whole thing runs with `npm run dev` and nothing to
 * provision. Plain SQL against a schema that keeps the reference's
 * shape — users, orders, invoices, a credit ledger — so moving to
 * Postgres later is a driver swap rather than a redesign.
 */

const DB_PATH = process.env.IUNLOCKMOBILE_DB ?? join(process.cwd(), 'data', 'iunlockmobile.db')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  username           TEXT    NOT NULL UNIQUE,
  email              TEXT    NOT NULL UNIQUE,
  password_hash      TEXT    NOT NULL,
  -- credit_cents is everything the account owns; held_cents is the part
  -- reserved by orders still with a supplier. Available = the difference.
  credit_cents       INTEGER NOT NULL DEFAULT 0,
  held_cents         INTEGER NOT NULL DEFAULT 0,
  account_type       TEXT    NOT NULL DEFAULT 'customer',
  membership_tier    TEXT    NOT NULL DEFAULT 'Newbie',
  parent_reseller_id INTEGER REFERENCES users(id),
  status             TEXT    NOT NULL DEFAULT 'active',
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT    NOT NULL,
  expires_at TEXT    NOT NULL,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- The brand decides how a finished unlock reaches the customer.
CREATE TABLE IF NOT EXISTS brands (
  id       INTEGER PRIMARY KEY,
  name     TEXT    NOT NULL,
  delivery TEXT    NOT NULL DEFAULT 'code',
  is_active INTEGER NOT NULL DEFAULT 1
);

-- The carrier decides what a network unlock costs and how long it takes.
CREATE TABLE IF NOT EXISTS carriers (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  country     TEXT    NOT NULL,
  price_cents INTEGER NOT NULL,
  eta_hours   INTEGER NOT NULL,
  is_active   INTEGER NOT NULL DEFAULT 1
);

-- Flat-priced jobs that do not depend on a network.
CREATE TABLE IF NOT EXISTS device_services (
  id          INTEGER PRIMARY KEY,
  name        TEXT    NOT NULL,
  summary     TEXT    NOT NULL,
  price_cents INTEGER NOT NULL,
  eta_hours   INTEGER NOT NULL,
  -- Empty means every brand; otherwise a comma-separated brand id list.
  brand_ids   TEXT    NOT NULL DEFAULT '',
  is_active   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS orders (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  kind              TEXT    NOT NULL,
  brand_id          INTEGER REFERENCES brands(id),
  carrier_id        INTEGER REFERENCES carriers(id),
  service_id        INTEGER REFERENCES device_services(id),
  imei              TEXT    NOT NULL,
  delivery_email    TEXT    NOT NULL,
  -- processing (credit held) -> delivered (charged) | unavailable (refunded)
  status            TEXT    NOT NULL DEFAULT 'processing',
  delivery          TEXT    NOT NULL,
  unlock_code       TEXT,
  result_json       TEXT,
  price_cents       INTEGER NOT NULL,
  eta_hours         INTEGER NOT NULL,
  source            TEXT    NOT NULL DEFAULT 'website',
  provider_order_id TEXT,
  -- Mock supplier only: when the order becomes resolvable.
  provider_ready_at TEXT,
  error_message     TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS invoices (
  reference          TEXT    PRIMARY KEY,
  user_id            INTEGER NOT NULL REFERENCES users(id),
  gateway            TEXT    NOT NULL,
  credit_amount_cents INTEGER NOT NULL,
  fee_cents          INTEGER NOT NULL DEFAULT 0,
  tax_cents          INTEGER NOT NULL DEFAULT 0,
  total_due_cents    INTEGER NOT NULL,
  currency           TEXT    NOT NULL DEFAULT 'USD',
  status             TEXT    NOT NULL DEFAULT 'pending',
  payment_reference  TEXT,
  note               TEXT,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS invoices_user ON invoices(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS credit_ledger (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id            INTEGER NOT NULL REFERENCES users(id),
  amount_cents       INTEGER NOT NULL,
  type               TEXT    NOT NULL,
  ref_type           TEXT,
  ref_id             TEXT,
  balance_after_cents INTEGER NOT NULL,
  created_at         TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS ledger_user ON credit_ledger(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS api_access (
  user_id         INTEGER PRIMARY KEY REFERENCES users(id),
  status          TEXT NOT NULL DEFAULT 'none',
  website_url     TEXT,
  contact_channel TEXT,
  use_case        TEXT,
  requested_at    TEXT
);
`

let handle: Database.Database | null = null

export function db(): Database.Database {
  if (handle) return handle

  mkdirSync(dirname(DB_PATH), { recursive: true })
  const connection = new Database(DB_PATH)
  connection.pragma('journal_mode = WAL')
  connection.pragma('foreign_keys = ON')
  connection.exec(SCHEMA)
  seedCatalog(connection)

  handle = connection
  return handle
}

/** Idempotent: names and prices follow the catalog, ids never move. */
function seedCatalog(connection: Database.Database) {
  const brand = connection.prepare(`
    INSERT INTO brands (id, name, delivery) VALUES (@id, @name, @delivery)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, delivery = excluded.delivery
  `)
  const carrier = connection.prepare(`
    INSERT INTO carriers (id, name, country, price_cents, eta_hours)
    VALUES (@id, @name, @country, @price, @eta)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, country = excluded.country,
      price_cents = excluded.price_cents, eta_hours = excluded.eta_hours
  `)
  const service = connection.prepare(`
    INSERT INTO device_services (id, name, summary, price_cents, eta_hours, brand_ids)
    VALUES (@id, @name, @summary, @price, @eta, @brandIds)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name, summary = excluded.summary,
      price_cents = excluded.price_cents, eta_hours = excluded.eta_hours,
      brand_ids = excluded.brand_ids
  `)

  connection.transaction(() => {
    for (const entry of BRANDS) brand.run(entry)
    for (const entry of CARRIERS) {
      carrier.run({
        id: entry.id,
        name: entry.name,
        country: entry.country,
        price: toCents(entry.priceUsd),
        eta: entry.etaHours,
      })
    }
    for (const entry of DEVICE_SERVICES) {
      service.run({
        id: entry.id,
        name: entry.name,
        summary: entry.summary,
        price: toCents(entry.priceUsd),
        eta: entry.etaHours,
        brandIds: entry.brandIds.join(','),
      })
    }
  })()
}

/* ---- catalog reads --------------------------------------------------- */

export type BrandRow = { id: number; name: string; delivery: 'remote' | 'code'; is_active: number }
export type CarrierRow = {
  id: number
  name: string
  country: string
  price_cents: number
  eta_hours: number
  is_active: number
}
export type DeviceServiceRow = {
  id: number
  name: string
  summary: string
  price_cents: number
  eta_hours: number
  brand_ids: string
  is_active: number
}

export function listBrands(): BrandRow[] {
  return db().prepare('SELECT * FROM brands WHERE is_active = 1 ORDER BY name').all() as BrandRow[]
}

export function listCarriers(): CarrierRow[] {
  return db()
    .prepare('SELECT * FROM carriers WHERE is_active = 1 ORDER BY country, name')
    .all() as CarrierRow[]
}

export function listDeviceServices(): DeviceServiceRow[] {
  return db()
    .prepare('SELECT * FROM device_services WHERE is_active = 1 ORDER BY price_cents DESC')
    .all() as DeviceServiceRow[]
}

export function getBrand(id: number): BrandRow | undefined {
  return db().prepare('SELECT * FROM brands WHERE id = ? AND is_active = 1').get(id) as BrandRow | undefined
}

export function getCarrier(id: number): CarrierRow | undefined {
  return db().prepare('SELECT * FROM carriers WHERE id = ? AND is_active = 1').get(id) as
    | CarrierRow
    | undefined
}

export function getDeviceService(id: number): DeviceServiceRow | undefined {
  return db().prepare('SELECT * FROM device_services WHERE id = ? AND is_active = 1').get(id) as
    | DeviceServiceRow
    | undefined
}

/** A device service is offered for a brand when its list is empty or names it. */
export function serviceCoversBrand(service: DeviceServiceRow, brandId: number): boolean {
  if (!service.brand_ids) return true
  return service.brand_ids.split(',').map(Number).includes(brandId)
}
