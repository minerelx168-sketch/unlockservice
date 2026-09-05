import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { OrderError, submitOrder } from '@/lib/orders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Places an order: holds credit, then hands it to the supplier. */
export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  const kind = body.kind === 'device_service' ? 'device_service' : 'carrier_unlock'

  try {
    const payload = await submitOrder(found.user.id, {
      kind,
      brandId: Number(body.brandId),
      carrierId: body.carrierId === undefined ? undefined : Number(body.carrierId),
      serviceId: body.serviceId === undefined ? undefined : Number(body.serviceId),
      imei: String(body.imei ?? ''),
      email: String(body.email ?? ''),
      idempotencyKey: body.idempotencyKey === undefined ? undefined : String(body.idempotencyKey),
    })
    return NextResponse.json(payload)
  } catch (error) {
    if (error instanceof OrderError) {
      const status =
        error.code === 'rate_limited'
          ? 429
          : error.code === 'maintenance' || error.code === 'supplier_unconfigured'
            ? 503
            : 400
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status })
    }
    throw error
  }
}
