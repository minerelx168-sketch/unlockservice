import { handleProviderWebhook } from '@/lib/provider-webhook'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Provider authentication is the raw-body signature, not a browser session/CSRF token.
export async function POST(request: Request) {
  return handleProviderWebhook(request)
}
