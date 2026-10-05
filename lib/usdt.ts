import { randomBytes } from 'node:crypto'
import {
  assertBscChain,
  blockTime,
  ChainError,
  explorerTxUrl,
  extractTxHash,
  formatE4,
  latestBlock,
  rpcUrl,
  transferReceipt,
  usdtTransfersTo,
  type TokenTransfer,
} from './bsc'
import { db } from './db'
import {
  approveInvoice,
  creditForTransfer,
  expireStaleInvoices,
  GATEWAYS,
  getInvoice,
  getInvoiceAnyUser,
  INVOICE_TTL_DAYS,
  MATCH_BAND_E4,
  paymentCode,
  PaymentError,
  shortReference,
  sqliteTime,
  USDT_GATEWAY_ID,
  type Invoice,
} from './payments'
import { consumeAttempt } from './rate-limit'

/**
 * USDT payment detection: read every USDT transfer into the receiving wallet
 * off BNB Smart Chain, and settle the invoice whose code the amount carries.
 *
 *   scan ──▶ chain_transfers ──▶ match by code ──▶ approveInvoice (idempotent)
 *                     └── no code / ambiguous ──▶ stays for a person
 *
 * The scan runs on a timer inside the server (instrumentation.ts), on demand
 * while a customer is watching their invoice, and from `npm run usdt:scan`.
 * A lease in chain_cursors keeps those from overlapping. Settlement goes
 * through the same approveInvoice the administrator uses, and the
 * transfer's (hash, log index) is the invoice's provider charge id, so one
 * transfer can never pay two invoices and a re-scan never credits twice.
 *
 * The rules that keep money from going to the wrong account:
 *  - a transfer only pays an invoice that existed before the block it is in
 *    (no grace period: a grace period is a window to create an invoice that
 *    catches someone else's mistyped transfer);
 *  - a pasted hash never credits by itself unless the amount carries the
 *    invoice's code — otherwise a person decides, with every claimant shown;
 *  - a person settles a hash only through the chain record of it, never by
 *    trusting the text, so the same transfer cannot be credited twice by
 *    going round the automatic path.
 */

const NETWORK = 'bsc'
const LEASE_MS = 60_000
const MIN_SCAN_INTERVAL_MS = 8_000
const MAX_CHUNKS_PER_SCAN = 10
/** Re-read this many blocks behind the cursor each scan, for a node that answered late. */
const RESCAN_OVERLAP_BLOCKS = 200
/**
 * Transfers below 1 USDT are never recorded. Address-poisoning spam sends
 * zero and dust amounts to busy wallets by the hundred; recording them
 * would bury real payments in the queue a person reads.
 */
export const DUST_FLOOR_E4 = 10_000

export type TransferRow = {
  id: number
  network: string
  tx_hash: string
  log_index: number
  block_number: number
  block_time: string
  from_address: string
  to_address: string
  amount_units: string
  amount_e4: number
  status: 'unmatched' | 'matched' | 'claimed' | 'dismissed'
  invoice_reference: string | null
  claimed_reference: string | null
  note: string | null
  seen_at: string
}

export function usdtGateway() {
  return GATEWAYS.find((gateway) => gateway.id === USDT_GATEWAY_ID)
}

function clampedEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name] ?? fallback)
  return Number.isSafeInteger(value) ? Math.min(Math.max(value, min), max) : fallback
}

/** Blocks a transfer must be buried under before it counts. Seconds, on BSC, at the default. */
export function confirmationsRequired(): number {
  return clampedEnv('IUNLOCKMOBILE_USDT_CONFIRMATIONS', 15, 1, 500)
}

function chunkBlocks(): number {
  return clampedEnv('IUNLOCKMOBILE_BSC_LOG_CHUNK', 2_000, 1, 5_000)
}

/** Where a fresh install starts reading: an explicit block, or a few thousand back. */
function initialCursor(safeHead: number): number {
  const configured = Number(process.env.IUNLOCKMOBILE_USDT_SCAN_START_BLOCK)
  if (Number.isSafeInteger(configured) && configured > 0) return Math.min(configured, safeHead + 1) - 1
  return Math.max(0, safeHead - 4_800)
}

/* ---- the cursor and its lease ----------------------------------------- */

type CursorRow = {
  last_block: number | null
  lease_until: string | null
  last_scan_at: string | null
  last_ok_at: string | null
  last_error: string | null
}

function cursorRow(): CursorRow {
  db().prepare('INSERT INTO chain_cursors (network) VALUES (?) ON CONFLICT(network) DO NOTHING').run(NETWORK)
  return db()
    .prepare('SELECT last_block, lease_until, last_scan_at, last_ok_at, last_error FROM chain_cursors WHERE network = ?')
    .get(NETWORK) as CursorRow
}

/** Returns this scan's lease token, or why it may not run. */
function acquireLease(force: boolean): { token: string } | 'busy' | 'throttled' {
  return db().transaction(() => {
    const row = cursorRow()
    const now = Date.now()
    if (row.lease_until && new Date(row.lease_until).getTime() > now) return 'busy' as const
    if (!force && row.last_scan_at && now - new Date(row.last_scan_at).getTime() < MIN_SCAN_INTERVAL_MS) {
      return 'throttled' as const
    }
    const token = randomBytes(12).toString('hex')
    db()
      .prepare('UPDATE chain_cursors SET lease_until = ?, lease_token = ?, last_scan_at = ? WHERE network = ?')
      .run(new Date(now + LEASE_MS).toISOString(), token, new Date(now).toISOString(), NETWORK)
    return { token }
  }).immediate()
}

/** Records the outcome, and frees the lease only if it is still this scan's. */
function releaseLease(token: string, outcome: { ok: true } | { ok: false; error: string }) {
  const now = new Date().toISOString()
  if (outcome.ok) {
    db().prepare('UPDATE chain_cursors SET last_ok_at = ?, last_error = NULL WHERE network = ?').run(now, NETWORK)
  } else {
    db().prepare('UPDATE chain_cursors SET last_error = ? WHERE network = ?').run(outcome.error.slice(0, 500), NETWORK)
  }
  db()
    .prepare('UPDATE chain_cursors SET lease_until = NULL, lease_token = NULL WHERE network = ? AND lease_token = ?')
    .run(NETWORK, token)
}

/* ---- recording and matching ------------------------------------------- */

function alreadyRecorded(transfer: TokenTransfer): boolean {
  return Boolean(
    db()
      .prepare('SELECT 1 FROM chain_transfers WHERE network = ? AND tx_hash = ? AND log_index = ?')
      .get(NETWORK, transfer.txHash, transfer.logIndex),
  )
}

/** Stores a transfer once. Returns true the first time it is seen. */
function recordTransfer(transfer: TokenTransfer, time: string): boolean {
  if (transfer.amountE4 < DUST_FLOOR_E4) return false
  const result = db()
    .prepare(
      `INSERT INTO chain_transfers
         (network, tx_hash, log_index, block_number, block_time, from_address,
          to_address, amount_units, amount_e4)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(network, tx_hash, log_index) DO NOTHING`,
    )
    .run(
      NETWORK,
      transfer.txHash,
      transfer.logIndex,
      transfer.blockNumber,
      time,
      transfer.from,
      transfer.to,
      transfer.amountUnits.toString(),
      transfer.amountE4,
    )
  return result.changes > 0
}

function transferById(id: number): TransferRow | undefined {
  return db().prepare('SELECT * FROM chain_transfers WHERE id = ?').get(id) as TransferRow | undefined
}

function transfersForHash(txHash: string): TransferRow[] {
  return db()
    .prepare('SELECT * FROM chain_transfers WHERE network = ? AND tx_hash = ? ORDER BY amount_e4 DESC')
    .all(NETWORK, txHash) as TransferRow[]
}

/**
 * True when the transfer's block is strictly later than the second the
 * invoice was created in. Both clocks tick in whole seconds; "the same
 * second" is treated as before, because no person pays that fast and a
 * script watching the chain could.
 */
function sentAfter(transfer: Pick<TransferRow, 'block_time'>, invoice: Pick<Invoice, 'created_at'>): boolean {
  return new Date(transfer.block_time).getTime() > sqliteTime(invoice.created_at).getTime()
}

/**
 * Open invoices this transfer could be paying: same code, amount inside the
 * band, and created no later than the block the money moved in.
 */
function codeCandidates(transfer: TransferRow): Invoice[] {
  const code = paymentCode(transfer.amount_e4)
  if (code === 0) return []
  return db()
    .prepare(
      `SELECT reference, user_id, gateway, credit_amount_cents, fee_cents, tax_cents,
              total_due_cents, currency, status, payment_reference, note,
              pay_amount_e4, received_e4, credited_cents, created_at, updated_at
         FROM invoices
        WHERE gateway = ?
          AND pay_amount_e4 IS NOT NULL
          -- Not 'review': an invoice waiting on a person keeps its code, but
          -- must not go on catching transfers by it indefinitely.
          AND status = 'pending'
          AND pay_amount_e4 % 100 = ?
          AND ? BETWEEN pay_amount_e4 - ? AND pay_amount_e4 + ?
          AND julianday(created_at) < julianday(?)
          AND julianday(created_at) >= julianday(?) - ?`,
    )
    .all(
      USDT_GATEWAY_ID,
      code,
      transfer.amount_e4,
      MATCH_BAND_E4,
      MATCH_BAND_E4,
      transfer.block_time,
      transfer.block_time,
      INVOICE_TTL_DAYS,
    ) as Invoice[]
}

function transferNote(transfer: TransferRow): string {
  return `${formatE4(transfer.amount_e4)} USDT from ${transfer.from_address} on BNB Smart Chain`
}

/**
 * Puts the transfers an invoice had claimed back in the unmatched queue —
 * whenever the invoice stops pointing at them, so no transfer is ever left
 * tied to an invoice that no screen shows it against.
 */
function releaseClaims(invoiceReference: string, why: string, exceptTransferId = -1) {
  db()
    .prepare(
      `UPDATE chain_transfers
          SET status = 'unmatched', claimed_reference = NULL, note = ?
        WHERE claimed_reference = ? AND status = 'claimed' AND id != ?`,
    )
    .run(why, invoiceReference, exceptTransferId)
}

/**
 * Credits one invoice with one transfer. Safe to call twice: the second call
 * finds the transfer already matched and the invoice already settled.
 */
function settleWithTransfer(invoiceReference: string, transferId: number, confirmedByUserId?: number): Invoice {
  return db().transaction(() => {
    const transfer = transferById(transferId)
    if (!transfer) throw new PaymentError('No such transfer.')
    if (transfer.status === 'matched') {
      if (transfer.invoice_reference === invoiceReference) return getInvoiceAnyUser(invoiceReference)!
      throw new PaymentError('This transfer has already been credited to another invoice.')
    }
    if (transfer.status === 'dismissed') throw new PaymentError('This transfer was dismissed.')

    const current = getInvoiceAnyUser(invoiceReference)
    if (!current || !['pending', 'review'].includes(current.status)) {
      throw new PaymentError('This invoice is no longer open.')
    }
    if (!sentAfter(transfer, current)) {
      throw new PaymentError('This transfer was sent before the invoice existed, so it cannot be paying it.')
    }

    const settled = approveInvoice(current.reference, current.user_id, `${NETWORK}:${transfer.tx_hash}:${transfer.log_index}`, {
      creditCents: creditForTransfer(current, transfer.amount_e4),
      receivedE4: transfer.amount_e4,
      paymentReference: transfer.tx_hash,
      note: transferNote(transfer),
      confirmedByUserId,
    })
    db()
      .prepare(
        `UPDATE chain_transfers
            SET status = 'matched', invoice_reference = ?, claimed_reference = NULL, note = NULL
          WHERE id = ?`,
      )
      .run(current.reference, transfer.id)

    /* Any other invoice that pointed at this same transfer was wrong about
       it: back to waiting for its own payment, with the reason, so no screen
       goes on presenting this hash as unspent evidence. One that claimed a
       different transfer in the same transaction keeps its claim. */
    db()
      .prepare(
        `UPDATE invoices
            SET status = 'pending', payment_reference = NULL, note = ?, updated_at = datetime('now')
          WHERE status = 'review' AND payment_reference = ? AND reference != ?
            AND NOT EXISTS (
              SELECT 1 FROM chain_transfers c
               WHERE c.claimed_reference = invoices.reference AND c.status = 'claimed')`,
      )
      .run(
        `The transfer this invoice pointed at (${transfer.tx_hash.slice(0, 10)}…) paid a different invoice.`,
        transfer.tx_hash,
        current.reference,
      )

    /* And a different transfer this invoice had pointed at is not its
       payment after all: back to the unmatched queue, where a person sees it. */
    releaseClaims(
      current.reference,
      `Was claimed for invoice ${shortReference(current.reference)}, which another transfer then paid.`,
      transfer.id,
    )
    return settled
  }).immediate()
}

/** Tries every transfer not yet tied to an invoice. Returns how many it settled. */
export function matchOpenTransfers(): number {
  const open = db()
    .prepare(
      `SELECT * FROM chain_transfers
        WHERE network = ? AND status IN ('unmatched', 'claimed')
          AND julianday(block_time) >= julianday('now') - ?
        ORDER BY id`,
    )
    .all(NETWORK, INVOICE_TTL_DAYS) as TransferRow[]

  let settled = 0
  for (const transfer of open) {
    /* One bad row must not stop every payment behind it: whatever goes
       wrong is written on the transfer, and the loop moves on. */
    try {
      const candidates = codeCandidates(transfer)
      if (candidates.length === 1) {
        settleWithTransfer(candidates[0].reference, transfer.id)
        settled += 1
      } else if (candidates.length > 1) {
        db()
          .prepare('UPDATE chain_transfers SET note = ? WHERE id = ?')
          .run(`Code matches ${candidates.length} open invoices — needs a person.`, transfer.id)
      }
    } catch (error) {
      if (!(error instanceof PaymentError)) console.error(`[usdt] could not settle transfer ${transfer.id}`, error)
      db()
        .prepare('UPDATE chain_transfers SET note = ? WHERE id = ?')
        .run((error instanceof Error ? error.message : String(error)).slice(0, 300), transfer.id)
    }
  }
  // After matching, never before: a payment sent in an invoice's last
  // minutes must find it still open.
  expireStaleInvoices()
  return settled
}

/* ---- scanning ------------------------------------------------------------ */

export type ScanResult =
  | { status: 'disabled' | 'busy' | 'throttled' }
  | { status: 'ok'; fromBlock: number; toBlock: number; found: number; settled: number; caughtUp: boolean }
  | { status: 'error'; error: string }

export async function scanUsdtTransfers(options: { force?: boolean } = {}): Promise<ScanResult> {
  const gateway = usdtGateway()
  if (!gateway) return { status: 'disabled' }

  const lease = acquireLease(Boolean(options.force))
  if (lease === 'busy' || lease === 'throttled') return { status: lease }

  try {
    await assertBscChain()
    const safeHead = (await latestBlock()) - confirmationsRequired()
    const stored = cursorRow().last_block
    let cursor = stored ?? initialCursor(safeHead)
    /* Overlap: a load-balanced RPC can answer eth_blockNumber from one node
       and eth_getLogs from another a few blocks behind, which looks exactly
       like "no transfers". Re-reading the tail costs one call and turns
       that from a missed payment into a late one. */
    let next = stored === null ? cursor + 1 : Math.max(0, cursor + 1 - RESCAN_OVERLAP_BLOCKS)
    const startedAt = next
    let found = 0
    const times = new Map<number, string>()

    for (let chunk = 0; chunk < MAX_CHUNKS_PER_SCAN && next <= safeHead; chunk += 1) {
      const toBlock = Math.min(safeHead, next + chunkBlocks() - 1)
      const transfers = await usdtTransfersTo(gateway.address, next, toBlock)
      for (const transfer of transfers) {
        if (transfer.amountE4 < DUST_FLOOR_E4 || alreadyRecorded(transfer)) continue
        let time = times.get(transfer.blockNumber)
        if (!time) {
          time = await blockTime(transfer.blockNumber)
          times.set(transfer.blockNumber, time)
        }
        if (recordTransfer(transfer, time)) found += 1
      }
      next = toBlock + 1
      cursor = Math.max(cursor, toBlock)
      // MAX: a scan that outlived its lease never drags the cursor backwards.
      db()
        .prepare('UPDATE chain_cursors SET last_block = MAX(COALESCE(last_block, 0), ?) WHERE network = ?')
        .run(cursor, NETWORK)
    }

    const settled = matchOpenTransfers()
    releaseLease(lease.token, { ok: true })
    return { status: 'ok', fromBlock: startedAt, toBlock: cursor, found, settled, caughtUp: cursor >= safeHead }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'USDT scan failed.'
    releaseLease(lease.token, { ok: false, error: message })
    if (!(error instanceof ChainError)) console.error('[usdt] scan failed', error)
    return { status: 'error', error: message }
  }
}

/* ---- what the customer sees --------------------------------------------- */

export type InvoicePaymentStatus = {
  status: Invoice['status']
  creditedCents: number | null
  receivedE4: number | null
  /** The transfer this invoice points at, waiting for a person. */
  claim: { txHash: string; amountE4: number; explorerUrl: string } | null
  detection: 'automatic' | 'manual'
}

export function invoicePaymentStatus(invoice: Invoice): InvoicePaymentStatus {
  const claim =
    invoice.status === 'review' && invoice.payment_reference
      ? (db()
          .prepare(
            `SELECT tx_hash, amount_e4 FROM chain_transfers
              WHERE network = ? AND tx_hash = ? AND status IN ('unmatched', 'claimed')
              ORDER BY amount_e4 DESC LIMIT 1`,
          )
          .get(NETWORK, invoice.payment_reference) as { tx_hash: string; amount_e4: number } | undefined)
      : undefined
  return {
    status: invoice.status,
    creditedCents: invoice.credited_cents ?? (invoice.status === 'success' ? invoice.credit_amount_cents : null),
    receivedE4: invoice.received_e4,
    claim: claim ? { txHash: claim.tx_hash, amountE4: claim.amount_e4, explorerUrl: explorerTxUrl(claim.tx_hash) } : null,
    detection: invoice.pay_amount_e4 !== null ? 'automatic' : 'manual',
  }
}

/**
 * The invoice page polls this. While the invoice is open it also nudges a
 * scan — throttled, so a dozen open tabs still cost one RPC round a few
 * seconds apart, and the customer sees the credit land without waiting
 * for the background timer.
 */
export async function pollInvoicePayment(reference: string, userId: number): Promise<InvoicePaymentStatus> {
  const before = getInvoice(reference, userId)
  if (!before) throw new PaymentError('No such invoice.')
  if (['pending', 'review'].includes(before.status) && usdtGateway()) await scanUsdtTransfers()
  return invoicePaymentStatus(getInvoice(reference, userId)!)
}

export type ClaimResult =
  | { outcome: 'credited'; message: string }
  | { outcome: 'review'; message: string }
  | { outcome: 'waiting'; message: string }

/**
 * Asks the chain about one transaction and records its USDT transfers into
 * the wallet. Throws a customer-readable PaymentError for every way the
 * hash can be wrong; returns null while it is still being confirmed.
 */
async function recordFromChain(txHash: string, address: string): Promise<TransferRow[] | null> {
  await assertBscChain()
  const receipt = await transferReceipt(txHash)
  if (!receipt) {
    throw new PaymentError(
      'We cannot find this transaction on BNB Smart Chain. If you sent it a moment ago, wait a minute and try again. ' +
        'If it went out on another network (TRON / TRC20, Ethereum / ERC20), it cannot reach this wallet — contact support with the transaction ID.',
    )
  }
  if (!receipt.succeeded) throw new PaymentError('That transaction failed on the chain, so no USDT moved. Check your wallet or exchange.')

  const ours = receipt.transfers.filter((transfer) => transfer.to === address.toLowerCase())
  if (ours.length === 0) {
    throw new PaymentError('That transaction did not send USDT to our address. Check that you copied the right one.')
  }
  if (ours.every((transfer) => transfer.amountE4 < DUST_FLOOR_E4)) {
    throw new PaymentError('That transfer is below 1 USDT, which is not credited.')
  }

  if ((await latestBlock()) - receipt.blockNumber < confirmationsRequired()) return null

  const time = await blockTime(receipt.blockNumber)
  for (const transfer of ours) recordTransfer(transfer, time)
  return transfersForHash(txHash)
}

/**
 * The fallback for a transfer the code could not place — the customer
 * rounded the amount, say. The hash is checked against the chain here and
 * now: a coded transfer settles on the spot; anything else is attached to
 * this invoice as evidence for a person, never credited on the customer's
 * word, because every transfer into the wallet is public and anyone could
 * paste someone else's. When two invoices point at the same transfer, both
 * go to a person, who sees them side by side.
 */
export async function claimTransfer(reference: string, userId: number, input: string): Promise<ClaimResult> {
  const invoice = getInvoice(reference, userId)
  if (!invoice) throw new PaymentError('No such invoice.')
  if (invoice.status === 'success') return { outcome: 'credited', message: 'This invoice is already paid.' }
  if (!['pending', 'review'].includes(invoice.status)) throw new PaymentError(`This invoice is ${invoice.status}.`)

  const gateway = usdtGateway()
  if (!gateway || invoice.gateway !== gateway.id) {
    throw new PaymentError('This payment method is not configured. Do not send funds.')
  }

  const txHash = extractTxHash(input)
  if (!txHash) {
    throw new PaymentError(
      'That is not a BNB Smart Chain transaction ID. It is 64 letters and numbers, usually starting with 0x — or paste the BscScan link.',
    )
  }
  if (!consumeAttempt('usdt-claim', String(userId), 12, 600)) {
    throw new PaymentError('Too many attempts. Wait ten minutes, or contact support with the transaction ID.')
  }

  const recorded = await recordFromChain(txHash, gateway.address)
  if (!recorded) {
    return {
      outcome: 'waiting',
      message: 'Found it. The network is still confirming the transfer — this page updates by itself in a few seconds.',
    }
  }
  matchOpenTransfers()

  const rows = transfersForHash(txHash)
  if (rows.some((row) => row.status === 'matched' && row.invoice_reference === reference)) {
    return { outcome: 'credited', message: 'Payment confirmed and credited.' }
  }

  const target =
    rows.find((row) => row.status === 'claimed' && row.claimed_reference === reference) ??
    rows.find((row) => row.status === 'unmatched') ??
    rows.find((row) => row.status === 'claimed')
  if (!target) {
    const elsewhere = rows.find((row) => row.status === 'matched' && row.invoice_reference)
    const other = elsewhere ? getInvoiceAnyUser(elsewhere.invoice_reference!) : undefined
    if (other && other.user_id === userId) {
      throw new PaymentError(`This transfer was already credited to your invoice ${shortReference(other.reference)}.`)
    }
    if (rows.some((row) => row.status === 'dismissed')) {
      throw new PaymentError('This transfer was reviewed and not accepted. Contact support with the transaction ID.')
    }
    throw new PaymentError('This transfer has already been used for another invoice. Contact support if you think that is wrong.')
  }

  if (!sentAfter(target, invoice)) {
    throw new PaymentError(
      'That transfer was sent before this invoice was created, so it belongs to an earlier invoice. Check your Payments page, or contact support.',
    )
  }

  /* Re-read and write in one locked step: the timer may have settled this
     invoice, or another invoice, while the chain was being asked. */
  const outcome = db().transaction(() => {
    const fresh = transferById(target.id)
    if (!fresh || fresh.status === 'matched' || fresh.status === 'dismissed') return 'gone' as const
    const updated = db()
      .prepare(
        `UPDATE invoices
            SET status = 'review', payment_reference = ?, note = ?, updated_at = datetime('now')
          WHERE reference = ? AND user_id = ? AND status IN ('pending', 'review')`,
      )
      .run(fresh.tx_hash, `Customer claim: ${transferNote(fresh)}`, reference, userId)
    if (updated.changes === 0) return 'closed' as const
    // Pointing at a new transfer releases whatever this invoice pointed at before.
    releaseClaims(reference, `Was claimed for invoice ${shortReference(reference)}, which then pointed at another transfer.`, fresh.id)
    if (fresh.status === 'unmatched' || fresh.claimed_reference === reference) {
      db().prepare(`UPDATE chain_transfers SET status = 'claimed', claimed_reference = ? WHERE id = ?`).run(reference, fresh.id)
      return 'claimed' as const
    }
    return 'disputed' as const
  }).immediate()

  if (outcome === 'gone' || outcome === 'closed') {
    const now = getInvoice(reference, userId)!
    if (now.status === 'success') return { outcome: 'credited', message: 'This invoice is already paid.' }
    if (outcome === 'closed') throw new PaymentError(`This invoice is ${now.status}.`)
    throw new PaymentError('This transfer has just been settled elsewhere. Contact support if you think that is wrong.')
  }

  return {
    outcome: 'review',
    message:
      outcome === 'disputed'
        ? `We found a transfer of ${formatE4(target.amount_e4)} USDT, but another invoice points at it too, so a person checks whose it is. You do not need to do anything else.`
        : `We found your transfer of ${formatE4(target.amount_e4)} USDT. The amount does not carry this invoice's code, so a person confirms it — you do not need to do anything else.`,
  }
}

/* ---- what the administrator sees ------------------------------------------ */

export type WatcherHealth = {
  configured: boolean
  rpcHost: string
  confirmations: number
  lastBlock: number | null
  lastScanAt: string | null
  lastOkAt: string | null
  lastError: string | null
}

export function watcherHealth(): WatcherHealth {
  const row = usdtGateway() ? cursorRow() : null
  let rpcHost = ''
  try {
    rpcHost = new URL(rpcUrl()).host
  } catch {
    rpcHost = 'invalid URL'
  }
  return {
    configured: Boolean(usdtGateway()),
    rpcHost,
    confirmations: confirmationsRequired(),
    lastBlock: row?.last_block ?? null,
    lastScanAt: row?.last_scan_at ?? null,
    lastOkAt: row?.last_ok_at ?? null,
    lastError: row?.last_error ?? null,
  }
}

export type AttentionInvoice = Invoice & {
  username: string
  email: string
  transfer_id: number | null
  transfer_amount_e4: number | null
  transfer_tx_hash: string | null
  transfer_from: string | null
  transfer_time: string | null
  transfer_status: TransferRow['status'] | null
  /** Other invoices in review pointing at the same transaction. */
  rivals: string | null
}

/**
 * Invoices waiting for a person, one row each, with the on-chain transfer
 * they point at (sender and time included) and any rival invoice that
 * points at the same one.
 */
export function invoicesNeedingReview(limit = 50): AttentionInvoice[] {
  return db()
    .prepare(
      `SELECT i.reference, i.user_id, i.gateway, i.credit_amount_cents, i.fee_cents, i.tax_cents,
              i.total_due_cents, i.currency, i.status, i.payment_reference, i.note,
              i.pay_amount_e4, i.received_e4, i.credited_cents, i.created_at, i.updated_at,
              u.username, u.email,
              t.id AS transfer_id, t.amount_e4 AS transfer_amount_e4, t.tx_hash AS transfer_tx_hash,
              t.from_address AS transfer_from, t.block_time AS transfer_time, t.status AS transfer_status,
              (SELECT GROUP_CONCAT(ou.username || ' ' || substr(o.reference, 1, 10), ', ')
                 FROM invoices o JOIN users ou ON ou.id = o.user_id
                WHERE o.status = 'review' AND o.payment_reference = i.payment_reference
                  AND o.reference != i.reference) AS rivals
         FROM invoices i
         JOIN users u ON u.id = i.user_id
         LEFT JOIN chain_transfers t ON t.id = (
           SELECT c.id FROM chain_transfers c
            WHERE c.network = ? AND c.tx_hash = i.payment_reference
            ORDER BY (c.claimed_reference = i.reference) DESC, c.amount_e4 DESC
            LIMIT 1)
        WHERE i.status = 'review'
        ORDER BY julianday(i.updated_at) DESC
        LIMIT ?`,
    )
    .all(NETWORK, Math.max(1, Math.min(limit, 200))) as AttentionInvoice[]
}

export type UnmatchedTransfer = TransferRow & {
  candidates: Array<{ reference: string; username: string; pay_amount_e4: number | null; total_due_cents: number; created_at: string }>
}

export function countUnmatchedTransfers(): number {
  return (
    db().prepare(`SELECT COUNT(*) AS count FROM chain_transfers WHERE network = ? AND status = 'unmatched'`).get(NETWORK) as {
      count: number
    }
  ).count
}

/**
 * Money that arrived and found no invoice, each with the open invoices it
 * could plausibly be — near the amount and created before it was sent.
 */
export function unmatchedTransfers(limit = 50): UnmatchedTransfer[] {
  const rows = db()
    .prepare(
      `SELECT * FROM chain_transfers
        WHERE network = ? AND status = 'unmatched'
        ORDER BY block_number DESC
        LIMIT ?`,
    )
    .all(NETWORK, Math.max(1, Math.min(limit, 200))) as TransferRow[]

  const near = db().prepare(
    `SELECT i.reference, u.username, i.pay_amount_e4, i.total_due_cents, i.created_at
       FROM invoices i JOIN users u ON u.id = i.user_id
      WHERE i.gateway = ? AND i.status IN ('pending', 'review')
        AND ABS(COALESCE(i.pay_amount_e4, i.total_due_cents * 100) - ?) <= ?
        AND julianday(i.created_at) < julianday(?)
        AND julianday(i.created_at) >= julianday(?) - ?
      ORDER BY ABS(COALESCE(i.pay_amount_e4, i.total_due_cents * 100) - ?)
      LIMIT 3`,
  )
  return rows.map((row) => ({
    ...row,
    candidates: near.all(
      USDT_GATEWAY_ID,
      row.amount_e4,
      MATCH_BAND_E4,
      row.block_time,
      row.block_time,
      INVOICE_TTL_DAYS,
      row.amount_e4,
    ) as UnmatchedTransfer['candidates'],
  }))
}

/**
 * An administrator settles an invoice. Credit always follows a transfer
 * read off the chain — the one named, or the one the invoice points at,
 * fetched now if it was never recorded — so the same transfer cannot be
 * credited twice by confirming it by hand. Only an invoice from before
 * detection existed, whose reference is not a transaction hash at all, is
 * confirmed on the administrator's word, for its own amount.
 */
export async function adminConfirmInvoice(adminUserId: number, reference: string, transferId?: number): Promise<Invoice> {
  const invoice = getInvoiceAnyUser(reference)
  if (!invoice) throw new PaymentError('No such invoice.')
  if (invoice.status === 'success') return invoice
  if (!['pending', 'review'].includes(invoice.status)) throw new PaymentError(`Invoice is ${invoice.status}.`)

  if (transferId !== undefined) return settleWithTransfer(invoice.reference, transferId, adminUserId)

  if (invoice.status !== 'review' || !invoice.payment_reference) {
    throw new PaymentError('Nothing to confirm: this invoice points at no payment.')
  }

  const txHash = extractTxHash(invoice.payment_reference)
  if (txHash) {
    let rows = transfersForHash(txHash)
    if (rows.length === 0) {
      const gateway = usdtGateway()
      if (!gateway) throw new PaymentError('No wallet is configured, so the transfer cannot be checked.')
      const recorded = await recordFromChain(txHash, gateway.address)
      if (!recorded) throw new PaymentError('That transfer is still being confirmed by the network. Try again in a minute.')
      rows = recorded
    }
    const usable =
      rows.find((row) => row.status === 'claimed' && row.claimed_reference === invoice.reference) ??
      rows.find((row) => row.status === 'unmatched' || row.status === 'claimed')
    if (!usable) {
      const matched = rows.find((row) => row.status === 'matched')
      throw new PaymentError(
        matched
          ? `That transfer already paid invoice ${shortReference(matched.invoice_reference ?? '')}.`
          : 'That transfer was dismissed and cannot be credited.',
      )
    }
    return settleWithTransfer(invoice.reference, usable.id, adminUserId)
  }

  return approveInvoice(invoice.reference, invoice.user_id, `manual:${invoice.payment_reference}`, {
    confirmedByUserId: adminUserId,
    note: invoice.note ?? 'Confirmed by an administrator.',
  })
}

/**
 * Marks a transfer as not ours to credit (a refund sent back, a test). Any
 * invoice that pointed at it goes back to waiting for payment with the
 * reason on it, rather than sitting in review forever.
 */
export function adminDismissTransfer(transferId: number, reason: string): void {
  const clean = reason.trim()
  if (clean.length < 4) throw new PaymentError('Give a short reason.')
  db().transaction(() => {
    const transfer = transferById(transferId)
    if (!transfer || !['unmatched', 'claimed'].includes(transfer.status)) {
      throw new PaymentError('That transfer is not open.')
    }
    db()
      .prepare(`UPDATE chain_transfers SET status = 'dismissed', claimed_reference = NULL, note = ? WHERE id = ?`)
      .run(clean.slice(0, 300), transferId)
    db()
      .prepare(
        `UPDATE invoices
            SET status = 'pending', payment_reference = NULL, note = ?, updated_at = datetime('now')
          WHERE status = 'review' AND payment_reference = ?
            AND NOT EXISTS (
              SELECT 1 FROM chain_transfers c
               WHERE c.claimed_reference = invoices.reference AND c.status = 'claimed')`,
      )
      .run(`Transfer not accepted: ${clean.slice(0, 300)}`, transfer.tx_hash)
  })()
}

/**
 * Closes an invoice a person has decided will not be credited — evidence
 * that is not a payment to this wallet (another network's id, say). Any
 * transfer it had claimed goes back to the unmatched queue.
 */
export function adminRejectInvoice(reference: string, reason: string): void {
  const clean = reason.trim()
  if (clean.length < 4) throw new PaymentError('Give a short reason.')
  db().transaction(() => {
    const result = db()
      .prepare(
        `UPDATE invoices
            SET status = 'failed', note = ?, updated_at = datetime('now')
          WHERE reference = ? AND status = 'review'`,
      )
      .run(`Not accepted: ${clean.slice(0, 300)}`, reference)
    if (result.changes === 0) throw new PaymentError('That invoice is not waiting for review.')
    releaseClaims(reference, `Invoice ${shortReference(reference)} was rejected: ${clean.slice(0, 200)}`)
  })()
}
