import { liveFeedRows } from '@/lib/acp-feed-live'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  return Response.json(liveFeedRows(), { headers: { 'Cache-Control': 'public, max-age=900', 'X-Robots-Tag': 'noindex' } })
}
