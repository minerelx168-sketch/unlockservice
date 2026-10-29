import { after } from 'next/server'
import { processPaidGuestCheckouts } from '@/lib/guest-checkout'
import { enqueueWhopEvent, processWhopEvents, WhopPaymentError } from '@/lib/whop'
import { deliverPaymentAnalytics } from '@/lib/payment-analytics'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Read the signed bytes with both a streaming size limit and a deadline.
async function rawBody(request: Request): Promise<string> {
  const max = 256 * 1024
  if (Number(request.headers.get('content-length')) > max || !request.body) throw new Error('Invalid body')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let length = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Timeout')), 3000) })
  try {
    while (true) {
      const { value, done } = await Promise.race([reader.read(), deadline])
      if (done) break
      length += value.byteLength
      if (length > max) throw new Error('Body too large')
      chunks.push(value)
    }
    return Buffer.concat(chunks, length).toString('utf8')
  } catch (error) {
    void reader.cancel().catch(() => {})
    throw error
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
}

export async function POST(request: Request) {
  let raw: string
  try { raw = await rawBody(request) } catch { return new Response('Invalid request', { status: 400 }) }
  try {
    const status = enqueueWhopEvent(raw, Object.fromEntries(request.headers))
    // The inbox is committed before 200. The existing worker retries if this
    // process stops after responding. Redirects never trigger fulfillment.
    if (status !== 'ignored') after(async () => {
      await processWhopEvents(3); await processPaidGuestCheckouts(5)
      // payment_completed goes out right after the verified webhook; the poll timer is the fallback.
      await deliverPaymentAnalytics(5).catch(() => undefined)
    })
    return Response.json({ received: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    return new Response('Webhook could not be accepted', { status: error instanceof WhopPaymentError && error.status === 503 ? 503 : 400 })
  }
}

