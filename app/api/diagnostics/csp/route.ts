import { summarizeCspReport } from '@/lib/csp-report'

export const runtime = 'nodejs'
const MAX_BYTES = 16_384
let windowStart = 0
let reports = 0

export async function POST(request: Request) {
  const empty = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })
  const now = Date.now()
  if (now - windowStart >= 60_000) { windowStart = now; reports = 0 }
  // Bounded per-process diagnostics; reports are untrusted and never affect orders or tracking.
  if (++reports > 30) { await request.body?.cancel(); return empty() }
  if (Number(request.headers.get('content-length')) > MAX_BYTES) { await request.body?.cancel(); return empty() }
  const reader = request.body?.getReader()
  if (!reader) return empty()
  let size = 0
  const chunks: Uint8Array[] = []
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_BYTES) { await reader.cancel(); return empty() }
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const summary = summarizeCspReport(JSON.parse(new TextDecoder().decode(bytes)))
    if (summary) console.warn(JSON.stringify({ event: 'browser_csp_report', ...summary }))
  } catch { /* Malformed client reports must not interrupt the application. */ }
  finally { reader.releaseLock() }
  return empty()
}
