import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import Database from 'better-sqlite3'
import { BRANDS, CARRIERS, DEVICE_SERVICES } from './catalog'
import { toCents } from './money'
import { PAID_REPORT_PRODUCTS } from './paid-report-catalog'

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
  email_verified_at  TEXT,
  password_hash      TEXT    NOT NULL,
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
  provider_order_id      TEXT,
  -- Mock supplier only: when the order becomes resolvable.
  provider_ready_at      TEXT,
  provider_name          TEXT,
  provider_mode          TEXT,
  provider_service_id    TEXT,
  provider_last_polled_at TEXT,
  provider_attempts      INTEGER NOT NULL DEFAULT 0,
  provider_error_code    TEXT,
  idempotency_key        TEXT,
  error_message          TEXT,
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
  provider           TEXT,
  provider_charge_id TEXT,
  idempotency_key    TEXT,
  paid_at            TEXT,
  credited_at        TEXT,
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

CREATE TABLE IF NOT EXISTS admin_credit_adjustments (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  public_id            TEXT    NOT NULL UNIQUE,
  admin_user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  target_user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  amount_cents         INTEGER NOT NULL CHECK(amount_cents != 0),
  reason               TEXT    NOT NULL CHECK(length(reason) BETWEEN 8 AND 240),
  idempotency_key      TEXT    NOT NULL,
  credit_before_cents  INTEGER NOT NULL,
  held_before_cents    INTEGER NOT NULL,
  credit_after_cents   INTEGER NOT NULL,
  held_after_cents     INTEGER NOT NULL,
  created_at           TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(admin_user_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS admin_credit_adjustments_target
  ON admin_credit_adjustments(target_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS admin_credit_adjustments_admin
  ON admin_credit_adjustments(admin_user_id, created_at DESC);
CREATE TRIGGER IF NOT EXISTS admin_credit_adjustments_no_update
  BEFORE UPDATE ON admin_credit_adjustments
  BEGIN SELECT RAISE(ABORT, 'admin credit adjustments are append-only'); END;
CREATE TRIGGER IF NOT EXISTS admin_credit_adjustments_no_delete
  BEFORE DELETE ON admin_credit_adjustments
  BEGIN SELECT RAISE(ABORT, 'admin credit adjustments are append-only'); END;

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

		CREATE TABLE IF NOT EXISTS oauth_accounts (
		  provider         TEXT    NOT NULL,
		  provider_subject TEXT    NOT NULL,
		  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		  provider_email   TEXT,
		  created_at       TEXT    NOT NULL DEFAULT (datetime('now')),
		  updated_at       TEXT    NOT NULL DEFAULT (datetime('now')),
		  PRIMARY KEY (provider, provider_subject),
		  UNIQUE (provider, user_id)
		);
		CREATE INDEX IF NOT EXISTS oauth_accounts_user ON oauth_accounts(user_id);

		CREATE TABLE IF NOT EXISTS oauth_transactions (
		  id            TEXT    PRIMARY KEY,
		  provider      TEXT    NOT NULL,
		  state_hash    TEXT    NOT NULL,
		  code_verifier TEXT    NOT NULL,
		  nonce         TEXT    NOT NULL,
		  expires_at    TEXT    NOT NULL,
		  consumed_at   TEXT,
		  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
		);
			CREATE INDEX IF NOT EXISTS oauth_transactions_expiry ON oauth_transactions(expires_at);

		CREATE TABLE IF NOT EXISTS imei_checks (
		  id                      INTEGER PRIMARY KEY AUTOINCREMENT,
		  user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
		  check_type              TEXT    NOT NULL DEFAULT 'basic',
		  imei_fingerprint        TEXT    NOT NULL,
		  masked_imei             TEXT    NOT NULL,
		  status                  TEXT    NOT NULL DEFAULT 'queued',
		  provider                TEXT    NOT NULL DEFAULT 'local-validation',
		  provider_check_id       TEXT,
		  provider_mode           TEXT,
		  provider_service_id     TEXT,
		  provider_last_polled_at TEXT,
		  provider_attempts       INTEGER NOT NULL DEFAULT 0,
		  provider_error_code     TEXT,
		  idempotency_key         TEXT,
		  result_json             TEXT,
		  error_message           TEXT,
		  created_at              TEXT    NOT NULL DEFAULT (datetime('now')),
		  updated_at              TEXT    NOT NULL DEFAULT (datetime('now'))
		);
		CREATE INDEX IF NOT EXISTS imei_checks_user ON imei_checks(user_id, created_at DESC);
			CREATE INDEX IF NOT EXISTS imei_checks_fingerprint ON imei_checks(imei_fingerprint, created_at DESC);

      CREATE TABLE IF NOT EXISTS paid_report_products (
        code                 TEXT PRIMARY KEY,
        slug                 TEXT NOT NULL UNIQUE,
        name                 TEXT NOT NULL,
        summary              TEXT NOT NULL,
        input_type           TEXT NOT NULL DEFAULT 'imei',
        price_cents          INTEGER NOT NULL CHECK (price_cents > 0),
        provider_cost_micros INTEGER NOT NULL DEFAULT 0 CHECK (provider_cost_micros >= 0),
        eta_minutes          INTEGER NOT NULL DEFAULT 1 CHECK (eta_minutes > 0),
        is_active            INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
        sort_order           INTEGER NOT NULL DEFAULT 0,
        created_at           TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at           TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS paid_report_products_active
        ON paid_report_products(is_active, sort_order, code);

      CREATE TABLE IF NOT EXISTS paid_report_orders (
        id                      INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id                 INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
        product_code            TEXT NOT NULL REFERENCES paid_report_products(code) ON DELETE RESTRICT,
        product_name            TEXT NOT NULL,
        input_type              TEXT NOT NULL DEFAULT 'imei',
        imei_fingerprint        TEXT NOT NULL,
        masked_imei             TEXT NOT NULL,
        status                  TEXT NOT NULL DEFAULT 'processing',
        price_cents             INTEGER NOT NULL CHECK (price_cents > 0),
        provider_cost_micros    INTEGER NOT NULL DEFAULT 0 CHECK (provider_cost_micros >= 0),
        source                  TEXT NOT NULL DEFAULT 'website',
        idempotency_key         TEXT,
        report_json             TEXT,
        provider_order_id       TEXT,
        provider_name           TEXT,
        provider_mode           TEXT,
        provider_service_id     TEXT,
        provider_last_polled_at TEXT,
        provider_attempts       INTEGER NOT NULL DEFAULT 0,
        provider_error_code     TEXT,
        error_message           TEXT,
        completed_at            TEXT,
        created_at              TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at              TEXT NOT NULL DEFAULT (datetime('now')),
        CHECK (status IN ('processing', 'completed', 'refunded', 'manual_review'))
      );
      CREATE INDEX IF NOT EXISTS paid_report_orders_user
        ON paid_report_orders(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS paid_report_orders_status
        ON paid_report_orders(status, provider_last_polled_at);

					CREATE TABLE IF NOT EXISTS provider_events (
				  id              INTEGER PRIMARY KEY AUTOINCREMENT,
				  resource_type   TEXT    NOT NULL,
				  resource_id     INTEGER NOT NULL,
				  provider        TEXT    NOT NULL,
				  provider_mode   TEXT    NOT NULL,
				  event_type      TEXT    NOT NULL,
				  idempotency_key TEXT,
				  status_code     INTEGER,
				  duration_ms     INTEGER,
				  error_code      TEXT,
				  metadata_json   TEXT,
				  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
				);
				CREATE INDEX IF NOT EXISTS provider_events_resource
				  ON provider_events(resource_type, resource_id, created_at DESC);

				CREATE TABLE IF NOT EXISTS unlock_waitlist (
				  id              INTEGER PRIMARY KEY AUTOINCREMENT,
				  user_id         INTEGER REFERENCES users(id) ON DELETE SET NULL,
				  email           TEXT    NOT NULL,
				  -- Same rule as everywhere else: the number is never stored in
				  -- the clear, only fingerprinted and masked for display.
				  imei_fingerprint TEXT,
				  masked_imei     TEXT,
				  carrier_id      INTEGER,
				  notified_at     TEXT,
				  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
				);
				CREATE UNIQUE INDEX IF NOT EXISTS unlock_waitlist_unique
				  ON unlock_waitlist(email, imei_fingerprint);

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
	      seedPaidReportCatalog(connection)
      applyProviderProductCatalogRollout(connection)

	  handle = connection
  return handle
}

function hasTable(connection: Database.Database, table: string): boolean {
  return Boolean(
    connection
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(table),
  )
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

function migrationApplied(connection: Database.Database, version: string): boolean {
  return Boolean(connection.prepare('SELECT 1 FROM schema_migrations WHERE version = ?').get(version))
}

/** Additive compatibility migrations. Existing tables and financial rows remain readable. */
function migrate(connection: Database.Database) {
  connection.transaction(() => {
    addColumn(connection, 'users', 'email_verified_at TEXT')
    addColumn(connection, 'users', 'banned_at TEXT')
    addColumn(connection, 'credit_ledger', 'description TEXT')
    addColumn(connection, 'credit_ledger', 'affects_balance INTEGER NOT NULL DEFAULT 1')
    addColumn(connection, 'invoices', 'provider TEXT')
    addColumn(connection, 'invoices', 'provider_charge_id TEXT')
    addColumn(connection, 'invoices', 'idempotency_key TEXT')
    addColumn(connection, 'invoices', 'paid_at TEXT')
    addColumn(connection, 'invoices', 'credited_at TEXT')
    addColumn(connection, 'orders', 'provider_name TEXT')
    addColumn(connection, 'orders', 'provider_mode TEXT')
    addColumn(connection, 'orders', 'provider_service_id TEXT')
    addColumn(connection, 'orders', 'provider_last_polled_at TEXT')
    addColumn(connection, 'orders', 'provider_attempts INTEGER NOT NULL DEFAULT 0')
    addColumn(connection, 'orders', 'provider_error_code TEXT')
    addColumn(connection, 'imei_checks', 'provider_mode TEXT')
    addColumn(connection, 'imei_checks', 'provider_service_id TEXT')
    addColumn(connection, 'imei_checks', 'provider_last_polled_at TEXT')
    addColumn(connection, 'imei_checks', 'provider_attempts INTEGER NOT NULL DEFAULT 0')
    addColumn(connection, 'imei_checks', 'provider_error_code TEXT')
    addColumn(connection, 'orders', 'idempotency_key TEXT')

    if (!migrationApplied(connection, '2026-08-imeihub-backend-v1')) {

      connection
        .prepare(
          `UPDATE users
              SET email_verified_at = COALESCE(email_verified_at, created_at)
            WHERE email_verified_at IS NULL`,
        )
        .run()
      connection
        .prepare(
          `UPDATE credit_ledger
              SET affects_balance = CASE WHEN type IN ('hold', 'refund') THEN 0 ELSE 1 END`,
        )
        .run()
      connection
        .prepare(
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
            WHERE u.credit_cents != COALESCE(l.balance, 0)`,
        )
        .run()
      connection
        .prepare('INSERT INTO schema_migrations(version) VALUES (?)')
        .run('2026-08-imeihub-backend-v1')
    }

    connection.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_unique_effect
        ON credit_ledger(ref_type, ref_id, type)
        WHERE ref_type IS NOT NULL AND ref_id IS NOT NULL AND affects_balance = 1;
    `)

    /*
     * credit_ledger_unique_transition covers every effect, not just the
     * balance-changing ones — without it a refund applied twice releases a
     * second order's hold and that order can never be charged.
     *
     * It is created here rather than beside the index above because a
     * database that already contains a duplicate cannot take it, and an
     * unguarded CREATE UNIQUE INDEX in the connection path means the
     * application cannot open its own database at all. Check first, and
     * leave the narrower index alone if there is anything to reconcile:
     * lib/credits.ts refuses a duplicate on its own, so this is the
     * backstop rather than the control.
     */
    if (!migrationApplied(connection, '2026-09-ledger-effect-uniqueness-v1')) {
      const duplicates = connection
        .prepare(
          `SELECT COUNT(*) AS count FROM (
             SELECT 1 FROM credit_ledger
              WHERE ref_type IS NOT NULL AND ref_id IS NOT NULL
              GROUP BY ref_type, ref_id, type
             HAVING COUNT(*) > 1
           )`,
        )
        .get() as { count: number }

      if (duplicates.count === 0) {
        connection.exec(`
          CREATE UNIQUE INDEX IF NOT EXISTS credit_ledger_unique_transition
            ON credit_ledger(ref_type, ref_id, type)
            WHERE ref_type IS NOT NULL AND ref_id IS NOT NULL;
        `)
        connection
          .prepare('INSERT INTO schema_migrations(version) VALUES (?)')
          .run('2026-09-ledger-effect-uniqueness-v1')
      } else {
        console.error(
          `[db] ${duplicates.count} duplicate credit_ledger transitions — ` +
            'credit_ledger_unique_transition not created; reconcile them and restart',
        )
      }
    }

    if (!migrationApplied(connection, '2026-08-unlockservice-native-v2')) {
      if (hasTable(connection, 'topup_orders')) {
        connection
          .prepare(
            `INSERT OR IGNORE INTO invoices
               (reference, user_id, gateway, credit_amount_cents, fee_cents,
                tax_cents, total_due_cents, currency, status,
                payment_reference, note, provider, provider_charge_id,
                idempotency_key, paid_at, credited_at, created_at, updated_at)
             SELECT public_id, user_id, provider, credit_amount_cents, fee_cents,
                    tax_cents, total_due_cents, currency,
                    CASE status
                      WHEN 'credited' THEN 'success'
                      WHEN 'expired' THEN 'failed'
                      WHEN 'paid' THEN 'review'
                      ELSE status
                    END,
                    payment_reference, note, provider, provider_charge_id,
                    idempotency_key, paid_at, credited_at, created_at, updated_at
               FROM topup_orders`,
          )
          .run()
        connection
          .prepare(
            `UPDATE invoices
                SET provider = COALESCE(provider, (SELECT t.provider FROM topup_orders t WHERE t.public_id = invoices.reference)),
                    provider_charge_id = COALESCE(provider_charge_id, (SELECT t.provider_charge_id FROM topup_orders t WHERE t.public_id = invoices.reference)),
                    idempotency_key = COALESCE(idempotency_key, (SELECT t.idempotency_key FROM topup_orders t WHERE t.public_id = invoices.reference)),
                    paid_at = COALESCE(paid_at, (SELECT t.paid_at FROM topup_orders t WHERE t.public_id = invoices.reference)),
                    credited_at = COALESCE(credited_at, (SELECT t.credited_at FROM topup_orders t WHERE t.public_id = invoices.reference))
              WHERE EXISTS (SELECT 1 FROM topup_orders t WHERE t.public_id = invoices.reference)`,
          )
          .run()
      }

      connection
        .prepare(
          `UPDATE invoices
              SET provider = COALESCE(provider, gateway),
                  idempotency_key = COALESCE(idempotency_key, 'invoice-' || reference),
                  paid_at = CASE WHEN status = 'success' THEN COALESCE(paid_at, updated_at) ELSE paid_at END,
                  credited_at = CASE WHEN status = 'success' THEN COALESCE(credited_at, updated_at) ELSE credited_at END`,
        )
        .run()
      connection
        .prepare('INSERT INTO schema_migrations(version) VALUES (?)')
        .run('2026-08-unlockservice-native-v2')
    }

    if (!migrationApplied(connection, '2026-08-google-oauth-v1')) {
      connection.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run('2026-08-google-oauth-v1')
    }

    if (!migrationApplied(connection, '2026-08-imei-check-v1')) {
      connection.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run('2026-08-imei-check-v1')
    }

    if (!migrationApplied(connection, '2026-08-provider-architecture-v1')) {
      connection.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run('2026-08-provider-architecture-v1')
    }

    if (!migrationApplied(connection, '2026-09-paid-imei-reports-v1')) {
      connection.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run('2026-09-paid-imei-reports-v1')
    }

    if (!migrationApplied(connection, '2026-09-admin-credit-adjustments-v1')) {
      connection.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run('2026-09-admin-credit-adjustments-v1')
    }

    connection.exec(`
      CREATE UNIQUE INDEX IF NOT EXISTS invoices_idempotency
        ON invoices(idempotency_key) WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS invoices_provider_charge
        ON invoices(provider, provider_charge_id) WHERE provider_charge_id IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS imei_checks_idempotency
        ON imei_checks(user_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS provider_events_idempotency
        ON provider_events(resource_type, resource_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS orders_idempotency
        ON orders(user_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
      CREATE UNIQUE INDEX IF NOT EXISTS paid_report_orders_idempotency
        ON paid_report_orders(user_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    `)
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

/** Seed candidate paid-report products without activating or repricing existing rows. */
function seedPaidReportCatalog(connection: Database.Database) {
  const statement = connection.prepare(`
    INSERT INTO paid_report_products
      (code, slug, name, summary, input_type, price_cents, provider_cost_micros,
       eta_minutes, is_active, sort_order)
    VALUES
      (@code, @slug, @name, @summary, @inputType, @priceCents, @providerCostMicros,
       @etaMinutes, @isActive, @sortOrder)
    ON CONFLICT(code) DO UPDATE SET
      slug = excluded.slug,
      name = excluded.name,
      summary = excluded.summary,
      input_type = excluded.input_type,
      provider_cost_micros = excluded.provider_cost_micros,
      eta_minutes = excluded.eta_minutes,
      sort_order = excluded.sort_order,
      updated_at = datetime('now')
  `)

  connection.transaction(() => {
    for (const product of PAID_REPORT_PRODUCTS) {
      statement.run({ ...product, isActive: product.isActive ? 1 : 0 })
    }
  })()
}

function applyProviderProductCatalogRollout(connection: Database.Database) {
  const version = '2026-09-provider-product-catalog-v2'
  if (migrationApplied(connection, version)) return

  connection.transaction(() => {
    connection.prepare("UPDATE paid_report_products SET is_active = 0, updated_at = datetime('now')").run()
    const activate = connection.prepare(
      "UPDATE paid_report_products SET is_active = 1, updated_at = datetime('now') WHERE code = ? AND price_cents * 10000 > provider_cost_micros",
    )
    let activated = 0
    for (const product of PAID_REPORT_PRODUCTS) activated += activate.run(product.code).changes
    if (activated !== PAID_REPORT_PRODUCTS.length) {
      throw new Error(`provider product activation mismatch: ${activated}/${PAID_REPORT_PRODUCTS.length}`)
    }
    connection.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(version)
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
