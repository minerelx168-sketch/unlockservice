import { db } from './db'

export type AdminOverview = {
  users: number
  activeUsers: number
  admins: number
  orders: number
  processingOrders: number
  pendingInvoices: number
}

export type AdminUserRow = {
  id: number
  username: string
  email: string
  account_type: string
  membership_tier: string
  status: string
  credit_cents: number
  held_cents: number
  created_at: string
}

/** Aggregate operational counts for the server-rendered administrator dashboard. */
export function adminOverview(): AdminOverview {
  return db()
    .prepare(
      `SELECT
         (SELECT COUNT(*) FROM users) AS users,
         (SELECT COUNT(*) FROM users WHERE status = 'active' AND banned_at IS NULL) AS activeUsers,
         (SELECT COUNT(*) FROM users WHERE account_type = 'admin') AS admins,
         (SELECT COUNT(*) FROM orders) AS orders,
         (SELECT COUNT(*) FROM orders WHERE status = 'processing') AS processingOrders,
         (SELECT COUNT(*) FROM invoices WHERE status IN ('pending', 'review')) AS pendingInvoices`,
    )
    .get() as AdminOverview
}

/** Recent accounts for administrator review. Keep writes in explicit admin actions. */
export function listAdminUsers(limit = 25): AdminUserRow[] {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
  return db()
    .prepare(
      `SELECT id, username, email, account_type, membership_tier, status,
              credit_cents, held_cents, created_at
         FROM users
        ORDER BY id DESC
        LIMIT ?`,
    )
    .all(safeLimit) as AdminUserRow[]
}
