import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { ChainError } from '@/lib/bsc'
import { hasAdminRole } from '@/lib/auth'
import { PaymentError } from '@/lib/payments'
import { adminConfirmInvoice, adminDismissTransfer, adminRejectInvoice, scanUsdtTransfers } from '@/lib/usdt'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Administrator decisions on payments the watcher could not settle alone. */
export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  if (!hasAdminRole(found.user)) {
    return NextResponse.json({ success: false, error: 'Administrator access is required.' }, { status: 403 })
  }

  try {
    switch (body.action) {
      case 'confirm': {
        const transferId = body.transferId === undefined || body.transferId === null ? undefined : Number(body.transferId)
        if (transferId !== undefined && !Number.isSafeInteger(transferId)) {
          return NextResponse.json({ success: false, error: 'Bad transfer id.' }, { status: 400 })
        }
        const invoice = await adminConfirmInvoice(found.user.id, String(body.reference ?? ''), transferId)
        return NextResponse.json({ success: true, status: invoice.status, creditedCents: invoice.credited_cents })
      }
      case 'dismiss': {
        adminDismissTransfer(Number(body.transferId), String(body.reason ?? ''))
        return NextResponse.json({ success: true })
      }
      case 'reject': {
        adminRejectInvoice(String(body.reference ?? ''), String(body.reason ?? ''))
        return NextResponse.json({ success: true })
      }
      case 'scan': {
        return NextResponse.json({ success: true, scan: await scanUsdtTransfers({ force: true }) })
      }
      default:
        return NextResponse.json({ success: false, error: 'Unknown action.' }, { status: 400 })
    }
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 400 })
    }
    if (error instanceof ChainError) {
      return NextResponse.json({ success: false, error: `Could not check the chain: ${error.message}` }, { status: 503 })
    }
    /* The unique (provider, charge id) index is the last line against one
       payment settling two invoices; say so rather than answer with a 500. */
    if (error instanceof Error && /UNIQUE constraint failed: invoices\.provider/.test(error.message)) {
      return NextResponse.json(
        { success: false, error: 'That payment reference has already settled another invoice.' },
        { status: 409 },
      )
    }
    throw error
  }
}
