import { randomBytes } from 'node:crypto'
import { credit } from './credits'
import { db } from './db'
import {
  enabledPaymentRoutes,
  paymentRouteDefinition,
  type PaymentChainKind,
  type PaymentProviderMode,
  type PaymentRouteConfig,
} from './payment-config'
import { submitInvoiceTransaction } from './payment-verification'

/**
 * An invoice locks its numbers and chain/token route at creation. A customer may
 * submit a transaction identifier, but credit lands only after trusted server-side
 * verification. No client-supplied contract, recipient, decimals or amount is trusted.
 */

export type Invoice = {
  reference: string
  user_id: number
  gateway: string
  credit_amount_cents: number
  fee_cents: number
  tax_cents: number
  total_due_cents: number
  currency: string
  status: 'pending' | 'review' | 'success' | 'failed' | 'refunded'
  payment_reference: string | null
  note: string | null
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
  created_at: string
  updated_at: string
}

type InvoiceRow = Invoice & {
  provider: string | null
  provider_charge_id: string | null
  idempotency_key: string | null
  paid_at: string | null
  credited_at: string | null
}

export type Gateway = {
  id: string
  label: string
  asset: string
  network: string
  networkId: string
  chainKind: PaymentChainKind
  chainId: number
  providerMode: PaymentProviderMode
  feeBasisPoints: number
  address: string
  tokenContract: string
  tokenDecimals: number
  confirmationsRequired: number
  explorerTransactionBaseUrl: string
  riskClassification: 'issuer_native' | 'third_party_pegged'
  automaticVerification: true
}

function gatewayFromRoute(route: PaymentRouteConfig): Gateway {
  return {
    id: route.id,
    label: route.label,
    asset: route.asset,
    network: route.network,
    networkId: route.networkId,
    chainKind: route.chainKind,
    chainId: route.chainId,
    providerMode: route.providerMode,
    feeBasisPoints: route.feeBasisPoints,
    address: route.destinationAddress,
    tokenContract: route.tokenContract,
    tokenDecimals: route.tokenDecimals,
    confirmationsRequired: route.confirmationsRequired,
    explorerTransactionBaseUrl: route.explorerTransactionBaseUrl,
    riskClassification: route.riskClassification,
    automaticVerification: true,
  }
}

/** A route is sellable only when the global gate, route gate, wallet and provider are ready. */
export const GATEWAYS: Gateway[] = enabledPaymentRoutes().map(gatewayFromRoute)

export function gatewayById(gatewayId: string): Gateway | undefined {
  return GATEWAYS.find((entry) => entry.id === gatewayId)
}

export function invoiceGateway(invoice: Invoice): Gateway | undefined {
  const active = gatewayById(invoice.payment_route_id ?? invoice.gateway)
  if (active) return active
  const definition = paymentRouteDefinition(invoice.payment_route_id ?? '')
  if (!definition || !invoice.payment_destination_address) return undefined
  return {
    id: definition.id,
    label: definition.label,
    asset: invoice.payment_asset_code ?? definition.asset,
    network: definition.network,
    networkId: invoice.payment_network_id ?? definition.networkId,
    chainKind: invoice.payment_chain_kind ?? definition.chainKind,
    chainId: invoice.payment_chain_id ?? definition.chainId,
    providerMode: invoice.payment_provider_mode ?? definition.providerMode,
    feeBasisPoints: 0,
    address: invoice.payment_destination_address,
    tokenContract: invoice.payment_token_contract ?? definition.tokenContract,
    tokenDecimals: invoice.payment_token_decimals ?? definition.tokenDecimals,
    confirmationsRequired: invoice.payment_confirmations_required ?? 15,
    explorerTransactionBaseUrl: definition.explorerTransactionBaseUrl,
    riskClassification: definition.riskClassification,
    automaticVerification: true,
  }
}

export type GatewayId = string

export class PaymentError extends Error {}

export const MAX_TOPUP_CENTS = 1_000_000

const INVOICE_COLUMNS = `
  reference, user_id, gateway, credit_amount_cents, fee_cents, tax_cents,
  total_due_cents, currency, status, payment_reference, note,
  payment_route_id, payment_network_id, payment_chain_kind, payment_chain_id,
  payment_asset_code, payment_token_contract, payment_token_decimals,
  payment_destination_address, payment_confirmations_required, payment_provider_mode,
  created_at, updated_at
`

function invoiceRow(reference: string, userId?: number): InvoiceRow | undefined {
  const where = userId === undefined ? 'reference = ?' : 'reference = ? AND user_id = ?'
  return db()
    .prepare(`SELECT *, COALESCE(provider, gateway) AS provider FROM invoices WHERE ${where}`)
    .get(...(userId === undefined ? [reference] : [reference, userId])) as InvoiceRow | undefined
}

export function createInvoice(userId: number, gatewayId: string, creditCents: number): Invoice {
  const gateway = gatewayById(gatewayId)
  if (!gateway) throw new PaymentError('No payment method is configured. Contact support before sending funds.')
  if (!Number.isSafeInteger(creditCents) || creditCents <= 0 || creditCents > MAX_TOPUP_CENTS) {
    throw new PaymentError(
      `Enter an amount greater than $0.00, up to $${(MAX_TOPUP_CENTS / 100).toFixed(2)}, with no more than 2 decimal places.`,
    )
  }

  const open = db()
    .prepare(
      `SELECT ${INVOICE_COLUMNS} FROM invoices
        WHERE user_id = ? AND gateway = ? AND credit_amount_cents = ?
          AND status = 'pending' AND payment_reference IS NULL
        ORDER BY created_at DESC, rowid DESC LIMIT 1`,
    )
    .get(userId, gateway.id, creditCents) as Invoice | undefined
  if (open) return open

  const fee = Math.round((creditCents * gateway.feeBasisPoints) / 10_000)
  const reference = randomBytes(16).toString('hex')
  db()
    .prepare(
      `INSERT INTO invoices
         (reference, user_id, gateway, credit_amount_cents, fee_cents, tax_cents,
          total_due_cents, provider, idempotency_key,
          payment_route_id, payment_network_id, payment_chain_kind, payment_chain_id,
          payment_asset_code, payment_token_contract, payment_token_decimals,
          payment_destination_address, payment_confirmations_required, payment_provider_mode)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      reference,
      userId,
      gateway.id,
      creditCents,
      fee,
      creditCents + fee,
      gateway.providerMode,
      `${userId}-${gateway.id}-${creditCents}-${randomBytes(16).toString('hex')}`,
      gateway.id,
      gateway.networkId,
      gateway.chainKind,
      gateway.chainId,
      gateway.asset,
      gateway.tokenContract,
      gateway.tokenDecimals,
      gateway.address,
      gateway.confirmationsRequired,
      gateway.providerMode,
    )
  return getInvoice(reference, userId)!
}

export function getInvoice(reference: string, userId: number): Invoice | undefined {
  return db()
    .prepare(`SELECT ${INVOICE_COLUMNS} FROM invoices WHERE reference = ? AND user_id = ?`)
    .get(reference, userId) as Invoice | undefined
}

export function listInvoices(userId: number, limit = 50): Invoice[] {
  return db()
    .prepare(
      `SELECT ${INVOICE_COLUMNS} FROM invoices
        WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
    )
    .all(userId, limit) as Invoice[]
}

/** The customer submits an on-chain transaction identifier; this never changes their balance. */
export function submitPaymentReference(
  reference: string,
  userId: number,
  paymentReference: string,
  note: string,
): Invoice {
  try {
    submitInvoiceTransaction(reference, userId, paymentReference, note)
    return getInvoice(reference, userId)!
  } catch (error) {
    if (error instanceof Error) throw new PaymentError(error.message)
    throw error
  }
}

export function selfApprovalEnabled(): boolean {
  if (process.env.NODE_ENV === 'production') return false
  return process.env.IUNLOCKMOBILE_ALLOW_SELF_APPROVE === '1'
}

/** Trusted confirmation. Duplicate confirmation is a no-op. */
export function approveInvoice(reference: string, userId: number, providerChargeId?: string): Invoice {
  return db().transaction(() => {
    const invoice = invoiceRow(reference, userId)
    if (!invoice) throw new PaymentError('No such invoice.')
    if (invoice.status === 'success') return getInvoice(reference, userId)!
    if (!['pending', 'review'].includes(invoice.status)) {
      throw new PaymentError(`Invoice cannot be confirmed while ${invoice.status}.`)
    }

    credit(userId, invoice.credit_amount_cents, 'topup', 'invoice', reference)
    const timestamp = new Date().toISOString()
    db()
      .prepare(
        `UPDATE invoices
            SET status = 'success',
                provider_charge_id = COALESCE(provider_charge_id, ?),
                paid_at = COALESCE(paid_at, ?),
                credited_at = COALESCE(credited_at, ?),
                updated_at = ?
          WHERE reference = ? AND user_id = ?`,
      )
      .run(providerChargeId ?? null, timestamp, timestamp, timestamp, reference, userId)
    return getInvoice(reference, userId)!
  })()
}

export function invoiceSummary(userId: number) {
  const rows = db()
    .prepare('SELECT status, COUNT(*) AS count FROM invoices WHERE user_id = ? GROUP BY status')
    .all(userId) as Array<{ status: Invoice['status']; count: number }>
  const by = new Map(rows.map((row) => [row.status, row.count]))
  return {
    successful: by.get('success') ?? 0,
    pendingReview: (by.get('pending') ?? 0) + (by.get('review') ?? 0),
    failed: by.get('failed') ?? 0,
    refunded: by.get('refunded') ?? 0,
    all: rows.reduce((sum, row) => sum + row.count, 0),
  }
}

export function shortReference(reference: string): string {
  return `#${reference.slice(0, 10).toUpperCase()}`
}
