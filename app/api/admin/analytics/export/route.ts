import { currentSession, hasAdminRole } from '@/lib/auth'
import { AnalyticsError, analyticsCsv, parseAnalyticsFilters } from '@/lib/admin-analytics'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' }
  const found = await currentSession()
  if (!found) return Response.json({ error: 'Sign in required.' }, { status: 401, headers })
  if (!hasAdminRole(found.user)) return Response.json({ error: 'Administrator access required.' }, { status: 403, headers })
  try {
    const filters = parseAnalyticsFilters(Object.fromEntries(new URL(request.url).searchParams))
    return new Response(analyticsCsv(filters), { headers: { ...headers,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="iunlockmobile-${filters.view}-${filters.from}-${filters.to}.csv"`,
    } })
  } catch (error) {
    if (error instanceof AnalyticsError) return Response.json({ error: error.message }, { status: 400, headers })
    throw error
  }
}
