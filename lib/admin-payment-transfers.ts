import { getUser, hasAdminRole } from './auth'
import { db } from './db'
import { consumeAttempt } from './rate-limit'
import { inspectPaymentTransaction, PaymentProviderError } from './payment-chain-provider'
import {
  normalizeEvmAddress,
  paymentRouteConfiguration,
  tronAddressToHex20,
} from './payment-config'
import { INVOICE_TTL_DAYS, MATCH_BAND_E4, rawToE4, reservedCodeOwners } from './payment-codes'
import {
  attachDetectedTransfer,
  decideInvoiceVerification,
  INVOICE_TIME_SKEW_MS,
  PaymentVerificationError,
  verifyInvoiceTransaction,
} from './payment-verification'

type Decision = 'confirm' | 'dismiss' | 'reject'
type Input = { transferId: number; decision: Decision; invoiceReference?: string; reason: string; idempotencyKey: string }
type Transfer = {
  id: number; route_id: string; tx_hash: string; log_index: number; block_number: number | null
  block_time: string; amount_raw: string; amount_e4: number; status: string
}
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const KEY = /^[A-Za-z0-9._:-]{8,100}$/
function timestamp(value: string): number {
  return Date.parse(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value.replace(' ', 'T')}Z`)
}
function addressFromTopic(value: string | undefined): string | null {
  return value && /^0x[0-9a-f]{64}$/i.test(value) ? `0x${value.slice(-40).toLowerCase()}` : null
}
function recorded(id: number): Transfer | undefined {
  return db().prepare('SELECT * FROM chain_transfers WHERE id = ?').get(id) as Transfer | undefined
}
function existing(adminId: number, key: string) {
  return db().prepare('SELECT transfer_id, action, invoice_reference, reason FROM chain_transfer_admin_events WHERE admin_user_id = ? AND idempotency_key = ?')
    .get(adminId, `admin-transfer:${adminId}:${key}`) as
    | { transfer_id: number; action: Decision; invoice_reference: string | null; reason: string }
    | undefined
}
function assertSame(row: NonNullable<ReturnType<typeof existing>>, input: Input, reason: string): void {
  if (row.transfer_id !== input.transferId || row.action !== input.decision || row.reason !== reason
    || row.invoice_reference !== (input.decision === 'confirm' ? input.invoiceReference ?? null : null)) {
    throw new PaymentVerificationError('That request key was already used for another decision.', 'idempotency_conflict')
  }
}
function writeEvent(adminId: number, input: Input, reason: string): void {
  db().prepare(`INSERT INTO chain_transfer_admin_events
    (transfer_id, admin_user_id, action, invoice_reference, reason, idempotency_key)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    input.transferId, adminId, input.decision,
    input.decision === 'confirm' ? input.invoiceReference : null,
    reason, `admin-transfer:${adminId}:${input.idempotencyKey.trim()}`,
  )
}

/**
 * A person may associate one unmatched on-chain transfer to an existing
 * payment request. No POST body can invent a wallet, amount or transaction.
 * Confirm only settles after an independent receipt reread + finality check.
 */
export async function decideUnmatchedTransfer(adminUserId: number, input: Input): Promise<{ replayed: boolean; status: 'credited' | 'review' | 'closed' }> {
  input = { ...input, invoiceReference: input.invoiceReference?.trim() }
  const admin = getUser(adminUserId)
  if (!admin || !hasAdminRole(admin)) throw new PaymentVerificationError('Administrator access is required.', 'forbidden')
  if (!Number.isSafeInteger(input.transferId) || input.transferId < 1) throw new PaymentVerificationError('Transfer not found.', 'not_found')
  if (!['confirm', 'dismiss', 'reject'].includes(input.decision)) throw new PaymentVerificationError('Choose a transfer decision.', 'invalid_state')
  const reason = input.reason.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim()
  if (reason.length < 8 || reason.length > 240) throw new PaymentVerificationError('Enter a reason between 8 and 240 characters.', 'invalid_reason')
  const idempotencyKey = input.idempotencyKey.trim()
  if (!KEY.test(idempotencyKey)) throw new PaymentVerificationError('The request key is invalid.', 'invalid_idempotency')
  const replay = existing(adminUserId, idempotencyKey)
  if (replay) {
    assertSame(replay, input, reason)
    const invoice = replay.invoice_reference
      ? db().prepare('SELECT status FROM invoices WHERE reference = ?').get(replay.invoice_reference) as { status: string } | undefined
      : undefined
    return { replayed: true, status: replay.action !== 'confirm' ? 'closed' : invoice?.status === 'success' ? 'credited' : 'review' }
  }
  if (!consumeAttempt('admin-transfer-decision', String(adminUserId), 20, 10 * 60)) {
    throw new PaymentVerificationError('Too many transfer decisions. Wait and try again.', 'rate_limited')
  }
  const transfer = recorded(input.transferId)
  if (!transfer) throw new PaymentVerificationError('Transfer not found.', 'not_found')
  if (transfer.status !== 'unmatched') throw new PaymentVerificationError('This transfer has already been handled.', 'invalid_state')

  if (input.decision !== 'confirm') {
    return db().transaction(() => {
      const freshReplay = existing(adminUserId, idempotencyKey)
      if (freshReplay) { assertSame(freshReplay, input, reason); return { replayed: true, status: 'closed' as const } }
      const note = `${input.decision === 'reject' ? 'Rejected' : 'Dismissed'} by administrator ${adminUserId}: ${reason}`
      const result = db().prepare("UPDATE chain_transfers SET status = 'dismissed', note = ? WHERE id = ? AND status = 'unmatched'")
        .run(note.slice(0, 300), input.transferId)
      if (result.changes !== 1) throw new PaymentVerificationError('This transfer has already been handled.', 'invalid_state')
      writeEvent(adminUserId, input, reason)
      return { replayed: false, status: 'closed' as const }
    }).immediate()
  }

  const reference = input.invoiceReference?.trim() ?? ''
  if (!reference) throw new PaymentVerificationError('Select a specific payment request.', 'invalid_state')
  const invoice = db().prepare(`SELECT reference, status, payment_route_id, payment_amount_e4, total_due_cents,
      payment_destination_address, payment_token_contract, created_at, payment_confirmations_required
      FROM invoices WHERE reference = ?`).get(reference) as {
    reference: string; status: string; payment_route_id: string | null; payment_amount_e4: number | null
    total_due_cents: number; payment_destination_address: string | null; payment_token_contract: string | null
    created_at: string; payment_confirmations_required: number | null
  } | undefined
  if (!invoice || invoice.status !== 'pending' || invoice.payment_route_id !== transfer.route_id) {
    throw new PaymentVerificationError('Select an open payment request on this same network and token.', 'invalid_state')
  }
  const route = paymentRouteConfiguration(transfer.route_id)
  if (!route?.enabled || !route.providerReady || invoice.payment_token_contract !== route.tokenContract
    || invoice.payment_destination_address !== route.destinationAddress) {
    throw new PaymentVerificationError('The payment route is not ready or its snapshot differs.', 'unavailable')
  }
  if (Math.abs((invoice.payment_amount_e4 ?? invoice.total_due_cents * 100) - transfer.amount_e4) > MATCH_BAND_E4) {
    throw new PaymentVerificationError('The transfer amount is not close to this request.', 'invalid_state')
  }
  // If a code unambiguously belongs to another open invoice, don't let an
  // administrator assign the deposit to the wrong account from this queue.
  if (reservedCodeOwners(transfer.route_id, transfer.amount_e4, transfer.block_time, reference).length) {
    throw new PaymentVerificationError('A different open request owns this transfer code.', 'invalid_state')
  }
  const started = timestamp(invoice.created_at)
  const sent = timestamp(transfer.block_time)
  if (!Number.isFinite(started) || !Number.isFinite(sent) || sent <= started
    || sent > started + INVOICE_TTL_DAYS * 86_400_000 || sent > Date.now() + INVOICE_TIME_SKEW_MS) {
    throw new PaymentVerificationError('The transfer is outside the payment request window.', 'invalid_state')
  }

  let receipt: Awaited<ReturnType<typeof inspectPaymentTransaction>>
  try {
    receipt = await inspectPaymentTransaction({ providerMode: route.providerMode, chainKind: route.chainKind, chainId: route.chainId }, transfer.tx_hash)
  } catch (error) {
    if (error instanceof PaymentProviderError) throw new PaymentVerificationError('The network could not verify this transfer yet.', 'unavailable')
    throw error
  }
  if (!receipt || !receipt.succeeded || receipt.transactionId !== transfer.tx_hash
    || (transfer.block_number !== null && receipt.blockNumber !== transfer.block_number)
    || timestamp(receipt.blockTimestamp) !== sent || receipt.latestFinalBlock < receipt.blockNumber
    || receipt.latestFinalBlock - receipt.blockNumber + 1 < (invoice.payment_confirmations_required ?? route.confirmationsRequired)) {
    throw new PaymentVerificationError('Receipt or finality could not be verified. Do not credit.', 'invalid_state')
  }
  const destination = route.chainKind === 'tron' ? tronAddressToHex20(route.destinationAddress) : normalizeEvmAddress(route.destinationAddress)
  const contract = route.chainKind === 'tron' ? tronAddressToHex20(route.tokenContract) : normalizeEvmAddress(route.tokenContract)
  const walletEvents = receipt.logs.filter((entry) =>
    entry.topics[0] === TRANSFER_TOPIC && addressFromTopic(entry.topics[2]) === destination,
  )
  if (walletEvents.length !== 1) {
    throw new PaymentVerificationError('This transaction contains multiple wallet transfers; manual reconciliation is required.', 'invalid_state')
  }
  const log = receipt.logs.find((entry) => entry.logIndex === transfer.log_index)
  if (!destination || !contract || !log || log.contractAddress !== contract || log.topics[0] !== TRANSFER_TOPIC
    || addressFromTopic(log.topics[2]) !== destination || !/^\d+$/.test(transfer.amount_raw)
    || !/^0x[0-9a-f]+$/i.test(log.data) || BigInt(log.data) !== BigInt(transfer.amount_raw)
    || rawToE4(BigInt(log.data), route.tokenDecimals) !== transfer.amount_e4) {
    throw new PaymentVerificationError('Token, recipient, log or amount did not match the recorded transfer.', 'invalid_state')
  }
  // The claimed row and the invoice attach share one SQLite transaction. A
  // concurrent watcher/customer paste or a previous decision cannot steal it.
  db().transaction(() => {
    const freshReplay = existing(adminUserId, idempotencyKey)
    if (freshReplay) { assertSame(freshReplay, input, reason); return }
    const taken = db().prepare('SELECT 1 FROM invoice_verifications WHERE tx_hash = ? COLLATE NOCASE LIMIT 1')
      .get(transfer.tx_hash)
    if (taken) throw new PaymentVerificationError('This transaction is already attached to a payment request.', 'duplicate_transaction')
    const claim = db().prepare("UPDATE chain_transfers SET status = 'matched', invoice_reference = ?, note = NULL WHERE id = ? AND status = 'unmatched'")
      .run(reference, input.transferId)
    if (claim.changes !== 1) throw new PaymentVerificationError('This transfer has already been handled.', 'invalid_state')
    attachDetectedTransfer(reference, transfer.tx_hash)
    writeEvent(adminUserId, { ...input, invoiceReference: reference }, reason)
  }).immediate()
  // The existing verification pipeline rereads the receipt and applies the
  // exactly-once top-up. Uncoded transfers remain in the manual review queue
  // until an administrator approves them with verified receipt evidence.
  const outcome = await verifyInvoiceTransaction(reference)
  return { replayed: false, status: outcome === 'verified' ? 'credited' : 'review' }
}
