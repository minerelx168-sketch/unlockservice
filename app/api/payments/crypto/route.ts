import { NextResponse, after } from 'next/server'
import { guard } from '@/lib/api'
import { createInvoice, gatewayById, PaymentError, submitPaymentReference } from '@/lib/payments'
import { getCryptoDeposit } from '@/lib/crypto-deposit'
import { nudgeInvoicePayment } from '@/lib/payment-watcher'
import { consumeAttempt } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded
  const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
  try {
    if (!['create', 'status', 'check'].includes(String(body.action))) throw new PaymentError('Invalid deposit action.')
    if (!consumeAttempt('crypto-deposit', String(found.user.id), 30, 60)) return reply({ error: 'Please wait a moment before checking again.' }, 429)
    let reference = typeof body.reference === 'string' ? body.reference : ''
    if (body.action === 'create') {
      const gatewayId = typeof body.gateway === 'string' ? body.gateway : ''
      const gateway = gatewayById(gatewayId)
      if (gateway?.chainId !== 56 || gateway.chainKind !== 'evm') throw new PaymentError('Choose a supported token on BNB Smart Chain.')
      reference = createInvoice(found.user.id, gatewayId, typeof body.amountCents === 'number' ? body.amountCents : NaN).reference
    }
    // Read the owned request before accepting a hash or triggering a scan.
    let deposit = await getCryptoDeposit(reference, found.user.id)
    if (body.action === 'check' && typeof body.txId === 'string' && body.txId.trim()) {
      submitPaymentReference(reference, found.user.id, body.txId.trim(), '')
      deposit = await getCryptoDeposit(reference, found.user.id)
    }
    if (['pending', 'checking', 'confirming'].includes(deposit.status)) {
      after(() => nudgeInvoicePayment(reference).catch(() => undefined))
    }
    return reply({ deposit })
  } catch (error) {
    return reply({ error: error instanceof PaymentError ? error.message : 'We could not check your deposit. Please try again; do not send twice.' }, error instanceof PaymentError ? 400 : 503)
  }
}
