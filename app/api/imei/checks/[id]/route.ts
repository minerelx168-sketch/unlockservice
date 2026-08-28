import { NextResponse } from 'next/server'
import { currentSession } from '@/lib/auth'
import { getImeiCheck } from '@/lib/imei-checks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const found = await currentSession()
  if (!found) return NextResponse.json({ success: false, error: 'Sign in to continue.' }, { status: 401 })

  const { id: idParam } = await context.params
  const id = Number(idParam)
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json({ success: false, error: 'Invalid check id.' }, { status: 400 })
  }

  const check = getImeiCheck(found.user.id, id)
  if (!check) return NextResponse.json({ success: false, error: 'Check not found.' }, { status: 404 })
  return NextResponse.json({ success: true, check })
}
