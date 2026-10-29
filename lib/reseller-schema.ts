import type Database from 'better-sqlite3'

/** Additive migration; the existing credit/hold contract remains authoritative. */
export function migrateResellers(connection: Database.Database) {
  connection.transaction(() => {
    const version = '2026-10-reseller-wallet-v1'
    if (connection.prepare('SELECT 1 FROM schema_migrations WHERE version=?').get(version)) return
    connection.exec(`
      ALTER TABLE users ADD COLUMN reseller_since TEXT;
      ALTER TABLE users ADD COLUMN reseller_invoice TEXT;
      ALTER TABLE users ADD COLUMN role TEXT GENERATED ALWAYS AS
        (CASE account_type WHEN 'customer' THEN 'RETAIL' WHEN 'reseller' THEN 'RESELLER' WHEN 'admin' THEN 'ADMIN' ELSE NULL END) VIRTUAL;
      ALTER TABLE users ADD COLUMN wallet_balance_cents INTEGER GENERATED ALWAYS AS (credit_cents-held_cents) VIRTUAL;
      ALTER TABLE paid_report_products ADD COLUMN retail_price_cents INTEGER
        GENERATED ALWAYS AS (price_cents) VIRTUAL;
      ALTER TABLE paid_report_products ADD COLUMN reseller_price_cents INTEGER GENERATED ALWAYS AS
        (CASE WHEN price_cents > 0 AND provider_cost_micros >= 0 AND provider_cost_micros <= price_cents * 10000
          THEN CAST((price_cents * 10000 + provider_cost_micros + 19999) / 20000 AS INTEGER) ELSE NULL END) VIRTUAL;
      CREATE TABLE wallet_transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id),
        type TEXT NOT NULL CHECK(type IN ('TOPUP','ORDER_DEDUCTION','AUTO_REFUND','ADMIN_ADJUSTMENT')),
        amount_cents INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD' CHECK(currency='USD'),
        balance_after_cents INTEGER NOT NULL,
        ref_type TEXT, ref_id TEXT,
        credit_ledger_id INTEGER UNIQUE REFERENCES credit_ledger(id),
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX wallet_transactions_user ON wallet_transactions(user_id,id);
      -- Opening available balances preserve history without reclassifying old settlements.
      INSERT INTO wallet_transactions(user_id,type,amount_cents,balance_after_cents,ref_type,ref_id)
        SELECT id,'ADMIN_ADJUSTMENT',credit_cents-held_cents,credit_cents-held_cents,'migration','opening-v1'
        FROM users WHERE credit_cents != held_cents;
      CREATE TRIGGER wallet_transactions_no_update BEFORE UPDATE ON wallet_transactions
        BEGIN SELECT RAISE(ABORT,'wallet transactions are append-only'); END;
      CREATE TRIGGER wallet_transactions_no_delete BEFORE DELETE ON wallet_transactions
        BEGIN SELECT RAISE(ABORT,'wallet transactions are append-only'); END;
      CREATE TRIGGER credit_ledger_no_update BEFORE UPDATE ON credit_ledger
        BEGIN SELECT RAISE(ABORT,'credit ledger is append-only'); END;
      CREATE TRIGGER credit_ledger_no_delete BEFORE DELETE ON credit_ledger
        BEGIN SELECT RAISE(ABORT,'credit ledger is append-only'); END;
      CREATE TRIGGER wallet_from_credit_ledger AFTER INSERT ON credit_ledger
        WHEN NEW.type IN ('topup','bonus','hold','refund','adjustment') BEGIN
        INSERT INTO wallet_transactions(user_id,type,amount_cents,balance_after_cents,ref_type,ref_id,credit_ledger_id)
          VALUES(NEW.user_id,CASE NEW.type WHEN 'hold' THEN 'ORDER_DEDUCTION' WHEN 'refund' THEN 'AUTO_REFUND'
            WHEN 'adjustment' THEN 'ADMIN_ADJUSTMENT' ELSE 'TOPUP' END,
            NEW.amount_cents,NEW.balance_after_cents,NEW.ref_type,NEW.ref_id,NEW.id);
      END;
      CREATE TRIGGER reseller_membership_permanent BEFORE UPDATE OF account_type,reseller_since ON users
        WHEN OLD.reseller_since IS NOT NULL AND (NEW.account_type NOT IN ('reseller','admin') OR NEW.reseller_since IS NULL)
        BEGIN SELECT RAISE(ABORT,'reseller membership is permanent; suspend access with account status'); END;
      CREATE TABLE reseller_api_keys (
        id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id),
        name TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')), last_used_at TEXT, revoked_at TEXT
      );
      CREATE INDEX reseller_keys_user ON reseller_api_keys(user_id);
      CREATE TABLE reseller_webhooks (
        user_id INTEGER PRIMARY KEY REFERENCES users(id), url TEXT NOT NULL, secret_encrypted TEXT NOT NULL,
        version TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE reseller_webhook_events (
        id TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
        order_id INTEGER NOT NULL REFERENCES paid_report_orders(id), event TEXT NOT NULL,
        endpoint_version TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
        next_at INTEGER NOT NULL DEFAULT 0, lease_until INTEGER NOT NULL DEFAULT 0,
        sent_at TEXT, last_error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
        UNIQUE(order_id,event)
      );
      CREATE INDEX reseller_webhooks_pending ON reseller_webhook_events(next_at,lease_until) WHERE sent_at IS NULL;
      -- Commit notification intent in the same transaction as the terminal order status.
      CREATE TRIGGER reseller_result_outbox AFTER UPDATE OF status ON paid_report_orders
        WHEN NEW.status IN ('completed','refunded') AND OLD.status NOT IN ('completed','refunded')
          AND EXISTS(SELECT 1 FROM users WHERE id=NEW.user_id AND account_type='reseller') BEGIN
        INSERT OR IGNORE INTO reseller_webhook_events(id,user_id,order_id,event,endpoint_version)
          SELECT lower(hex(randomblob(16))),NEW.user_id,NEW.id,'order.'||NEW.status,version
          FROM reseller_webhooks WHERE user_id=NEW.user_id AND enabled=1;
      END;
    `)
    // Honor already verified, unreversed qualifying deposits; never use admin adjustments or guest purchases.
    connection.exec(`UPDATE users SET account_type='reseller',reseller_since=datetime('now'),reseller_invoice=(
      SELECT i.reference FROM invoices i
      WHERE i.user_id=users.id AND i.currency='USD' AND i.status='success' AND i.credit_amount_cents>=10000
        AND i.credited_at IS NOT NULL
        AND EXISTS(SELECT 1 FROM credit_ledger l WHERE l.user_id=i.user_id AND l.ref_type='invoice' AND l.ref_id=i.reference AND l.type='topup' AND l.amount_cents>=10000)
        AND NOT EXISTS(SELECT 1 FROM guest_checkouts g WHERE g.crypto_invoice_reference=i.reference)
        AND (EXISTS(SELECT 1 FROM whop_topups w WHERE w.invoice_reference=i.reference AND w.environment='live' AND w.credited=1 AND w.reversed_cents=0 AND w.review_reason IS NULL)
          OR EXISTS(SELECT 1 FROM invoice_verifications v WHERE v.invoice_reference=i.reference AND v.status='verified' AND v.verified_credit_cents>=10000 AND v.tx_hash IS NOT NULL))
      ORDER BY i.credited_at LIMIT 1)
      WHERE account_type='customer' AND EXISTS(
        SELECT 1 FROM invoices i WHERE i.user_id=users.id AND i.currency='USD' AND i.status='success' AND i.credit_amount_cents>=10000 AND i.credited_at IS NOT NULL
        AND EXISTS(SELECT 1 FROM credit_ledger l WHERE l.user_id=i.user_id AND l.ref_type='invoice' AND l.ref_id=i.reference AND l.type='topup' AND l.amount_cents>=10000)
        AND NOT EXISTS(SELECT 1 FROM guest_checkouts g WHERE g.crypto_invoice_reference=i.reference)
        AND (EXISTS(SELECT 1 FROM whop_topups w WHERE w.invoice_reference=i.reference AND w.environment='live' AND w.credited=1 AND w.reversed_cents=0 AND w.review_reason IS NULL)
          OR EXISTS(SELECT 1 FROM invoice_verifications v WHERE v.invoice_reference=i.reference AND v.status='verified' AND v.verified_credit_cents>=10000 AND v.tx_hash IS NOT NULL)))`)
    connection.prepare('INSERT INTO schema_migrations(version) VALUES (?)').run(version)
  }).immediate()
}
