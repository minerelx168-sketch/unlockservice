import { getInvoice, invoiceGateway, PaymentError } from './payments'
import { getInvoiceVerification } from './payment-verification'
import { codedInvoiceExpired, formatE4 } from './payment-codes'
import { paymentAddressQrDataUrl } from './payment-qr'
import { paymentTransactionUrl } from './payment-config'

export type CryptoDeposit = {
  reference: string
  status: 'pending' | 'checking' | 'confirming' | 'review' | 'success' | 'closed'
  amount: string
  requestedCents: number
  creditedCents: number | null
  receivedCents: number | null
  feeCents: number
  asset: string
  network: string
  address: string
  qr: string
  coded: boolean
  actualReceived: boolean
  confirmations: number
  confirmationsRequired: number
  explorerUrl: string | null
  addressUrl: string
}

/** Ownership is checked before any details or chain work are exposed. */
export async function getCryptoDeposit(reference: string, userId: number): Promise<CryptoDeposit> {
  const invoice = getInvoice(reference, userId)
  if (!invoice || invoice.payment_chain_id !== 56 || invoice.payment_chain_kind !== 'evm') {
    throw new PaymentError('Payment request not found.')
  }
  const gateway = invoiceGateway(invoice)
  if (!gateway || !invoice.payment_destination_address) throw new PaymentError('Payment details are unavailable.')
  const verification = getInvoiceVerification(reference, userId)
  const closed = codedInvoiceExpired(invoice) || ['failed', 'refunded'].includes(invoice.status)
  const status: CryptoDeposit['status'] = invoice.status === 'success' ? 'success'
    : closed || verification?.status === 'rejected' ? 'closed'
    : verification?.status === 'manual_review' ? 'review'
    : verification?.status === 'confirming' ? 'confirming'
    : verification ? 'checking' : 'pending'
  return {
    reference, status,
    amount: invoice.payment_amount_e4 !== null ? formatE4(invoice.payment_amount_e4) : (invoice.total_due_cents / 100).toFixed(2),
    requestedCents: verification?.requested_credit_cents ?? invoice.credit_amount_cents,
    creditedCents: invoice.status === 'success' ? invoice.credit_amount_cents : null,
    receivedCents: verification?.verified_credit_cents ?? null,
    feeCents: invoice.fee_cents,
    asset: gateway.asset === 'BSC-USD' ? 'USDT' : gateway.asset,
    network: 'BNB Smart Chain (BEP-20)',
    address: invoice.payment_destination_address,
    qr: await paymentAddressQrDataUrl(invoice.payment_destination_address),
    coded: invoice.payment_amount_e4 !== null,
    actualReceived: invoice.payment_credit_policy === 'actual_received',
    confirmations: verification?.confirmations ?? 0,
    confirmationsRequired: invoice.payment_confirmations_required ?? 15,
    explorerUrl: verification ? paymentTransactionUrl(verification.payment_route_id, verification.tx_hash) : null,
    addressUrl: `https://bscscan.com/address/${invoice.payment_destination_address}#tokentxns`,
  }
}
