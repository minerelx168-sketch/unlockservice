import { readFile } from 'node:fs/promises'
import path from 'node:path'

// Build the download from the maintained guide so the two cannot drift apart.
export const dynamic = 'force-static'
export const runtime = 'nodejs'

export async function GET() {
  const guide = await readFile(path.join(process.cwd(), 'docs/reseller-api.md'), 'utf8')
  return new Response(guide, {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': 'attachment; filename="iunlockmobile-reseller-api.md"',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
