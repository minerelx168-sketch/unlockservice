import { db } from './db'

export const ADMIN_PAYMENT_PAGE_SIZE = 25
export type AdminPaymentFilter = 'all' | 'open' | 'success' | 'closed'

export type AdminPaymentRow = {
  reference: string
  username: string
  email: string
  gateway: string
  payment_network_id: string | null
  payment_asset_code: string | null
  credit_amount_cents: number
  total_due_cents: number
  currency: string
  status: string
  verification_status: string | null
  created_at: string
  paid_at: string | null
  credited_at: string | null
}

export type AdminPaymentHistory = {
  rows: AdminPaymentRow[]
  total: number
  page: number
  pageCount: number
  invalidReference: boolean
}

const FILTER_CONDITION: Record<AdminPaymentFilter, string> = {
  all: '1 = 1',
  open: "i.status IN ('pending', 'review')",
  success: "i.status = 'success'",
  closed: "i.status IN ('failed', 'refunded')",
}

/** Read-only, bounded invoice search. The caller must enforce administrator RBAC first. */
export function listAdminPaymentHistory(options: {
  filter?: AdminPaymentFilter
  reference?: string
  page?: number
} = {}): AdminPaymentHistory {
  const filter = options.filter && Object.hasOwn(FILTER_CONDITION, options.filter) ? options.filter : 'all'
  const reference = options.reference?.trim().toLowerCase() ?? ''
  const invalidReference = reference.length > 0 && !/^[a-f0-9]{32}$/.test(reference)
  if (invalidReference) return { rows: [], total: 0, page: 1, pageCount: 1, invalidReference: true }

  const where = `${FILTER_CONDITION[filter]}${reference ? ' AND i.reference = ?' : ''}`
  const params = reference ? [reference] : []
  const total = (db().prepare(`SELECT COUNT(*) AS total FROM invoices i WHERE ${where}`).get(...params) as { total: number }).total
  const pageCount = Math.max(1, Math.ceil(total / ADMIN_PAYMENT_PAGE_SIZE))
  const requestedPage = Number.isSafeInteger(options.page) && (options.page ?? 0) > 0 ? options.page! : 1
  const page = Math.min(requestedPage, pageCount)
  const rows = db()
    .prepare(
      `SELECT i.reference, u.username, u.email, i.gateway,
              i.payment_network_id, i.payment_asset_code,
              i.credit_amount_cents, i.total_due_cents, i.currency,
              i.status, v.status AS verification_status,
              i.created_at, i.paid_at, i.credited_at
         FROM invoices i
         JOIN users u ON u.id = i.user_id
         LEFT JOIN invoice_verifications v ON v.invoice_reference = i.reference
        WHERE ${where}
        ORDER BY i.created_at DESC, i.rowid DESC
        LIMIT ? OFFSET ?`,
    )
    .all(...params, ADMIN_PAYMENT_PAGE_SIZE, (page - 1) * ADMIN_PAYMENT_PAGE_SIZE) as AdminPaymentRow[]
  return { rows, total, page, pageCount, invalidReference: false }
}

export function adminPaymentSummary(): { requests: number; open: number; verified: number; creditedCents: number } {
  return db()
    .prepare(
      `SELECT COUNT(*) AS requests,
              COUNT(*) FILTER (WHERE status IN ('pending', 'review')) AS open,
              COUNT(*) FILTER (WHERE status = 'success') AS verified,
              COALESCE(SUM(CASE WHEN status = 'success' THEN credit_amount_cents ELSE 0 END), 0) AS creditedCents
         FROM invoices`,
    )
    .get() as { requests: number; open: number; verified: number; creditedCents: number }
}
