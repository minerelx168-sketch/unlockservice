import { randomUUID } from 'node:crypto'
import { getUser, hasAdminRole } from './auth'
import { credit, getBalance, type Balance } from './credits'
import { db } from './db'
import { consumeAttempt } from './rate-limit'
import {
  isTransactionHash,
  paymentVerificationConfiguration,
} from './payment-config'

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ADMIN_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/
const MAX_RESPONSE_BYTES = 1_000_000
const CHAIN_PROVIDER_REQUEST_INTERVAL_MS = 250
const INVOICE_TIME_SKEW_MS = 5 * 60_000
let nextChainProviderRequestAt = 0
let validatedRpcEndpoint = ''

type VerificationStatus = 'submitted' | 'confirming' | 'verified' | 'manual_review' | 'rejected'

type InvoiceVerificationRow = {
  invoice_reference: string
  user_id: number
  invoice_status: 'pending' | 'review' | 'success' | 'failed' | 'refunded'
  credit_amount_cents: number
  total_due_cents: number
  fee_cents: number
  tax_cents: number
  chain_id: number
  token_contract: string
  token_decimals: number
  destination_address: string
  tx_hash: string
  matched_log_index: number | null
  matched_amount_raw: string | null
  requested_credit_cents: number | null
  verified_credit_cents: number | null
  receipt_block_number: number | null
  receipt_block_timestamp: string | null
  invoice_created_at: string
  status: VerificationStatus
  confirmations: number
  attempt_count: number
  next_attempt_at: string | null
  last_checked_at: string | null
  error_code: string | null
  created_at: string
  updated_at: string
}

export type InvoiceVerificationView = Omit<
  InvoiceVerificationRow,
  'user_id' | 'invoice_status' | 'invoice_created_at' | 'credit_amount_cents' | 'total_due_cents' | 'fee_cents' | 'tax_cents'
>

export type AdminInvoiceReview = InvoiceVerificationRow & {
  username: string
  email: string
  gateway: string
  fee_cents: number
  tax_cents: number
  currency: string
  invoice_created_at: string
}

export type PaymentVerificationCode =
  | 'not_found'
  | 'unavailable'
  | 'invalid_transaction'
  | 'duplicate_transaction'
  | 'already_submitted'
  | 'invalid_state'
  | 'forbidden'
  | 'invalid_reason'
  | 'invalid_idempotency'
  | 'idempotency_conflict'
  | 'rate_limited'

export class PaymentVerificationError extends Error {
  constructor(message: string, readonly code: PaymentVerificationCode) {
    super(message)
    this.name = 'PaymentVerificationError'
  }
}

class UpstreamVerificationError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'UpstreamVerificationError'
  }
}

const VERIFICATION_SELECT = `
  SELECT v.*, i.user_id, i.status AS invoice_status,
         i.created_at AS invoice_created_at,
         i.credit_amount_cents, i.total_due_cents, i.fee_cents, i.tax_cents
    FROM invoice_verifications v
    JOIN invoices i ON i.reference = v.invoice_reference`

function verificationRow(reference: string, userId?: number): InvoiceVerificationRow | undefined {
  const ownerClause = userId === undefined ? '' : ' AND i.user_id = ?'
  return db()
    .prepare(`${VERIFICATION_SELECT} WHERE v.invoice_reference = ?${ownerClause} LIMIT 1`)
    .get(...(userId === undefined ? [reference] : [reference, userId])) as InvoiceVerificationRow | undefined
}

export function getInvoiceVerification(reference: string, userId: number): InvoiceVerificationView | undefined {
  const row = verificationRow(reference, userId)
  if (!row) return undefined
  const {
    user_id: _userId,
    invoice_status: _invoiceStatus,
    invoice_created_at: _invoiceCreatedAt,
    credit_amount_cents: _credit,
    total_due_cents: _due,
    fee_cents: _fee,
    tax_cents: _tax,
    ...view
  } = row
  return view
}

function cleanNote(value: string): string | null {
  const clean = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  return clean.slice(0, 500) || null
}

function cleanReason(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
}

function addEvent(
  invoiceReference: string,
  action: string,
  idempotencyKey: string,
  options: { adminUserId?: number; reason?: string | null; metadata?: Record<string, boolean | number | string | null> } = {},
) {
  db()
    .prepare(
      `INSERT OR IGNORE INTO invoice_verification_events
         (public_id, invoice_reference, admin_user_id, action, idempotency_key, reason, metadata_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      `ive_${randomUUID().replaceAll('-', '')}`,
      invoiceReference,
      options.adminUserId ?? null,
      action,
      idempotencyKey,
      options.reason ?? null,
      options.metadata ? JSON.stringify(options.metadata) : null,
    )
}

export function submitInvoiceTransaction(
  reference: string,
  userId: number,
  transactionHash: string,
  note: string,
): InvoiceVerificationView {
  const config = paymentVerificationConfiguration()
  if (!config.enabled) {
    throw new PaymentVerificationError('Automatic payment verification is not configured. Do not send funds.', 'unavailable')
  }

  const txHash = transactionHash.trim().toLowerCase()
  if (!isTransactionHash(txHash)) {
    throw new PaymentVerificationError('Enter the 66-character transaction hash beginning with 0x.', 'invalid_transaction')
  }

  try {
    return db().transaction(() => {
      const invoice = db()
        .prepare('SELECT reference, user_id, gateway, status, credit_amount_cents FROM invoices WHERE reference = ? AND user_id = ?')
        .get(reference, userId) as {
          reference: string
          user_id: number
          gateway: string
          status: string
          credit_amount_cents: number
        } | undefined
      if (!invoice) throw new PaymentVerificationError('No such invoice.', 'not_found')
      if (invoice.status === 'success') {
        throw new PaymentVerificationError('This invoice is already settled.', 'invalid_state')
      }
      if (!['pending', 'review'].includes(invoice.status)) {
        throw new PaymentVerificationError(`This invoice cannot accept a transaction while ${invoice.status}.`, 'invalid_state')
      }
      if (invoice.gateway !== 'crypto_networks') {
        throw new PaymentVerificationError('This invoice is not configured for on-chain verification.', 'unavailable')
      }

      const used = db()
        .prepare('SELECT invoice_reference FROM invoice_verifications WHERE tx_hash = ? COLLATE NOCASE LIMIT 1')
        .get(txHash) as { invoice_reference: string } | undefined
      if (used && used.invoice_reference !== reference) {
        throw new PaymentVerificationError('This transaction hash is already attached to another invoice.', 'duplicate_transaction')
      }

      const existing = verificationRow(reference, userId)
      if (existing) {
        if (existing.tx_hash !== txHash) {
          throw new PaymentVerificationError(
            'A transaction is already attached to this invoice. Contact support before changing it.',
            'already_submitted',
          )
        }
        return getInvoiceVerification(reference, userId)!
      }

      db()
        .prepare(
          `INSERT INTO invoice_verifications
             (invoice_reference, chain_id, token_contract, token_decimals,
              destination_address, tx_hash, requested_credit_cents, status, next_attempt_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'submitted', datetime('now'))`,
        )
        .run(
          reference,
          config.chainId,
          config.tokenContract,
          config.tokenDecimals,
          config.destinationAddress,
          txHash,
          invoice.credit_amount_cents,
        )
      db()
        .prepare(
          `UPDATE invoices
              SET payment_reference = ?, note = ?, status = 'review', updated_at = datetime('now')
            WHERE reference = ? AND user_id = ?`,
        )
        .run(txHash, cleanNote(note), reference, userId)
      addEvent(reference, 'submitted', `submitted:${reference}:${txHash}`)
      return getInvoiceVerification(reference, userId)!
    })()
  } catch (error) {
    if (error instanceof PaymentVerificationError) throw error
    if (error instanceof Error && /UNIQUE constraint failed: invoice_verifications\.tx_hash/i.test(error.message)) {
      throw new PaymentVerificationError('This transaction hash is already attached to another invoice.', 'duplicate_transaction')
    }
    throw error
  }
}

type ReceiptLog = {
  address?: unknown
  topics?: unknown
  data?: unknown
  logIndex?: unknown
  blockNumber?: unknown
  transactionHash?: unknown
  removed?: unknown
}

type Receipt = {
  status?: unknown
  blockNumber?: unknown
  transactionHash?: unknown
  logs?: unknown
}

function parseHexInteger(value: unknown): number | null {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) return null
  const parsed = Number.parseInt(value.slice(2), 16)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function topicAddress(value: unknown): string | null {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null
  return `0x${value.slice(-40).toLowerCase()}`
}

function rawAmountToCreditCents(rawAmount: bigint, decimals: number): number | null {
  if (rawAmount <= 0n || !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 36) return null
  const scaled = rawAmount * 100n
  const unit = 10n ** BigInt(decimals)
  if (scaled % unit !== 0n) return null
  const cents = scaled / unit
  if (cents <= 0n || cents > BigInt(Number.MAX_SAFE_INTEGER)) return null
  return Number(cents)
}

async function paceChainProviderRequest() {
  const now = Date.now()
  const waitMs = Math.max(0, nextChainProviderRequestAt - now)
  nextChainProviderRequestAt = Math.max(now, nextChainProviderRequestAt) + CHAIN_PROVIDER_REQUEST_INTERVAL_MS
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs))
}

async function chainProviderCall(
  method: string,
  params: unknown[],
  etherscanParameters: Record<string, string>,
): Promise<unknown> {
  const config = paymentVerificationConfiguration()
  if (!config.enabled) throw new UpstreamVerificationError('provider_disabled')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    await paceChainProviderRequest()
    const response = config.mode === 'bnb_rpc'
      ? await fetch(config.apiUrl, {
          method: 'POST',
          headers: { accept: 'application/json', 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
          cache: 'no-store',
          signal: controller.signal,
        })
      : await (() => {
          const url = new URL(config.apiUrl)
          for (const [key, value] of Object.entries({
            apikey: config.apiKey,
            chainid: String(config.chainId),
            ...etherscanParameters,
          })) {
            url.searchParams.set(key, value)
          }
          return fetch(url, {
            method: 'GET',
            headers: { accept: 'application/json' },
            cache: 'no-store',
            signal: controller.signal,
          })
        })()

    if (!response.ok) {
      throw new UpstreamVerificationError(response.status === 429 ? 'provider_rate_limited' : `provider_http_${response.status}`)
    }
    const declaredLength = Number(response.headers.get('content-length') ?? '0')
    if (declaredLength > MAX_RESPONSE_BYTES) throw new UpstreamVerificationError('provider_response_too_large')
    const text = await response.text()
    if (text.length > MAX_RESPONSE_BYTES) throw new UpstreamVerificationError('provider_response_too_large')
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new UpstreamVerificationError('provider_invalid_json')
    }
  } catch (error) {
    if (error instanceof UpstreamVerificationError) throw error
    throw new UpstreamVerificationError(error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_unavailable')
  } finally {
    clearTimeout(timeout)
  }
}

function upstreamErrorCode(value: unknown): string {
  const message = typeof value === 'string'
    ? value.toLowerCase()
    : value && typeof value === 'object' && typeof (value as Record<string, unknown>).message === 'string'
      ? String((value as Record<string, unknown>).message).toLowerCase()
      : ''
  if (message.includes('free api access') || message.includes('paid tier') || message.includes('upgrade your api plan')) {
    return 'provider_plan_required'
  }
  if (message.includes('rate limit') || message.includes('max rate limit')) return 'provider_rate_limited'
  if (message.includes('invalid api key') || message.includes('missing/invalid api key')) return 'provider_invalid_api_key'
  return 'provider_rpc_error'
}

function rpcResult(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') throw new UpstreamVerificationError('provider_invalid_response')
  const record = payload as Record<string, unknown>
  if (record.error) throw new UpstreamVerificationError(upstreamErrorCode(record.error))
  if (record.status === '0') throw new UpstreamVerificationError(upstreamErrorCode(record.result ?? record.message))
  if (!('result' in record)) throw new UpstreamVerificationError('provider_invalid_response')
  return record.result
}

async function ensureProviderChain(): Promise<void> {
  const config = paymentVerificationConfiguration()
  if (config.mode !== 'bnb_rpc' || validatedRpcEndpoint === config.apiUrl) return
  const payload = await chainProviderCall('eth_chainId', [], {})
  if (parseHexInteger(rpcResult(payload)) !== config.chainId) {
    throw new UpstreamVerificationError('provider_wrong_chain')
  }
  validatedRpcEndpoint = config.apiUrl
}

async function fetchReceipt(txHash: string): Promise<Receipt | null> {
  await ensureProviderChain()
  const payload = await chainProviderCall(
    'eth_getTransactionReceipt',
    [txHash],
    { module: 'proxy', action: 'eth_getTransactionReceipt', txhash: txHash },
  )
  const result = rpcResult(payload)
  if (result === null) return null
  if (!result || typeof result !== 'object') throw new UpstreamVerificationError('provider_invalid_receipt')
  return result as Receipt
}

async function fetchLatestBlock(): Promise<number> {
  const payload = await chainProviderCall('eth_blockNumber', [], { module: 'proxy', action: 'eth_blockNumber' })
  const result = parseHexInteger(rpcResult(payload))
  if (result === null) throw new UpstreamVerificationError('provider_invalid_block')
  return result
}

async function fetchBlockTimestamp(blockNumber: number): Promise<string> {
  const tag = `0x${blockNumber.toString(16)}`
  const payload = await chainProviderCall(
    'eth_getBlockByNumber',
    [tag, false],
    { module: 'proxy', action: 'eth_getBlockByNumber', tag, boolean: 'false' },
  )
  const result = rpcResult(payload)
  if (!result || typeof result !== 'object') throw new UpstreamVerificationError('provider_invalid_block')
  const block = result as Record<string, unknown>
  const returnedNumber = parseHexInteger(block.number)
  const timestampSeconds = parseHexInteger(block.timestamp)
  if (returnedNumber !== blockNumber || timestampSeconds === null) {
    throw new UpstreamVerificationError('provider_invalid_block')
  }
  const timestamp = new Date(timestampSeconds * 1_000)
  if (!Number.isFinite(timestamp.getTime())) throw new UpstreamVerificationError('provider_invalid_block')
  return timestamp.toISOString()
}

function retryTimestamp(attempt: number): string {
  const minutes = Math.min(30, Math.max(2, 2 ** Math.min(Math.max(attempt - 1, 0), 4)))
  return new Date(Date.now() + minutes * 60_000).toISOString()
}

function markRetry(row: InvoiceVerificationRow, code: string) {
  const attempts = row.attempt_count + 1
  db()
    .prepare(
      `UPDATE invoice_verifications
          SET attempt_count = ?, last_checked_at = ?, next_attempt_at = ?, error_code = ?, updated_at = ?
        WHERE invoice_reference = ? AND status IN ('submitted', 'confirming')`,
    )
    .run(attempts, new Date().toISOString(), retryTimestamp(attempts), code, new Date().toISOString(), row.invoice_reference)
}

function markManualReview(row: InvoiceVerificationRow, code: string, metadata: Record<string, boolean | number | string | null> = {}) {
  db().transaction(() => {
    db()
      .prepare(
        `UPDATE invoice_verifications
            SET status = 'manual_review', error_code = ?, last_checked_at = ?, next_attempt_at = NULL,
                attempt_count = attempt_count + 1, updated_at = ?
          WHERE invoice_reference = ? AND status IN ('submitted', 'confirming')`,
      )
      .run(code, new Date().toISOString(), new Date().toISOString(), row.invoice_reference)
    addEvent(row.invoice_reference, 'mismatch', `mismatch:${row.invoice_reference}:${code}`, { metadata })
  })()
}

function settleVerifiedInvoice(
  row: InvoiceVerificationRow,
  logIndex: number,
  rawAmount: string,
  verifiedCreditCents: number,
  blockNumber: number,
  blockTimestamp: string,
  confirmations: number,
) {
  db().transaction(() => {
    const fresh = verificationRow(row.invoice_reference)
    if (!fresh) throw new Error('invoice verification disappeared')
    if (fresh.invoice_status === 'success' && fresh.status === 'verified') return
    if (!['submitted', 'confirming'].includes(fresh.status) || fresh.invoice_status !== 'review') {
      throw new Error('invoice verification state changed before settlement')
    }

    credit(fresh.user_id, verifiedCreditCents, 'topup', 'invoice', fresh.invoice_reference)
    const timestamp = new Date().toISOString()
    db()
      .prepare(
        `UPDATE invoices
            SET status = 'success', credit_amount_cents = ?, total_due_cents = ?,
                provider_charge_id = COALESCE(provider_charge_id, ?),
                paid_at = COALESCE(paid_at, ?), credited_at = COALESCE(credited_at, ?), updated_at = ?
          WHERE reference = ? AND user_id = ? AND status = 'review'`,
      )
      .run(
        verifiedCreditCents,
        verifiedCreditCents,
        fresh.tx_hash,
        timestamp,
        timestamp,
        timestamp,
        fresh.invoice_reference,
        fresh.user_id,
      )
    db()
      .prepare(
        `UPDATE invoice_verifications
            SET status = 'verified', matched_log_index = ?, matched_amount_raw = ?,
                verified_credit_cents = ?, receipt_block_number = ?, receipt_block_timestamp = ?,
                confirmations = ?, error_code = NULL,
                last_checked_at = ?, next_attempt_at = NULL, attempt_count = attempt_count + 1,
                updated_at = ?
          WHERE invoice_reference = ?`,
      )
      .run(
        logIndex,
        rawAmount,
        verifiedCreditCents,
        blockNumber,
        blockTimestamp,
        confirmations,
        timestamp,
        timestamp,
        fresh.invoice_reference,
      )
    addEvent(fresh.invoice_reference, 'verified_auto', `verified_auto:${fresh.invoice_reference}:${fresh.tx_hash}:${logIndex}`, {
      metadata: {
        chainId: fresh.chain_id,
        confirmations,
        amountMatched: fresh.requested_credit_cents === verifiedCreditCents,
        requestedCreditCents: fresh.requested_credit_cents,
        verifiedCreditCents,
      },
    })
  })()
}

export type VerificationAttempt = 'verified' | 'confirming' | 'manual_review' | 'pending'

export async function verifyInvoiceTransaction(reference: string): Promise<VerificationAttempt> {
  const row = verificationRow(reference)
  if (!row) throw new PaymentVerificationError('No such invoice verification.', 'not_found')
  if (row.status === 'verified') return 'verified'
  if (row.status === 'manual_review' || row.status === 'rejected') return 'manual_review'

  try {
    const receipt = await fetchReceipt(row.tx_hash)
    if (!receipt) {
      markRetry(row, 'receipt_pending')
      return 'pending'
    }
    if (String(receipt.transactionHash ?? '').toLowerCase() !== row.tx_hash) {
      markManualReview(row, 'transaction_hash_mismatch')
      return 'manual_review'
    }
    if (receipt.status !== '0x1') {
      markManualReview(row, 'receipt_failed')
      return 'manual_review'
    }

    const blockNumber = parseHexInteger(receipt.blockNumber)
    if (blockNumber === null || !Array.isArray(receipt.logs)) {
      throw new UpstreamVerificationError('provider_invalid_receipt')
    }

    const candidates: Array<{ logIndex: number; rawAmount: bigint }> = []
    for (const value of receipt.logs as ReceiptLog[]) {
      if (!value || typeof value !== 'object' || value.removed === true) continue
      if (String(value.address ?? '').toLowerCase() !== row.token_contract) continue
      if (!Array.isArray(value.topics) || String(value.topics[0] ?? '').toLowerCase() !== TRANSFER_TOPIC) continue
      if (topicAddress(value.topics[2]) !== row.destination_address) continue
      if (String(value.transactionHash ?? '').toLowerCase() !== row.tx_hash) continue
      if (parseHexInteger(value.blockNumber) !== blockNumber) continue
      const logIndex = parseHexInteger(value.logIndex)
      if (logIndex === null || typeof value.data !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value.data)) continue
      candidates.push({ logIndex, rawAmount: BigInt(value.data) })
    }

    if (candidates.length !== 1) {
      markManualReview(row, candidates.length === 0 ? 'transfer_not_found' : 'ambiguous_transfer_logs', {
        matchingLogs: candidates.length,
      })
      return 'manual_review'
    }

    const candidate = candidates[0]
    const verifiedCreditCents = rawAmountToCreditCents(candidate.rawAmount, row.token_decimals)
    if (verifiedCreditCents === null) {
      markManualReview(row, 'verified_amount_not_cent_exact')
      return 'manual_review'
    }
    if (row.fee_cents !== 0 || row.tax_cents !== 0) {
      markManualReview(row, 'unsupported_fee_or_tax_policy')
      return 'manual_review'
    }

    const blockTimestamp = await fetchBlockTimestamp(blockNumber)
    const invoiceCreatedAt = Date.parse(row.invoice_created_at)
    const transferTime = Date.parse(blockTimestamp)
    if (!Number.isFinite(invoiceCreatedAt) || !Number.isFinite(transferTime)) {
      throw new UpstreamVerificationError('provider_invalid_block')
    }
    if (transferTime < invoiceCreatedAt - INVOICE_TIME_SKEW_MS || transferTime > Date.now() + INVOICE_TIME_SKEW_MS) {
      db()
        .prepare(
          `UPDATE invoice_verifications
              SET receipt_block_number = ?, receipt_block_timestamp = ?, updated_at = ?
            WHERE invoice_reference = ?`,
        )
        .run(blockNumber, blockTimestamp, new Date().toISOString(), row.invoice_reference)
      markManualReview(row, 'transaction_outside_invoice_window', { transferPredatesInvoice: transferTime < invoiceCreatedAt })
      return 'manual_review'
    }

    const latestBlock = await fetchLatestBlock()
    if (latestBlock < blockNumber) throw new UpstreamVerificationError('provider_block_inconsistent')
    const confirmations = latestBlock - blockNumber + 1
    const config = paymentVerificationConfiguration()
    if (!config.enabled || config.chainId !== row.chain_id) throw new UpstreamVerificationError('provider_disabled')

    if (confirmations < config.confirmationsRequired) {
      const timestamp = new Date().toISOString()
      db()
        .prepare(
          `UPDATE invoice_verifications
              SET status = 'confirming', matched_log_index = ?, matched_amount_raw = ?,
                  verified_credit_cents = ?, receipt_block_number = ?, receipt_block_timestamp = ?,
                  confirmations = ?, error_code = NULL,
                  last_checked_at = ?, next_attempt_at = ?, attempt_count = attempt_count + 1,
                  updated_at = ?
            WHERE invoice_reference = ? AND status IN ('submitted', 'confirming')`,
        )
        .run(
          candidate.logIndex,
          candidate.rawAmount.toString(),
          verifiedCreditCents,
          blockNumber,
          blockTimestamp,
          confirmations,
          timestamp,
          retryTimestamp(row.attempt_count + 1),
          timestamp,
          row.invoice_reference,
        )
      addEvent(row.invoice_reference, 'confirmation_wait', `confirmation_wait:${row.invoice_reference}:${confirmations}`, {
        metadata: {
          confirmations,
          required: config.confirmationsRequired,
          amountMatched: row.requested_credit_cents === verifiedCreditCents,
          requestedCreditCents: row.requested_credit_cents,
          verifiedCreditCents,
        },
      })
      return 'confirming'
    }

    settleVerifiedInvoice(
      row,
      candidate.logIndex,
      candidate.rawAmount.toString(),
      verifiedCreditCents,
      blockNumber,
      blockTimestamp,
      confirmations,
    )
    return 'verified'
  } catch (error) {
    if (error instanceof UpstreamVerificationError) {
      markRetry(row, error.code)
      return 'pending'
    }
    throw error
  }
}

export type PaymentPollSummary = {
  enabled: boolean
  seen: number
  verified: number
  confirming: number
  manualReview: number
  pending: number
  errors: number
}

export async function pollInvoiceVerifications(limit = 20): Promise<PaymentPollSummary> {
  const config = paymentVerificationConfiguration()
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
  const summary: PaymentPollSummary = {
    enabled: config.enabled,
    seen: 0,
    verified: 0,
    confirming: 0,
    manualReview: 0,
    pending: 0,
    errors: 0,
  }
  if (!config.enabled) return summary

  const rows = db()
    .prepare(
      `SELECT invoice_reference
         FROM invoice_verifications
        WHERE status IN ('submitted', 'confirming')
          AND (next_attempt_at IS NULL OR next_attempt_at <= datetime('now'))
        ORDER BY COALESCE(next_attempt_at, updated_at) ASC
        LIMIT ?`,
    )
    .all(safeLimit) as Array<{ invoice_reference: string }>

  for (const row of rows) {
    summary.seen += 1
    try {
      const result = await verifyInvoiceTransaction(row.invoice_reference)
      if (result === 'verified') summary.verified += 1
      else if (result === 'confirming') summary.confirming += 1
      else if (result === 'manual_review') summary.manualReview += 1
      else summary.pending += 1
    } catch {
      summary.errors += 1
    }
  }
  return summary
}

function existingAdminEvent(adminUserId: number, idempotencyKey: string) {
  return db()
    .prepare(
      `SELECT invoice_reference, action, reason
         FROM invoice_verification_events
        WHERE idempotency_key = ? AND admin_user_id = ? LIMIT 1`,
    )
    .get(`admin:${adminUserId}:${idempotencyKey}`, adminUserId) as
      | { invoice_reference: string; action: string; reason: string | null }
      | undefined
}

export function decideInvoiceVerification(
  adminUserId: number,
  input: { invoiceReference: string; decision: 'approve' | 'reject'; reason: string; idempotencyKey: string },
): { balance: Balance; replayed: boolean } {
  const admin = getUser(adminUserId)
  if (!admin || !hasAdminRole(admin)) {
    throw new PaymentVerificationError('Administrator access is required.', 'forbidden')
  }
  const reason = cleanReason(input.reason)
  if (reason.length < 8 || reason.length > 240) {
    throw new PaymentVerificationError('Enter a reason between 8 and 240 characters.', 'invalid_reason')
  }
  const idempotencyKey = input.idempotencyKey.trim()
  if (!ADMIN_KEY_PATTERN.test(idempotencyKey)) {
    throw new PaymentVerificationError('The request key is invalid. Reload and try again.', 'invalid_idempotency')
  }
  const eventKey = `admin:${adminUserId}:${idempotencyKey}`
  const replay = existingAdminEvent(adminUserId, idempotencyKey)
  if (replay) {
    if (replay.invoice_reference !== input.invoiceReference || replay.action !== `${input.decision}_manual` || replay.reason !== reason) {
      throw new PaymentVerificationError('That request key was already used for another decision.', 'idempotency_conflict')
    }
    const row = verificationRow(input.invoiceReference)
    if (!row) throw new PaymentVerificationError('No such invoice verification.', 'not_found')
    return { balance: getBalance(row.user_id), replayed: true }
  }
  if (!consumeAttempt('admin-invoice-verification', String(adminUserId), 30, 10 * 60)) {
    throw new PaymentVerificationError('Too many invoice decisions. Wait and try again.', 'rate_limited')
  }

  return db().transaction(() => {
    const freshReplay = existingAdminEvent(adminUserId, idempotencyKey)
    if (freshReplay) {
      if (
        freshReplay.invoice_reference !== input.invoiceReference
        || freshReplay.action !== `${input.decision}_manual`
        || freshReplay.reason !== reason
      ) {
        throw new PaymentVerificationError('That request key was already used for another decision.', 'idempotency_conflict')
      }
      const replayRow = verificationRow(input.invoiceReference)
      if (!replayRow) throw new PaymentVerificationError('No such invoice verification.', 'not_found')
      return { balance: getBalance(replayRow.user_id), replayed: true }
    }

    const row = verificationRow(input.invoiceReference)
    if (!row) throw new PaymentVerificationError('No such invoice verification.', 'not_found')
    if (row.invoice_status === 'success') {
      if (input.decision === 'approve') {
        addEvent(row.invoice_reference, 'approve_manual', eventKey, { adminUserId, reason })
        return { balance: getBalance(row.user_id), replayed: false }
      }
      throw new PaymentVerificationError('A settled invoice cannot be rejected.', 'invalid_state')
    }
    if (!['review'].includes(row.invoice_status) || !['submitted', 'confirming', 'manual_review'].includes(row.status)) {
      throw new PaymentVerificationError('This invoice is not awaiting a verification decision.', 'invalid_state')
    }

    const timestamp = new Date().toISOString()
    if (input.decision === 'approve') {
      const approvedCreditCents = row.verified_credit_cents ?? row.credit_amount_cents
      const balance = credit(row.user_id, approvedCreditCents, 'topup', 'invoice', row.invoice_reference)
      db()
        .prepare(
          `UPDATE invoices
              SET status = 'success', credit_amount_cents = ?, total_due_cents = ?,
                  provider_charge_id = COALESCE(provider_charge_id, ?),
                  paid_at = COALESCE(paid_at, ?), credited_at = COALESCE(credited_at, ?), updated_at = ?
            WHERE reference = ? AND user_id = ? AND status = 'review'`,
        )
        .run(
          approvedCreditCents,
          approvedCreditCents,
          row.tx_hash,
          timestamp,
          timestamp,
          timestamp,
          row.invoice_reference,
          row.user_id,
        )
      db()
        .prepare(
          `UPDATE invoice_verifications
              SET status = 'verified', verified_credit_cents = COALESCE(verified_credit_cents, ?),
                  error_code = NULL, next_attempt_at = NULL, updated_at = ?
            WHERE invoice_reference = ?`,
        )
        .run(approvedCreditCents, timestamp, row.invoice_reference)
      addEvent(row.invoice_reference, 'approve_manual', eventKey, {
        adminUserId,
        reason,
        metadata: {
          requestedCreditCents: row.requested_credit_cents,
          verifiedCreditCents: row.verified_credit_cents,
          approvedCreditCents,
        },
      })
      return { balance, replayed: false }
    }

    db()
      .prepare("UPDATE invoices SET status = 'failed', updated_at = ? WHERE reference = ? AND user_id = ? AND status = 'review'")
      .run(timestamp, row.invoice_reference, row.user_id)
    db()
      .prepare(
        `UPDATE invoice_verifications
            SET status = 'rejected', error_code = 'rejected_by_admin', next_attempt_at = NULL, updated_at = ?
          WHERE invoice_reference = ?`,
      )
      .run(timestamp, row.invoice_reference)
    addEvent(row.invoice_reference, 'reject_manual', eventKey, { adminUserId, reason })
    return { balance: getBalance(row.user_id), replayed: false }
  })()
}

export function listAdminInvoiceReviews(limit = 50): AdminInvoiceReview[] {
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
  return db()
    .prepare(
      `SELECT v.*, i.user_id, i.status AS invoice_status,
              i.gateway, i.credit_amount_cents, i.fee_cents, i.tax_cents,
              i.total_due_cents, i.currency, i.created_at AS invoice_created_at,
              u.username, u.email
         FROM invoice_verifications v
         JOIN invoices i ON i.reference = v.invoice_reference
         JOIN users u ON u.id = i.user_id
        WHERE i.status = 'review' AND v.status IN ('submitted', 'confirming', 'manual_review')
        ORDER BY CASE v.status WHEN 'manual_review' THEN 0 ELSE 1 END, v.updated_at ASC
        LIMIT ?`,
    )
    .all(safeLimit) as AdminInvoiceReview[]
}
