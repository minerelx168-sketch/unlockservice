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
	  display_name       TEXT,
	  email_verified_at  TEXT,
	  password_hash      TEXT    NOT NULL,
	  is_admin           INTEGER NOT NULL DEFAULT 0,
	  banned_at          TEXT,
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
	  expires_at  TEXT    NOT NULL,
	  last_seen_at TEXT  NOT NULL DEFAULT (datetime('now')),
	  user_agent  TEXT,
	  ip_address  TEXT,
	  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
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
	  description        TEXT,
	  affects_balance    INTEGER NOT NULL DEFAULT 1,
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

	CREATE TABLE IF NOT EXISTS email_verifications (
	  id          INTEGER PRIMARY KEY AUTOINCREMENT,
	  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
	  code_hash   TEXT    NOT NULL,
	  purpose     TEXT    NOT NULL,
	  attempts    INTEGER NOT NULL DEFAULT 0,
	  consumed_at TEXT,
	  expires_at  TEXT    NOT NULL,
	  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX IF NOT EXISTS email_verifications_active
	  ON email_verifications(user_id, purpose, consumed_at, id DESC);
	CREATE INDEX IF NOT EXISTS email_verifications_expiry ON email_verifications(expires_at);

	CREATE TABLE IF NOT EXISTS auth_rate_limits (
	  bucket       TEXT NOT NULL,
	  subject_hash TEXT NOT NULL,
	  window_start TEXT NOT NULL,
	  attempts     INTEGER NOT NULL DEFAULT 0,
	  PRIMARY KEY (bucket, subject_hash)
	);

	CREATE TABLE IF NOT EXISTS topup_orders (
	  id                       INTEGER PRIMARY KEY AUTOINCREMENT,
	  public_id                TEXT    NOT NULL UNIQUE,
	  user_id                  INTEGER NOT NULL REFERENCES users(id),
	  credit_amount_cents      INTEGER NOT NULL,
	  fee_cents                INTEGER NOT NULL DEFAULT 0,
	  tax_cents                INTEGER NOT NULL DEFAULT 0,
	  total_due_cents          INTEGER NOT NULL,
	  currency                 TEXT    NOT NULL DEFAULT 'USD',
	  status                   TEXT    NOT NULL DEFAULT 'pending',
	  provider                 TEXT    NOT NULL,
	  provider_charge_id       TEXT,
	  provider_payment_intent  TEXT,
	  idempotency_key          TEXT    NOT NULL UNIQUE,
	  payment_reference        TEXT,
	  note                     TEXT,
	  paid_at                  TEXT,
	  credited_at              TEXT,
	  created_at               TEXT    NOT NULL DEFAULT (datetime('now')),
	  updated_at               TEXT    NOT NULL DEFAULT (datetime('now'))
	);
	CREATE INDEX IF NOT EXISTS topup_orders_user_status
	  ON topup_orders(user_id, status, created_at DESC);
	CREATE UNIQUE INDEX IF NOT EXISTS topup_orders_charge
	  ON topup_orders(provider, provider_charge_id)
	  WHERE provider_charge_id IS NOT NULL;

	CREATE TABLE IF NOT EXISTS webhook_events (
	  id               INTEGER PRIMARY KEY AUTOINCREMENT,
	  provider         TEXT    NOT NULL,
	  event_id         TEXT,
	  event_type       TEXT,
	  signature_ok     INTEGER NOT NULL DEFAULT 0,
	  processed        INTEGER NOT NULL DEFAULT 0,
	  processing_error TEXT,
	  raw_body         TEXT    NOT NULL,
	  received_at      TEXT    NOT NULL DEFAULT (datetime('now')),
	  processed_at     TEXT,
	  UNIQUE(provider, event_id)
	);
	CREATE INDEX IF NOT EXISTS webhook_events_processed ON webhook_events(processed, received_at);

	CREATE TABLE IF NOT EXISTS schema_migrations (
	  version    TEXT PRIMARY KEY,
	  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
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
	  migrate(connection)
	  seedCatalog(connection)

  handle = connection
  return handle
}

function hasColumn(connection: Database.Database, table: string, column: string): boolean {
	  const rows = connection.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
	  return rows.some((row) => row.name === column)
	}

	function addColumn(connection: Database.Database, table: string, definition: string) {
	  const [column] = definition.trim().split(/\s+/, 1)
	  if (!hasColumn(connection, table, column)) {
	    connection.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`)
	  }
	}

	/**
	 * Additive migrations only. Existing production rows are never deleted or
	 * rewritten except to populate safe defaults for newly introduced columns.
	 */
	function migrate(connection: Database.Database) {
	  connection.transaction(() => {
	    addColumn(connection, 'users', 'display_name TEXT')
	    addColumn(connection, 'users', 'email_verified_at TEXT')
	    addColumn(connection, 'users', 'is_admin INTEGER NOT NULL DEFAULT 0')
	    addColumn(connection, 'users', 'banned_at TEXT')

	    addColumn(connection, 'sessions', "last_seen_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00.000Z'")
	    addColumn(connection, 'sessions', 'user_agent TEXT')
	    addColumn(connection, 'sessions', 'ip_address TEXT')

	    addColumn(connection, 'credit_ledger', 'description TEXT')
	    addColumn(connection, 'credit_ledger', 'affects_balance INTEGER NOT NULL DEFAULT 1')

	    connection.prepare(
	      `UPDATE users
	          SET email_verified_at = COALESCE(email_verified_at, created_at)
	        WHERE email_verified_at IS NULL`,
	    ).run()
	    connection.prepare(
	      `UPDATE sessions
	          SET last_seen_at = CASE
	            WHEN last_seen_at = '1970-01-01T00:00:00.000Z' THEN created_at
	            ELSE last_seen_at
	          END`,
	    ).run()
    connection.prepare(
      `UPDATE credit_ledger
          SET affects_balance = CASE WHEN type IN ('hold', 'refund') THEN 0 ELSE 1 END`,
    ).run()

    connection.prepare(
      `INSERT INTO credit_ledger
         (user_id, amount_cents, type, ref_type, ref_id,
          balance_after_cents, description, affects_balance)
       SELECT u.id,
              u.credit_cents - COALESCE(l.balance, 0),
              'adjustment',
              'migration',
              'imeihub-backend-v1-' || u.id,
              u.credit_cents,
              'Opening balance imported during ledger migration',
              1
         FROM users u
         LEFT JOIN (
           SELECT user_id, SUM(amount_cents) AS balance
             FROM credit_ledger
            WHERE affects_balance = 1
            GROUP BY user_id
         ) l ON l.user_id = u.id
        WHERE u.credit_cents != COALESCE(l.balance, 0)
          AND NOT EXISTS (
            SELECT 1 FROM credit_ledger existing
             WHERE existing.ref_type = 'migration'
               AND existing.ref_id = 'imeihub-backend-v1-' || u.id
               AND existing.type = 'adjustment'
          )`,
    ).run()

    connection.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_unique_effect
	        ON credit_ledger(ref_type, ref_id, type)
	        WHERE ref_type IS NOT NULL AND ref_id IS NOT NULL AND affects_balance = 1;
	    `)

	    connection.prepare(
	      `INSERT OR IGNORE INTO topup_orders
	         (public_id, user_id, credit_amount_cents, fee_cents, tax_cents,
	          total_due_cents, currency, status, provider, idempotency_key,
	          payment_reference, note, paid_at, credited_at, created_at, updated_at)
	       SELECT reference, user_id, credit_amount_cents, fee_cents, tax_cents,
	              total_due_cents, currency,
	              CASE status WHEN 'success' THEN 'credited' ELSE status END,
	              gateway, 'legacy-' || reference, payment_reference, note,
	              CASE WHEN status = 'success' THEN updated_at ELSE NULL END,
	              CASE WHEN status = 'success' THEN updated_at ELSE NULL END,
	              created_at, updated_at
	         FROM invoices`,
	    ).run()

	    connection.prepare(
	      `INSERT OR IGNORE INTO schema_migrations(version) VALUES (?)`,
	    ).run('2026-08-imeihub-backend-v1')
	  })()
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
