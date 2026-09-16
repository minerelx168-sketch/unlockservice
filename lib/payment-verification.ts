import { randomUUID } from 'node:crypto'
import { getUser, hasAdminRole } from './auth'
import { credit, getBalance, type Balance } from './credits'
import { db } from './db'
import { consumeAttempt } from './rate-limit'
import {
  normalizeEvmAddress,
  normalizeTransactionId,
  paymentProviderConfiguration,
  paymentRouteConfiguration,
  paymentRouteDefinition,
  paymentRoutesConfiguration,
  paymentTransactionUrl,
  tronAddressToHex20,
  type PaymentChainKind,
  type PaymentProviderMode,
} from './payment-config'
import {
  inspectPaymentTransaction,
  PaymentProviderError,
} from './payment-chain-provider'

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const ADMIN_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,100}$/
const INVOICE_TIME_SKEW_MS = 5 * 60_000

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
  payment_route_id: string | null
  network_id: string | null
  chain_kind: PaymentChainKind | null
  asset_code: string | null
  provider_mode: PaymentProviderMode | null
  confirmations_required: number | null
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
  explorer_url: string | null
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
  transactionId: string,
  note: string,
): InvoiceVerificationView {
  try {
    return db().transaction(() => {
      const invoice = db()
        .prepare(
          `SELECT reference, user_id, gateway, status, credit_amount_cents,
                  payment_route_id, payment_network_id, payment_chain_kind, payment_chain_id,
                  payment_asset_code, payment_token_contract, payment_token_decimals,
                  payment_destination_address, payment_confirmations_required, payment_provider_mode
             FROM invoices WHERE reference = ? AND user_id = ?`,
        )
        .get(reference, userId) as {
          reference: string
          user_id: number
          gateway: string
          status: string
          credit_amount_cents: number
          payment_route_id: string | null
          payment_network_id: string | null
          payment_chain_kind: PaymentChainKind | null
          payment_chain_id: number | null
          payment_asset_code: string | null
          payment_token_contract: string | null
          payment_token_decimals: number | null
          payment_destination_address: string | null
          payment_confirmations_required: number | null
          payment_provider_mode: PaymentProviderMode | null
        } | undefined
      if (!invoice) throw new PaymentVerificationError('No such invoice.', 'not_found')
      if (invoice.status === 'success') {
        throw new PaymentVerificationError('This invoice is already settled.', 'invalid_state')
      }
      if (!['pending', 'review'].includes(invoice.status)) {
        throw new PaymentVerificationError(`This invoice cannot accept a transaction while ${invoice.status}.`, 'invalid_state')
      }

      const routeId = invoice.payment_route_id ?? ''
      const definition = paymentRouteDefinition(routeId)
      const route = paymentRouteConfiguration(routeId)
      if (
        !definition
        || !route?.enabled
        || invoice.gateway !== routeId
        || invoice.payment_network_id !== definition.networkId
        || invoice.payment_chain_kind !== definition.chainKind
        || invoice.payment_chain_id !== definition.chainId
        || invoice.payment_asset_code !== definition.asset
        || invoice.payment_provider_mode !== definition.providerMode
        || invoice.payment_token_decimals !== definition.tokenDecimals
        || !invoice.payment_token_contract
        || !invoice.payment_destination_address
        || !Number.isSafeInteger(invoice.payment_confirmations_required)
      ) {
        throw new PaymentVerificationError('This invoice does not have an active verified payment route.', 'unavailable')
      }

      const configuredContract = canonicalAddress(definition.chainKind, invoice.payment_token_contract)
      const allowlistedContract = canonicalAddress(definition.chainKind, definition.tokenContract)
      const destination = canonicalAddress(definition.chainKind, invoice.payment_destination_address)
      if (!configuredContract || configuredContract !== allowlistedContract || !destination) {
        throw new PaymentVerificationError('This invoice payment route is invalid. Do not send funds.', 'unavailable')
      }

      const txHash = normalizeTransactionId(definition.chainKind, transactionId)
      if (!txHash) {
        const guidance = definition.chainKind === 'tron'
          ? 'Enter the 64-character TRON transaction ID.'
          : 'Enter the 66-character transaction hash beginning with 0x.'
        throw new PaymentVerificationError(guidance, 'invalid_transaction')
      }

      const used = db()
        .prepare('SELECT invoice_reference FROM invoice_verifications WHERE tx_hash = ? COLLATE NOCASE LIMIT 1')
        .get(txHash) as { invoice_reference: string } | undefined
      if (used && used.invoice_reference !== reference) {
        throw new PaymentVerificationError('This transaction is already attached to another invoice.', 'duplicate_transaction')
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
              destination_address, tx_hash, requested_credit_cents,
              payment_route_id, network_id, chain_kind, asset_code, provider_mode,
              confirmations_required, status, next_attempt_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', datetime('now'))`,
        )
        .run(
          reference,
          invoice.payment_chain_id,
          invoice.payment_token_contract,
          invoice.payment_token_decimals,
          invoice.payment_destination_address,
          txHash,
          invoice.credit_amount_cents,
          routeId,
          invoice.payment_network_id,
          invoice.payment_chain_kind,
          invoice.payment_asset_code,
          invoice.payment_provider_mode,
          invoice.payment_confirmations_required,
        )
      db()
        .prepare(
          `UPDATE invoices
              SET payment_reference = ?, note = ?, status = 'review', updated_at = datetime('now')
            WHERE reference = ? AND user_id = ?`,
        )
        .run(txHash, cleanNote(note), reference, userId)
      addEvent(reference, 'submitted', `submitted:${reference}:${routeId}:${txHash}`, {
        metadata: {
          routeId,
          networkId: invoice.payment_network_id,
          assetCode: invoice.payment_asset_code,
        },
      })
      return getInvoiceVerification(reference, userId)!
    })()
  } catch (error) {
    if (error instanceof PaymentVerificationError) throw error
    if (error instanceof Error && /UNIQUE constraint failed: invoice_verifications\.tx_hash/i.test(error.message)) {
      throw new PaymentVerificationError('This transaction is already attached to another invoice.', 'duplicate_transaction')
    }
    throw error
  }
}

function topicAddress(value: unknown): string | null {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null
  return `0x${value.slice(-40).toLowerCase()}`
}

function canonicalAddress(chainKind: PaymentChainKind, value: string): string | null {
  if (chainKind === 'tron') return tronAddressToHex20(value)
  return normalizeEvmAddress(value)
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
        routeId: fresh.payment_route_id,
        networkId: fresh.network_id,
        assetCode: fresh.asset_code,
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
    const definition = paymentRouteDefinition(row.payment_route_id ?? '')
    const expectedContract = definition ? canonicalAddress(definition.chainKind, definition.tokenContract) : null
    const snapshottedContract = row.chain_kind ? canonicalAddress(row.chain_kind, row.token_contract) : null
    const destination = row.chain_kind ? canonicalAddress(row.chain_kind, row.destination_address) : null
    if (
      !definition
      || row.network_id !== definition.networkId
      || row.chain_kind !== definition.chainKind
      || row.chain_id !== definition.chainId
      || row.asset_code !== definition.asset
      || row.provider_mode !== definition.providerMode
      || row.token_decimals !== definition.tokenDecimals
      || !Number.isSafeInteger(row.confirmations_required)
      || !expectedContract
      || snapshottedContract !== expectedContract
      || !destination
    ) {
      markManualReview(row, 'payment_route_snapshot_mismatch')
      return 'manual_review'
    }

    const provider = paymentProviderConfiguration(definition.providerMode, definition.chainId)
    if (!provider.enabled) throw new PaymentProviderError('provider_disabled')
    const receipt = await inspectPaymentTransaction(
      {
        providerMode: definition.providerMode,
        chainKind: definition.chainKind,
        chainId: definition.chainId,
      },
      row.tx_hash,
    )
    if (!receipt) {
      markRetry(row, 'receipt_pending')
      return 'pending'
    }
    if (receipt.transactionId !== row.tx_hash) {
      markManualReview(row, 'transaction_hash_mismatch')
      return 'manual_review'
    }
    if (!receipt.succeeded) {
      markManualReview(row, 'receipt_failed')
      return 'manual_review'
    }

    const candidates: Array<{ logIndex: number; rawAmount: bigint }> = []
    for (const log of receipt.logs) {
      if (log.contractAddress !== snapshottedContract) continue
      if (log.topics[0] !== TRANSFER_TOPIC) continue
      if (topicAddress(log.topics[2]) !== destination) continue
      if (!/^0x[0-9a-fA-F]+$/.test(log.data)) continue
      candidates.push({ logIndex: log.logIndex, rawAmount: BigInt(log.data) })
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

    const invoiceCreatedAt = Date.parse(row.invoice_created_at)
    const transferTime = Date.parse(receipt.blockTimestamp)
    if (!Number.isFinite(invoiceCreatedAt) || !Number.isFinite(transferTime)) {
      throw new PaymentProviderError('provider_invalid_block')
    }
    if (transferTime < invoiceCreatedAt - INVOICE_TIME_SKEW_MS || transferTime > Date.now() + INVOICE_TIME_SKEW_MS) {
      db()
        .prepare(
          `UPDATE invoice_verifications
              SET receipt_block_number = ?, receipt_block_timestamp = ?, updated_at = ?
            WHERE invoice_reference = ?`,
        )
        .run(receipt.blockNumber, receipt.blockTimestamp, new Date().toISOString(), row.invoice_reference)
      markManualReview(row, 'transaction_outside_invoice_window', { transferPredatesInvoice: transferTime < invoiceCreatedAt })
      return 'manual_review'
    }

    if (receipt.latestFinalBlock < receipt.blockNumber) throw new PaymentProviderError('provider_block_inconsistent')
    const confirmations = receipt.latestFinalBlock - receipt.blockNumber + 1
    const requiredConfirmations = row.confirmations_required ?? 15
    if (confirmations < requiredConfirmations) {
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
          receipt.blockNumber,
          receipt.blockTimestamp,
          confirmations,
          timestamp,
          retryTimestamp(row.attempt_count + 1),
          timestamp,
          row.invoice_reference,
        )
      addEvent(row.invoice_reference, 'confirmation_wait', `confirmation_wait:${row.invoice_reference}:${confirmations}`, {
        metadata: {
          routeId: row.payment_route_id,
          networkId: row.network_id,
          assetCode: row.asset_code,
          confirmations,
          required: requiredConfirmations,
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
      receipt.blockNumber,
      receipt.blockTimestamp,
      confirmations,
    )
    return 'verified'
  } catch (error) {
    if (error instanceof PaymentProviderError) {
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
  const providerReady = paymentRoutesConfiguration().some((route) => route.providerReady)
  const safeLimit = Math.max(1, Math.min(Math.trunc(limit), 100))
  const summary: PaymentPollSummary = {
    enabled: providerReady,
    seen: 0,
    verified: 0,
    confirming: 0,
    manualReview: 0,
    pending: 0,
    errors: 0,
  }
  if (!providerReady) return summary

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
  const rows = db()
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
    .all(safeLimit) as Array<Omit<AdminInvoiceReview, 'explorer_url'>>
  return rows.map((row) => ({
    ...row,
    explorer_url: paymentTransactionUrl(row.payment_route_id, row.tx_hash),
  }))
}
