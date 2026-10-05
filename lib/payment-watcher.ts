import { randomBytes } from 'node:crypto'
import { db } from './db'
import {
  enabledPaymentRoutes,
  paymentRouteConfiguration,
  type PaymentRouteConfig,
} from './payment-config'
import {
  evmLatestBlock,
  listEvmIncomingTransfers,
  listTronIncomingTransfers,
  PaymentProviderError,
  type IncomingTransfer,
  type PaymentProviderSnapshot,
} from './payment-chain-provider'
import {
  carriesInvoiceCode,
  DUST_FLOOR_E4,
  expireStaleCodedInvoices,
  INVOICE_TTL_DAYS,
  MATCH_BAND_E4,
  paymentCode,
  rawToE4,
} from './payment-codes'
import {
  attachDetectedTransfer,
  PaymentVerificationError,
  verifyInvoiceTransaction,
} from './payment-verification'

/**
 * The payment watcher: reads every token transfer into each receiving
 * wallet and attaches the one that carries an open invoice's code, so the
 * customer never has to paste a transaction ID.
 *
 *   scan ──▶ chain_transfers ──▶ code match ──▶ attachDetectedTransfer
 *                                                  └─▶ verifyInvoiceTransaction
 *
 * Attaching is the same step as a customer pasting the hash, so a detected
 * transfer then passes every check a pasted one does — contract, recipient,
 * amount, timing, confirmations — against a receipt read fresh from the
 * chain, and settles through the same idempotent ledger effect. The watcher
 * only decides WHICH invoice a transfer belongs to; it never credits.
 *
 * It runs from the existing poll timer and, while a customer watches their
 * invoice, on demand. A lease per route keeps the two from overlapping.
 * Routes read by JSON-RPC (BNB Smart Chain) and by TronGrid are watched;
 * Ethereum routes keep the paste flow.
 */

const LEASE_MS = 90_000
// Two enabled BSC routes share a 60 RU/min keyless RPC budget. Each log query
// costs more than a simple chain-head read; never scan a route every refresh.
const MIN_SCAN_INTERVAL_MS = 30_000
const MAX_EVM_CHUNKS = 10
const EVM_CHUNK_BLOCKS = 2_000
const EVM_MIN_CHUNK_BLOCKS = 1
// Blockmachine keyless has 60 RU/min/IP. Its published log-query costs are
// 5 RU (<=100 blocks), 10 RU (<=1,000), 25 RU (<=10,000). Two BSC routes
// may be enabled, so leave capacity for head/receipt reads and overlap scans.
const MAX_EVM_LOG_RU_PER_SCAN = 25
/** Stop starting new reads well inside the lease, so a long scan never outlives it. */
const SCAN_BUDGET_MS = 45_000
/** Re-read behind the cursor every scan, for a node that answered a little behind. */
const EVM_OVERLAP_BLOCKS = 200
const TRON_OVERLAP_MS = 10 * 60_000
const FIRST_SCAN_LOOKBACK_MS = 60 * 60_000
const FIRST_SCAN_LOOKBACK_BLOCKS = 4_800

export type ChainTransferRow = {
  id: number
  route_id: string
  tx_hash: string
  log_index: number
  block_number: number | null
  block_time: string
  from_address: string | null
  amount_raw: string
  amount_e4: number
  status: 'unmatched' | 'matched' | 'dismissed'
  invoice_reference: string | null
  note: string | null
  seen_at: string
}

export function watchableRoute(route: Pick<PaymentRouteConfig, 'providerMode'>): boolean {
  return process.env.IUNLOCKMOBILE_PAYMENT_WATCHER === '1'
    && (route.providerMode === 'bnb_rpc' || route.providerMode === 'trongrid')
}

function snapshotOf(route: PaymentRouteConfig): PaymentProviderSnapshot {
  return { providerMode: route.providerMode, chainKind: route.chainKind, chainId: route.chainId }
}

/* ---- cursor and lease --------------------------------------------------- */

type CursorRow = {
  last_block: number | null
  last_time_ms: number | null
  resume_from_ms: number | null
  resume_fingerprint: string | null
  lease_until: string | null
  last_scan_at: string | null
  last_ok_at: string | null
  last_error: string | null
}
function cursorRow(routeId: string): CursorRow {
  db().prepare('INSERT INTO payment_watch_cursors (route_id) VALUES (?) ON CONFLICT(route_id) DO NOTHING').run(routeId)
  return db()
    .prepare(
      `SELECT last_block, last_time_ms, resume_from_ms, resume_fingerprint, lease_until, last_scan_at, last_ok_at, last_error
         FROM payment_watch_cursors WHERE route_id = ?`,
    )
    .get(routeId) as CursorRow
}

function acquireLease(routeId: string, force: boolean): { token: string } | 'busy' | 'throttled' {
  return db().transaction(() => {
    const row = cursorRow(routeId)
    const now = Date.now()
    if (row.lease_until && new Date(row.lease_until).getTime() > now) return 'busy' as const
    if (!force && row.last_scan_at && now - new Date(row.last_scan_at).getTime() < MIN_SCAN_INTERVAL_MS) {
      return 'throttled' as const
    }
    const token = randomBytes(12).toString('hex')
    db()
      .prepare('UPDATE payment_watch_cursors SET lease_until = ?, lease_token = ?, last_scan_at = ? WHERE route_id = ?')
      .run(new Date(now + LEASE_MS).toISOString(), token, new Date(now).toISOString(), routeId)
    return { token }
  }).immediate()
}

/** Records the outcome, and frees the lease only if it is still this scan's. */
function releaseLease(routeId: string, token: string, error: string | null) {
  const now = new Date().toISOString()
  if (error === null) {
    db().prepare('UPDATE payment_watch_cursors SET last_ok_at = ?, last_error = NULL WHERE route_id = ?').run(now, routeId)
  } else {
    db().prepare('UPDATE payment_watch_cursors SET last_error = ? WHERE route_id = ?').run(error.slice(0, 300), routeId)
  }
  db()
    .prepare('UPDATE payment_watch_cursors SET lease_until = NULL, lease_token = NULL WHERE route_id = ? AND lease_token = ?')
    .run(routeId, token)
}

/* ---- recording and matching --------------------------------------------- */

/** Stores a transfer once; dust is never stored. Returns the row id when new. */
function recordTransfer(route: PaymentRouteConfig, transfer: IncomingTransfer): number | null {
  const amountE4 = rawToE4(transfer.rawAmount, route.tokenDecimals)
  if (amountE4 === null || amountE4 < DUST_FLOOR_E4) return null
  const result = db()
    .prepare(
      `INSERT INTO chain_transfers
         (route_id, tx_hash, log_index, block_number, block_time, from_address, amount_raw, amount_e4)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(route_id, tx_hash, log_index) DO NOTHING`,
    )
    .run(
      route.id,
      transfer.transactionId,
      transfer.logIndex,
      transfer.blockNumber,
      transfer.blockTimestamp,
      transfer.from,
      transfer.rawAmount.toString(),
      amountE4,
    )
  return result.changes > 0 ? Number(result.lastInsertRowid) : null
}

/**
 * Unpaid coded invoices on this route this transfer could be paying: same
 * code, inside the band, created strictly before its block and not so long
 * before that the invoice had stopped accepting payment.
 */
function codeCandidates(transfer: ChainTransferRow): Array<{ reference: string; payment_amount_e4: number }> {
  if (paymentCode(transfer.amount_e4) === 0) return []
  return (
    db()
      .prepare(
        `SELECT reference, payment_amount_e4 FROM invoices
          WHERE payment_route_id = ? AND status = 'pending' AND payment_reference IS NULL
            AND payment_amount_e4 IS NOT NULL
            AND payment_amount_e4 % 100 = ?
            AND ? BETWEEN payment_amount_e4 - ? AND payment_amount_e4 + ?
            AND julianday(created_at) < julianday(?)
            AND julianday(created_at) >= julianday(?) - ?`,
      )
      .all(
        transfer.route_id,
        paymentCode(transfer.amount_e4),
        transfer.amount_e4,
        MATCH_BAND_E4,
        MATCH_BAND_E4,
        transfer.block_time,
        transfer.block_time,
        INVOICE_TTL_DAYS,
      ) as Array<{ reference: string; payment_amount_e4: number }>
  ).filter((invoice) => carriesInvoiceCode(invoice, transfer.amount_e4))
}

function noteTransfer(id: number, note: string) {
  db().prepare("UPDATE chain_transfers SET note = ? WHERE id = ? AND status = 'unmatched'").run(note.slice(0, 300), id)
}

/**
 * Attaches each unmatched recent transfer that carries exactly one open
 * invoice's code. Returns the references attached, for an immediate check.
 */
export function matchRecordedTransfers(routeId?: string): string[] {
  const rows = db()
    .prepare(
      `SELECT * FROM chain_transfers
        WHERE status = 'unmatched' ${routeId ? 'AND route_id = ?' : ''}
          AND julianday(block_time) >= julianday('now') - ?
        ORDER BY id`,
    )
    .all(...(routeId ? [routeId, INVOICE_TTL_DAYS + 1] : [INVOICE_TTL_DAYS + 1])) as ChainTransferRow[]

  const attached: string[] = []
  for (const transfer of rows) {
    // One bad row must not stop every payment behind it.
    try {
      const alreadyAttached = db()
        .prepare(
          'SELECT invoice_reference, matched_log_index FROM invoice_verifications WHERE tx_hash = ? COLLATE NOCASE LIMIT 1',
        )
        .get(transfer.tx_hash) as { invoice_reference: string; matched_log_index: number | null } | undefined
      if (alreadyAttached) {
        const request = alreadyAttached.invoice_reference.slice(0, 10).toUpperCase()
        noteTransfer(
          transfer.id,
          alreadyAttached.matched_log_index !== null && alreadyAttached.matched_log_index !== transfer.log_index
            ? `Same transaction as payment request ${request}, which took another transfer in it — needs a person.`
            : `Pasted on payment request ${request}; checked from there.`,
        )
        continue
      }
      const candidates = codeCandidates(transfer)
      if (candidates.length === 0) continue
      if (candidates.length > 1) {
        noteTransfer(transfer.id, `Code matches ${candidates.length} open payment requests — needs a person.`)
        continue
      }
      const reference = candidates[0].reference
      // The admin may dismiss a transfer after our read above. Claim the row
      // and attach the hash atomically; if the row changed, attach nothing.
      const claimed = db().transaction(() => {
        const updated = db()
          .prepare(`UPDATE chain_transfers SET status = 'matched', invoice_reference = ?, note = NULL WHERE id = ? AND status = 'unmatched'`)
          .run(reference, transfer.id)
        if (updated.changes !== 1) return false
        attachDetectedTransfer(reference, transfer.tx_hash)
        return true
      }).immediate()
      if (claimed) attached.push(reference)
    } catch (error) {
      if (!(error instanceof PaymentVerificationError)) console.error(`[payments] could not match transfer ${transfer.id}`, error)
      noteTransfer(transfer.id, error instanceof Error ? error.message : String(error))
    }
  }
  return attached
}

/* ---- scanning ------------------------------------------------------------ */

function dustFloorRaw(decimals: number): bigint {
  return BigInt(DUST_FLOOR_E4) * 10n ** BigInt(Math.max(0, decimals - 4))
}

async function readEvmRoute(route: PaymentRouteConfig, cursor: CursorRow): Promise<number> {
  const snapshot = snapshotOf(route)
  const startedAt = Date.now()
  const safeHead = (await evmLatestBlock(snapshot)) - route.confirmationsRequired
  let last = cursor.last_block ?? Math.max(0, safeHead - FIRST_SCAN_LOOKBACK_BLOCKS)
  let next = cursor.last_block === null ? last + 1 : Math.max(0, last + 1 - EVM_OVERLAP_BLOCKS)
  let found = 0
  let span = EVM_CHUNK_BLOCKS
  let usedLogRu = 0
  for (let chunk = 0; chunk < MAX_EVM_CHUNKS * 4 && next <= safeHead && Date.now() - startedAt < SCAN_BUDGET_MS; chunk += 1) {
    const to = Math.min(safeHead, next + span - 1)
    const width = to - next + 1
    const logRu = width <= 100 ? 5 : width <= 1_000 ? 10 : 25
    if (usedLogRu + logRu > MAX_EVM_LOG_RU_PER_SCAN) break
    let transfers: IncomingTransfer[]
    try {
      transfers = await listEvmIncomingTransfers(
        snapshot,
        route.tokenContract,
        route.destinationAddress,
        next,
        to,
        dustFloorRaw(route.tokenDecimals),
      )
    } catch (error) {
      /* Spam can make a range answer too large (or a node refuse it).
         Read a narrower range instead of failing on the same one forever. */
      const code = error instanceof PaymentProviderError ? error.code : ''
      if ((code === 'provider_response_too_large' || code === 'provider_rpc_error') && span > EVM_MIN_CHUNK_BLOCKS) {
        span = Math.max(EVM_MIN_CHUNK_BLOCKS, Math.floor(span / 4))
        continue
      }
      throw error
    }
    usedLogRu += logRu
    for (const transfer of transfers) {
      if (recordTransfer(route, transfer) !== null) found += 1
    }
    next = to + 1
    last = Math.max(last, to)
    // MAX: a scan that outlived its lease never drags the cursor backwards.
    db()
      .prepare('UPDATE payment_watch_cursors SET last_block = MAX(COALESCE(last_block, 0), ?) WHERE route_id = ?')
      .run(last, route.id)
    span = Math.min(EVM_CHUNK_BLOCKS, span * 2)
  }
  return found
}

async function readTronRoute(route: PaymentRouteConfig, cursor: CursorRow): Promise<number> {
  /* The overlap re-reads the last ten minutes in case TronGrid indexed a
     transfer late. If a run stopped at its page limit, resume with TronGrid's
     pagination fingerprint and the ORIGINAL min_timestamp. Advancing by the
     newest timestamp alone could skip transfers sharing that millisecond. */
  const since = cursor.last_time_ms === null
    ? Date.now() - FIRST_SCAN_LOOKBACK_MS
    : cursor.resume_from_ms !== null
      ? cursor.resume_from_ms
      : cursor.last_time_ms - TRON_OVERLAP_MS
  const page = await listTronIncomingTransfers(
    snapshotOf(route), route.tokenContract, route.destinationAddress, since, 5, cursor.resume_fingerprint,
  )
  let found = 0
  for (const transfer of page.transfers) if (recordTransfer(route, transfer) !== null) found += 1
  /* Results come oldest first. Persist fingerprint + the same starting time
     together, or a partial run could skip records at a tied timestamp. */
  const reached = page.newestTimestampMs ?? (cursor.last_time_ms === null ? since : null)
  db().transaction(() => {
    if (reached !== null) {
      db().prepare('UPDATE payment_watch_cursors SET last_time_ms = MAX(COALESCE(last_time_ms, 0), ?) WHERE route_id = ?')
        .run(reached, route.id)
    }
    db().prepare('UPDATE payment_watch_cursors SET resume_from_ms = ?, resume_fingerprint = ? WHERE route_id = ?')
      .run(page.complete ? null : since, page.complete ? null : page.nextFingerprint, route.id)
  })()
  return found
}

export type RouteScan =
  | { routeId: string; status: 'busy' | 'throttled' | 'unwatched' }
  | { routeId: string; status: 'ok'; found: number; attached: number; verified: number }
  | { routeId: string; status: 'error'; error: string }

/** Scans one route, attaches what carries a code, and checks those at once. */
export async function scanPaymentRoute(routeId: string, options: { force?: boolean } = {}): Promise<RouteScan> {
  const route = paymentRouteConfiguration(routeId)
  if (!route?.enabled || !watchableRoute(route)) return { routeId, status: 'unwatched' }
  const lease = acquireLease(route.id, Boolean(options.force))
  if (lease === 'busy' || lease === 'throttled') return { routeId, status: lease }

  try {
    const cursor = cursorRow(route.id)
    const found = route.chainKind === 'tron' ? await readTronRoute(route, cursor) : await readEvmRoute(route, cursor)
    const attached = matchRecordedTransfers(route.id)
    expireStaleCodedInvoices()
    let verified = 0
    for (const reference of attached) {
      try {
        if ((await verifyInvoiceTransaction(reference)) === 'verified') verified += 1
      } catch {
        // Left for the poll timer, which retries attached transfers on its own schedule.
      }
    }
    releaseLease(route.id, lease.token, null)
    return { routeId, status: 'ok', found, attached: attached.length, verified }
  } catch (error) {
    const message = error instanceof PaymentProviderError ? error.code : error instanceof Error ? error.message : 'scan_failed'
    releaseLease(route.id, lease.token, message)
    if (!(error instanceof PaymentProviderError)) console.error(`[payments] scan of ${routeId} failed`, error)
    return { routeId, status: 'error', error: message }
  }
}

export type WatcherSummary = { enabled: boolean; routes: RouteScan[]; errors: number }

/** Every watchable route, once. Called by the poll timer. */
export async function scanPaymentWallets(): Promise<WatcherSummary> {
  if (process.env.IUNLOCKMOBILE_PAYMENT_WATCHER !== '1') return { enabled: false, routes: [], errors: 0 }
  const routes = enabledPaymentRoutes().filter(watchableRoute)
  const results: RouteScan[] = []
  for (const route of routes) results.push(await scanPaymentRoute(route.id, { force: true }))
  return { enabled: routes.length > 0, routes: results, errors: results.filter((result) => result.status === 'error').length }
}

/**
 * While a customer has their payment request open: look for their transfer
 * now rather than at the next timer tick, and re-check an attached one that
 * is waiting on confirmations. Throttled per route and per invoice, so a
 * page refreshing every few seconds costs a chain scan at most every thirty seconds.
 */
export async function nudgeInvoicePayment(reference: string): Promise<void> {
  if (process.env.IUNLOCKMOBILE_PAYMENT_WATCHER !== '1') return
  const invoice = db()
    .prepare('SELECT status, payment_route_id, payment_amount_e4 FROM invoices WHERE reference = ?')
    .get(reference) as { status: string; payment_route_id: string | null; payment_amount_e4: number | null } | undefined
  if (!invoice) return

  if (invoice.status === 'pending' && invoice.payment_amount_e4 !== null && invoice.payment_route_id) {
    await scanPaymentRoute(invoice.payment_route_id)
    return
  }
  if (invoice.status === 'review') {
    /* A mined transfer waiting on confirmations is re-checked every 15
       seconds while someone watches; a hash that has not appeared on chain
       keeps the poll timer's back-off, so an open page cannot turn one bad
       paste into a stream of provider calls. */
    const due = db()
      .prepare(
        `SELECT 1 FROM invoice_verifications
          WHERE invoice_reference = ?
            AND (
              (status = 'confirming'
                AND (last_checked_at IS NULL OR julianday(last_checked_at) < julianday('now') - 15.0 / 86400))
              OR (status = 'submitted'
                AND (next_attempt_at IS NULL OR julianday(next_attempt_at) <= julianday('now')))
            )`,
      )
      .get(reference)
    if (due) await verifyInvoiceTransaction(reference).catch(() => undefined)
  }
}

/* ---- what the administrator sees ----------------------------------------- */

export type WatcherHealth = Array<{
  routeId: string
  label: string
  watched: boolean
  lastOkAt: string | null
  lastScanAt: string | null
  lastError: string | null
}>

export function watcherHealth(): WatcherHealth {
  return enabledPaymentRoutes().map((route) => {
    const row = watchableRoute(route) ? cursorRow(route.id) : null
    return {
      routeId: route.id,
      label: `${route.asset} · ${route.network}`,
      watched: Boolean(row),
      lastOkAt: row?.last_ok_at ?? null,
      lastScanAt: row?.last_scan_at ?? null,
      lastError: row?.last_error ?? null,
    }
  })
}

export type UnmatchedTransfer = ChainTransferRow & {
  candidates: Array<{ reference: string; username: string; payment_amount_e4: number | null; created_at: string }>
}

/**
 * Money that arrived and found no payment request — sent without the code,
 * say — and that nobody has pasted either. Each comes with the open
 * requests near its amount, created before it was sent.
 */
export function unmatchedTransfers(limit = 50): { rows: UnmatchedTransfer[]; total: number } {
  /* Hidden once a request holds it — but a second transfer in the same
     transaction, which no request can hold, stays listed. */
  const where = `status = 'unmatched'
    AND NOT EXISTS (
      SELECT 1 FROM invoice_verifications v
       WHERE v.tx_hash = chain_transfers.tx_hash COLLATE NOCASE
         AND (
           v.matched_log_index = chain_transfers.log_index
           OR (v.matched_log_index IS NULL AND NOT EXISTS (
                 SELECT 1 FROM chain_transfers o
                  WHERE o.route_id = chain_transfers.route_id AND o.tx_hash = chain_transfers.tx_hash COLLATE NOCASE
                    AND o.log_index != chain_transfers.log_index))
         ))`
  const total = (db().prepare(`SELECT COUNT(*) AS count FROM chain_transfers WHERE ${where}`).get() as { count: number }).count
  const rows = db()
    .prepare(`SELECT * FROM chain_transfers WHERE ${where} ORDER BY julianday(block_time) DESC LIMIT ?`)
    .all(Math.max(1, Math.min(limit, 200))) as ChainTransferRow[]
  const near = db().prepare(
    `SELECT i.reference, u.username, i.payment_amount_e4, i.created_at
       FROM invoices i JOIN users u ON u.id = i.user_id
      WHERE i.payment_route_id = ? AND i.status IN ('pending', 'review')
        AND ABS(COALESCE(i.payment_amount_e4, i.total_due_cents * 100) - ?) <= ?
        AND julianday(i.created_at) < julianday(?)
        AND julianday(i.created_at) >= julianday(?) - ?
      ORDER BY ABS(COALESCE(i.payment_amount_e4, i.total_due_cents * 100) - ?)
      LIMIT 3`,
  )
  return {
    total,
    rows: rows.map((row) => ({
      ...row,
      candidates: near.all(
        row.route_id,
        row.amount_e4,
        MATCH_BAND_E4,
        row.block_time,
        row.block_time,
        INVOICE_TTL_DAYS,
        row.amount_e4,
      ) as UnmatchedTransfer['candidates'],
    })),
  }
}

/** A person decided this transfer is not to be credited (a refund sent back, a test). */
export function dismissTransfer(transferId: number, reason: string): void {
  const clean = reason.replace(/\s+/g, ' ').trim()
  if (clean.length < 4 || clean.length > 240) throw new PaymentVerificationError('Give a short reason.', 'invalid_reason')
  const result = db()
    .prepare(`UPDATE chain_transfers SET status = 'dismissed', note = ? WHERE id = ? AND status = 'unmatched'`)
    .run(clean, transferId)
  if (result.changes === 0) throw new PaymentVerificationError('That transfer is not open.', 'invalid_state')
}
