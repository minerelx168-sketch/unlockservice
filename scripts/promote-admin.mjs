import { resolve } from 'node:path'
import Database from 'better-sqlite3'

const identity = process.argv[2]?.trim().toLowerCase()
if (!identity) {
  console.error('Usage: npm run admin:promote -- <username-or-email>')
  process.exit(1)
}

const databasePath = process.env.IUNLOCKMOBILE_DB ?? resolve(process.cwd(), 'data', 'iunlockmobile.db')
const connection = new Database(databasePath)
connection.pragma('foreign_keys = ON')

try {
  const account = connection
    .prepare(
      `SELECT id, username, email, account_type, status, banned_at
         FROM users
        WHERE lower(username) = ? OR lower(email) = ?
        LIMIT 1`,
    )
    .get(identity, identity)

  if (!account) {
    console.error(`No account matched ${identity}. Register the account through the website first.`)
    process.exitCode = 2
  } else if (account.status !== 'active' || account.banned_at) {
    console.error('Refusing to promote an inactive or banned account.')
    process.exitCode = 3
  } else {
    connection.transaction(() => {
      connection
        .prepare(
          `UPDATE users
              SET account_type = 'admin',
                  email_verified_at = COALESCE(email_verified_at, datetime('now'))
            WHERE id = ?`,
        )
        .run(account.id)
      connection.prepare('DELETE FROM sessions WHERE user_id = ?').run(account.id)
    })()

    const promoted = connection
      .prepare('SELECT id, username, email, account_type, status FROM users WHERE id = ?')
      .get(account.id)
    console.log(JSON.stringify({ databasePath, promoted }, null, 2))
  }
} finally {
  connection.close()
}
