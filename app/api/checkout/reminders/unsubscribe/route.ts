import { NextResponse } from 'next/server'
import { unsubscribeCheckoutReminders } from '@/lib/checkout-reminders'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_TOKEN_LENGTH = 2048
const responseHeaders = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
}

function tokenFrom(request: Request): string {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  return token.length <= MAX_TOKEN_LENGTH ? token : ''
}

function processToken(request: Request) {
  const token = tokenFrom(request)
  if (!token) return
  try {
    unsubscribeCheckoutReminders(token)
  } catch {
    // Keep capability-token responses generic; retrying remains idempotent.
  }
}

export async function POST(request: Request) {
  // RFC 8058 one-click requests carry the capability token in the action URL;
  // no browser session or user cookie is required.
  processToken(request)
  return new NextResponse('Unsubscribe request received. If the link was valid, payment reminders are now disabled.', {
    status: 200,
    headers: { ...responseHeaders, 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

export async function GET(request: Request) {
  const token = tokenFrom(request)
  const action = token
    ? `/api/checkout/reminders/unsubscribe?token=${encodeURIComponent(token)}`
    : '/api/checkout/reminders/unsubscribe'
  return new NextResponse(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribe payment reminders</title></head>
<body style="font-family:system-ui,sans-serif;max-width:38rem;margin:3rem auto;padding:0 1rem;line-height:1.5;color:#17212b">
  <h1>Unsubscribe payment reminders</h1>
  <p>Confirm below to stop payment reminder emails. Transactional receipts and service updates are not affected.</p>
  <form method="post" action="${action}"><button type="submit">Unsubscribe</button></form>
</body>
</html>`, {
    status: 200,
    headers: { ...responseHeaders, 'Content-Type': 'text/html; charset=utf-8' },
  })
}
