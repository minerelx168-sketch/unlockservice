/** Server-only draft adapter. Never import into a client component.
 * Uses the SAME production mail settings as lib/account-security.ts.
 * Not connected to any route/worker; sending is disabled by default.
 */
import type { MarketingEmailSender } from './checkout-marketing-reminder'

export type CheckoutMarketingMail = {
  to: string
  subject: string
  html: string
  text: string
  headers: { 'List-Unsubscribe': string; 'List-Unsubscribe-Post': string }
}

export type CheckoutMarketingResendResult =
  | { status: 'accepted'; providerMessageId: string }
  | { status: 'not_accepted'; retryable: boolean; reason: 'disabled' | 'configuration' | 'input' | 'rejected'; httpStatus?: number }
  | { status: 'ambiguous'; reason: 'network' | 'server_response' | 'missing_receipt'; httpStatus?: number }

export type CheckoutMarketingResendOptions = {
  enabled?: boolean
  /** Tests inject synthetic settings; production defaults to existing server environment. */
  env?: Partial<Pick<NodeJS.ProcessEnv, 'RESEND_API_KEY' | 'IUNLOCKMOBILE_EMAIL_FROM' | 'IUNLOCKMOBILE_EMAIL_REPLY_TO' | 'IUNLOCKMOBILE_PUBLIC_ORIGIN'>>
  fetcher?: typeof fetch
}

function mailbox(value: string): boolean {
  return value.length <= 254 && !/[\r\n]/.test(value) && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value)
}

/** API acceptance is NOT delivery, inbox arrival, open, click or verified payment.
 * Unknown outcomes must be quarantined by the durable campaign store; no blind retry.
 * Only trusted server code should call after consent, lease and payment verification.
 */
export async function sendCheckoutMarketingEmailWithResend(
  mail: CheckoutMarketingMail,
  idempotencyKey: string,
  options: CheckoutMarketingResendOptions = {},
): Promise<CheckoutMarketingResendResult> {
  if (options.enabled !== true) return { status: 'not_accepted', retryable: false, reason: 'disabled' }
  const env = options.env ?? process.env
  const key = env.RESEND_API_KEY?.trim()
  const from = env.IUNLOCKMOBILE_EMAIL_FROM?.trim()
  const replyTo = env.IUNLOCKMOBILE_EMAIL_REPLY_TO?.trim()
  if (!key || !from || /[\r\n]/.test(from) || (replyTo && !mailbox(replyTo))) {
    return { status: 'not_accepted', retryable: false, reason: 'configuration' }
  }
  let unsubscribe: URL
  try {
    const origin = new URL(env.IUNLOCKMOBILE_PUBLIC_ORIGIN ?? '')
    const value = mail.headers['List-Unsubscribe']
    if (!/^<https:\/\/[^<>\r\n]+>$/.test(value)) throw new Error('invalid header')
    unsubscribe = new URL(value.slice(1, -1))
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.port
      || unsubscribe.origin !== origin.origin || unsubscribe.username || unsubscribe.password
      || unsubscribe.hash || unsubscribe.pathname === '/'
      || mail.headers['List-Unsubscribe-Post'] !== 'List-Unsubscribe=One-Click') throw new Error('invalid unsubscribe')
  } catch {
    return { status: 'not_accepted', retryable: false, reason: 'input' }
  }
  if (!mailbox(mail.to) || !mail.subject.trim() || /[\r\n]/.test(mail.subject)
    || !mail.html.trim() || !mail.text.trim() || !mail.text.includes(unsubscribe.href)
    || !/^[A-Za-z0-9/_:.-]{1,256}$/.test(idempotencyKey)) {
    return { status: 'not_accepted', retryable: false, reason: 'input' }
  }
  let response: Response
  try {
    response = await (options.fetcher ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({
        from, to: [mail.to], ...(replyTo ? { reply_to: replyTo } : {}),
        subject: mail.subject, html: mail.html, text: mail.text, headers: mail.headers,
      }),
      cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
    })
  } catch {
    return { status: 'ambiguous', reason: 'network' }
  }
  // Timeouts, idempotency conflicts and server failures may hide an accepted write.
  if (response.status === 408 || response.status === 409 || response.status >= 500) {
    return { status: 'ambiguous', reason: 'server_response', httpStatus: response.status }
  }
  if (!response.ok) {
    return { status: 'not_accepted', retryable: response.status === 429, reason: 'rejected', httpStatus: response.status }
  }
  try {
    const result: unknown = await response.json()
    if (result && typeof result === 'object' && 'id' in result && typeof result.id === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(result.id)) {
      return { status: 'accepted', providerMessageId: result.id }
    }
  } catch { /* Successful write with unreadable receipt: do not resend blindly. */ }
  return { status: 'ambiguous', reason: 'missing_receipt' }
}

/** Injectable port for maybeSendCheckoutMarketingReminder. Creation/import sends nothing.
 * Only the shared server env controls the actual sender and reply-to, not user input.
 */
export function createExistingResendMarketingSender(options: CheckoutMarketingResendOptions = {}): MarketingEmailSender {
  return {
    async sendMarketingEmail(message) {
      const result = await sendCheckoutMarketingEmailWithResend(message, message.idempotencyKey, options)
      if (result.status === 'accepted') return { kind: 'accepted', providerMessageId: result.providerMessageId }
      if (result.status === 'ambiguous') return { kind: 'ambiguous', reason: result.reason }
      return { kind: 'not_accepted', reason: result.reason, retryable: result.retryable }
    },
  }
}
