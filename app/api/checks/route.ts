import { NextResponse } from 'next/server'
import { guard } from '@/lib/api'
import { CheckError, submitCheck } from '@/lib/checks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Submits an order: holds credit, then hands it to the provider. */
export async function POST(request: Request) {
  const guarded = await guard(request)
  if ('error' in guarded) return guarded.error
  const { found, body } = guarded

  const serviceId = Number(body.serviceId)
  const identifier = String(body.identifier ?? '')
  if (!Number.isInteger(serviceId)) {
    return NextResponse.json({ success: false, error: 'Pick a service.' }, { status: 400 })
  }

  try {
    return NextResponse.json(await submitCheck(found.user.id, serviceId, identifier))
  } catch (error) {
    if (error instanceof CheckError) {
      return NextResponse.json({ success: false, error: error.message, code: error.code }, { status: 400 })
    }
    throw error
  }
}
