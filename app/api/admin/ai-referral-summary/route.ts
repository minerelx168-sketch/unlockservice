import { currentSession, hasAdminRole } from '@/lib/auth'
import { aiReferralSummary, metricsTokenValid, summaryRange } from '@/lib/analytics/ai-referral-summary'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/** AI referral baseline: admin session or `Authorization: Bearer $ADMIN_METRICS_TOKEN`. */
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' }
  if (!metricsTokenValid(request.headers.get('authorization'))) {
    const found = await currentSession()
    if (!found) return Response.json({ error: 'Sign in required.' }, { status: 401, headers })
    if (!hasAdminRole(found.user)) return Response.json({ error: 'Administrator access required.' }, { status: 403, headers })
  }
  const { from, to } = summaryRange(new URL(request.url).searchParams)
  return Response.json(aiReferralSummary(from, to), { headers })
}
