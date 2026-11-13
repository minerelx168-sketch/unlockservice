import { timingSafeEqual } from 'node:crypto'
import { currentSession, hasAdminRole } from '@/lib/auth'
import { EXPERIMENTS, envOverrides } from '@/lib/cro/experiments'
import { croReport } from '@/lib/cro/store'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Bearer ADMIN_METRICS_TOKEN (at least 24 characters) or a signed-in administrator. */
function tokenAllowed(request: Request): boolean {
  const expected = process.env.ADMIN_METRICS_TOKEN?.trim() ?? ''
  if (expected.length < 24) return false
  const supplied = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() ?? ''
  const a = Buffer.from(supplied), b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  if (!tokenAllowed(request)) {
    const found = await currentSession()
    if (!found) return Response.json({ error: 'Sign in required.' }, { status: 401, headers })
    if (!hasAdminRole(found.user)) return Response.json({ error: 'Administrator access required.' }, { status: 403, headers })
  }
  const since = new URL(request.url).searchParams.get('since') ?? undefined
  const overrides = envOverrides()
  const experiments = croReport(since).map((row) => ({ ...row, description: EXPERIMENTS[row.experiment_id], forced: overrides[row.experiment_id] ?? null }))
  return Response.json({ generated_at: new Date().toISOString(), since: since ?? null, confidence: 0.95,
    definitions: {
      exposures: 'Distinct visitors (30-day ium_cro_v1 cookie) who saw the experiment surface.',
      begin_checkout: 'Exposed visitors who opened a guest card or crypto checkout under the same variant.',
      verified_purchases: 'Exposed visitors with at least one checkout settled by the verified payment path and not refunded.',
      gross_profit_usd: 'Service price minus supplier cost from catalog/service-margins.json, excluding card fees.',
    }, experiments }, { headers })
}
