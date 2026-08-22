import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { CATALOG } from './catalog'
import { toCents } from './money'

/**
 * SQLite so the whole thing runs with `npm run dev` and no services to
 * start. Every statement here is plain SQL against a schema that mirrors
 * docs/reference/baseimei-backend-flow.md §7, so moving to Postgres later
 * is a driver swap rather than a redesign.
 */

const DB_PATH = process.env.OPENLINE_DB ?? join(process.cwd(), 'data', 'openline.db')

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  username           TEXT    NOT NULL UNIQUE,
  email              TEXT    NOT NULL UNIQUE,
  password_hash      TEXT    NOT NULL,
  -- credit_cents is everything the account owns; held_cents is the part
  -- reserved by in-flight checks. Available = credit_cents - held_cents.
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

CREATE TABLE IF NOT EXISTS services (
  id               INTEGER PRIMARY KEY,
  name             TEXT    NOT NULL,
  sell_price_cents INTEGER NOT NULL,
  -- Provider cost was never exposed by the observed system and is not
  -- invented here; it stays NULL until a real provider contract fills it.
  cost_price_cents INTEGER,
  identifier_type  TEXT    NOT NULL DEFAULT 'imei',
  is_active        INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS check_logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  service_id        INTEGER NOT NULL REFERENCES services(id),
  identifier        TEXT    NOT NULL,
  status            TEXT    NOT NULL,
  response_json     TEXT,
  sell_price_cents  INTEGER NOT NULL,
  source            TEXT    NOT NULL DEFAULT 'website',
  provider_order_id TEXT,
  -- Mock provider only: when a pending order becomes resolvable.
  provider_ready_at TEXT,
  error_message     TEXT,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS check_logs_user ON check_logs(user_id, created_at DESC);

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
  seedServices(connection)

  handle = connection
  return handle
}

/** Idempotent: prices and names follow the catalog, ids never move. */
function seedServices(connection: Database.Database) {
  const upsert = connection.prepare(`
    INSERT INTO services (id, name, sell_price_cents, identifier_type, is_active)
    VALUES (@id, @name, @sell, @identifierType, 1)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      sell_price_cents = excluded.sell_price_cents,
      identifier_type = excluded.identifier_type
  `)
  const run = connection.transaction(() => {
    for (const entry of CATALOG) {
      upsert.run({
        id: entry.id,
        name: entry.name,
        sell: toCents(entry.sellPriceUsd),
        identifierType: entry.identifierType,
      })
    }
  })
  run()
}

export type ServiceRow = {
  id: number
  name: string
  sell_price_cents: number
  identifier_type: 'imei' | 'serial' | 'both'
  is_active: number
}

export function listServices(): ServiceRow[] {
  return db()
    .prepare('SELECT * FROM services WHERE is_active = 1 ORDER BY name COLLATE NOCASE')
    .all() as ServiceRow[]
}

export function getService(id: number): ServiceRow | undefined {
  return db().prepare('SELECT * FROM services WHERE id = ? AND is_active = 1').get(id) as
    | ServiceRow
    | undefined
}
