/**
 * Seeds a demo account for the local rehearsal: one user, some credit, and
 * a few orders in each state so the workspace has something to look at.
 *
 * Local only — it writes credit straight into the ledger, which no running
 * code path is allowed to do. Never point this at a real database.
 *
 * The password hash format mirrors lib/auth.ts (`scrypt$salt$hash`); that
 * file is the source of truth if it ever changes.
 */
import { randomBytes, scryptSync } from 'node:crypto'
import { join } from 'node:path'
import Database from 'better-sqlite3'

const DB_PATH = process.env.OPENLINE_DB ?? join(process.cwd(), 'data', 'local.db')
const USERNAME = 'demo'
const PASSWORD = 'demo-password-123'
const EMAIL = 'demo@openline.test'
const START_CENTS = 25_000

function hashPassword(password) {
  const salt = randomBytes(16)
  return `scrypt$${salt.toString('hex')}$${scryptSync(password, salt, 64).toString('hex')}`
}

const db = new Database(DB_PATH)
db.pragma('foreign_keys = ON')

// The app owns the schema and creates it on first use, so this refuses to
// invent tables of its own — start the app once, then seed.
const ready = db
  .prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table' AND name IN ('users','orders','credit_ledger')")
  .get().n
if (ready < 3) {
  console.error(`  ${DB_PATH} has no schema yet. Start the app once so it creates one, then run this again.`)
  process.exit(1)
}

const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(USERNAME)
if (existing) {
  console.log(`  demo account already present (user #${existing.id}) — leaving it alone`)
  process.exit(0)
}

const seed = db.transaction(() => {
  const user = db
    .prepare('INSERT INTO users (username, email, password_hash, credit_cents) VALUES (?, ?, ?, ?)')
    .run(USERNAME, EMAIL, hashPassword(PASSWORD), START_CENTS)
  const userId = Number(user.lastInsertRowid)

  db.prepare(
    `INSERT INTO credit_ledger (user_id, amount_cents, type, ref_type, ref_id, balance_after_cents)
     VALUES (?, ?, 'topup', 'seed', 'demo', ?)`,
  ).run(userId, START_CENTS, START_CENTS)

  const insertOrder = db.prepare(
    `INSERT INTO orders
       (user_id, kind, brand_id, carrier_id, service_id, imei, delivery_email,
        status, delivery, unlock_code, result_json, price_cents, eta_hours, error_message)
     VALUES (@userId, @kind, @brandId, @carrierId, @serviceId, @imei, @email,
             @status, @delivery, @code, @result, @price, @eta, @error)`,
  )

  const charge = db.prepare(
    'UPDATE users SET credit_cents = credit_cents - ? WHERE id = ?',
  )
  const holdCredit = db.prepare('UPDATE users SET held_cents = held_cents + ? WHERE id = ?')
  const ledger = db.prepare(
    `INSERT INTO credit_ledger (user_id, amount_cents, type, ref_type, ref_id, balance_after_cents)
     VALUES (?, ?, ?, 'order', ?, ?)`,
  )

  const delivered = {
    source: 'seed',
    note: 'Sample result. Connect a real supplier to return live authorisations.',
    outcome: 'Unlock code issued',
    permanent: 'Yes — the device stays unlocked through updates and resets.',
  }

  let balance = START_CENTS

  // Delivered: charged, code in hand.
  const one = insertOrder.run({
    userId, kind: 'carrier_unlock', brandId: 2, carrierId: 101, serviceId: null,
    imei: '354909000000095', email: EMAIL, status: 'delivered', delivery: 'code',
    code: '48120973', result: JSON.stringify(delivered), price: 2499, eta: 24, error: null,
  })
  charge.run(2499, userId)
  balance -= 2499
  ledger.run(userId, -2499, 'charge', String(one.lastInsertRowid), balance)

  // Still with the carrier: credit held, not spent.
  const two = insertOrder.run({
    userId, kind: 'carrier_unlock', brandId: 1, carrierId: 202, serviceId: null,
    imei: '354909000000012', email: EMAIL, status: 'processing', delivery: 'remote',
    code: null, result: null, price: 1899, eta: 12, error: null,
  })
  holdCredit.run(1899, userId)
  ledger.run(userId, -1899, 'hold', String(two.lastInsertRowid), balance - 1899)

  // Refused: held, then given straight back.
  const three = insertOrder.run({
    userId, kind: 'carrier_unlock', brandId: 3, carrierId: 103, serviceId: null,
    imei: '354909000000020', email: EMAIL, status: 'unavailable', delivery: 'code',
    code: null, result: null, price: 1999, eta: 12,
    error: 'The carrier will not authorise this device.',
  })
  ledger.run(userId, -1999, 'hold', String(three.lastInsertRowid), balance - 1999)
  ledger.run(userId, 1999, 'refund', String(three.lastInsertRowid), balance)

  return userId
})

const userId = seed()
const { credit_cents: credit, held_cents: held } = db
  .prepare('SELECT credit_cents, held_cents FROM users WHERE id = ?')
  .get(userId)

console.log(`  user #${userId} "${USERNAME}" — ${((credit - held) / 100).toFixed(2)} available, ${(held / 100).toFixed(2)} held`)
console.log('  3 orders: one delivered, one with the carrier, one refused and refunded')
