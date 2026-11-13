import { feedCsv } from '@/lib/acp-feed'
import { liveFeedRows } from '@/lib/acp-feed-live'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET() {
  return new Response(feedCsv(liveFeedRows()), { headers: {
    'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'inline; filename="openai-products.csv"',
    'Cache-Control': 'public, max-age=900', 'X-Robots-Tag': 'noindex' } })
}
