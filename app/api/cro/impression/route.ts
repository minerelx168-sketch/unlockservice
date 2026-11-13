import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { CRO_COOKIE, envOverrides, isExperimentId, isForced, validVisitorId, variantFor } from '@/lib/cro/experiments'
import { recordExposure } from '@/lib/cro/store'
import { publicOrigin } from '@/lib/site'
import { consumeAttempt } from '@/lib/rate-limit'
import { createHash } from 'node:crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Records that a visitor saw an experiment. The variant is recomputed from the
 * httpOnly cookie rather than trusted from the body, so a client cannot write
 * itself into the other arm.
 */
export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' }
  if (request.headers.get('origin') !== publicOrigin() || request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ ok: false }, { status: 403, headers })
  if (Number(request.headers.get('content-length')) > 512) return NextResponse.json({ ok: false }, { status: 413, headers })
  const ip = request.headers.get('x-real-ip') || 'unknown'
  if (!consumeAttempt('cro-impression-ip', createHash('sha256').update(ip).digest('hex'), 120, 3600)) return NextResponse.json({ ok: false }, { status: 429, headers })
  let body: unknown
  try { body = await request.json() } catch { return NextResponse.json({ ok: false }, { status: 400, headers }) }
  const experiment = (body as { experiment?: unknown } | null)?.experiment
  const visitor = validVisitorId((await cookies()).get(CRO_COOKIE)?.value)
  const overrides = envOverrides()
  if (!isExperimentId(experiment) || !visitor) return NextResponse.json({ ok: false }, { status: 400, headers })
  if (isForced(experiment, overrides)) return NextResponse.json({ ok: true, recorded: false }, { headers })
  const variant = variantFor(visitor, experiment, overrides)
  try { return NextResponse.json({ ok: true, recorded: recordExposure(visitor, experiment, variant), variant }, { headers }) }
  catch { return NextResponse.json({ ok: false }, { status: 503, headers }) }
}
