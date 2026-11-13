import { feedJsonl } from '@/lib/acp-feed'
import { liveFeedRows } from '@/lib/acp-feed-live'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  return new Response(feedJsonl(liveFeedRows()), { headers: { 'Content-Type': 'application/jsonl; charset=utf-8', 'Cache-Control': 'public, max-age=900', 'X-Robots-Tag': 'noindex' } })
}
