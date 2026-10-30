import assert from 'node:assert/strict'
import test from 'node:test'
import { sendCheckoutMarketingEmailWithResend, type CheckoutMarketingMail } from '../lib/checkout-marketing-resend'

const env = {
  RESEND_API_KEY: 'test-only-never-a-real-key',
  IUNLOCKMOBILE_EMAIL_FROM: 'iUnlockMobile <no-reply@example.test>',
  IUNLOCKMOBILE_EMAIL_REPLY_TO: 'support@example.test',
  IUNLOCKMOBILE_PUBLIC_ORIGIN: 'https://checkout.example.test',
}
const unsubscribe = 'https://checkout.example.test/api/marketing/unsubscribe?token=synthetic-test'
const mail: CheckoutMarketingMail = {
  to: 'buyer@example.test', subject: 'Complete your iUnlockMobile checkout',
  html: `<p>Marketing reminder. Test business postal address.</p><a href="${unsubscribe}">Unsubscribe</a>`,
  text: `Marketing reminder. Test business postal address. Unsubscribe: ${unsubscribe}`,
  headers: { 'List-Unsubscribe': `<${unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
}
const key = 'checkout-marketing/test-reference/one-reminder-v1'
const messageId = '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794'

function transport(response: Response | Error, calls: Array<{ url: string; init?: RequestInit }> = []): typeof fetch {
  return async (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url
    calls.push({ url, init })
    if (response instanceof Error) throw response
    return response
  }
}

test('Resend draft is disabled by default, even with existing valid mail settings', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const result = await sendCheckoutMarketingEmailWithResend(mail, key, { env, fetcher: transport(Response.json({ id: messageId }), calls) })
  assert.deepEqual(result, { status: 'not_accepted', retryable: false, reason: 'disabled' })
  assert.equal(calls.length, 0)
})

test('adapter reuses existing Resend key/from/reply-to and sends one recipient with unsubscribe/idempotency', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const result = await sendCheckoutMarketingEmailWithResend(mail, key, { enabled: true, env, fetcher: transport(Response.json({ id: messageId }), calls) })
  assert.deepEqual(result, { status: 'accepted', providerMessageId: messageId })
  assert.equal(calls.length, 1)
  const request = calls[0]
  assert.equal(request.url, 'https://api.resend.com/emails')
  assert.equal(request.init?.method, 'POST')
  const headers = request.init?.headers as Record<string, string>
  assert.equal(headers.Authorization, `Bearer ${env.RESEND_API_KEY}`)
  assert.equal(headers['Idempotency-Key'], key)
  const body = JSON.parse(String(request.init?.body))
  assert.equal(body.from, env.IUNLOCKMOBILE_EMAIL_FROM)
  assert.equal(body.reply_to, env.IUNLOCKMOBILE_EMAIL_REPLY_TO)
  assert.deepEqual(body.to, [mail.to])
  assert.deepEqual(body.headers, mail.headers)
  assert.equal(body.subject, mail.subject)
  assert.equal(body.text, mail.text)
  assert.equal(body.bcc, undefined)
  assert.ok(request.init?.signal)
})

test('missing production mail settings and header injection fail before any API call', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const fetcher = transport(Response.json({ id: messageId }), calls)
  assert.equal((await sendCheckoutMarketingEmailWithResend(mail, key, { enabled: true, env: {}, fetcher })).status, 'not_accepted')
  assert.equal((await sendCheckoutMarketingEmailWithResend(mail, key, { enabled: true, env: { ...env, IUNLOCKMOBILE_EMAIL_FROM: 'x\r\nBcc: other@example.test' }, fetcher })).status, 'not_accepted')
  assert.equal(calls.length, 0)
})

test('invalid recipient, subject, idempotency or off-origin unsubscribe fails before any API call', async () => {
  const calls: Array<{ url: string; init?: RequestInit }> = []
  const options = { enabled: true, env, fetcher: transport(Response.json({ id: messageId }), calls) }
  for (const input of [
    { ...mail, to: 'x\nother@example.test' },
    { ...mail, subject: 'hello\r\nBcc: another@example.test' },
    { ...mail, headers: { ...mail.headers, 'List-Unsubscribe': '<https://attacker.example/unsubscribe?token=x>' } },
    { ...mail, headers: { ...mail.headers, 'List-Unsubscribe-Post': 'not-one-click' } },
    { ...mail, text: 'Missing visible opt-out URL' },
  ]) assert.equal((await sendCheckoutMarketingEmailWithResend(input, key, options)).status, 'not_accepted')
  assert.equal((await sendCheckoutMarketingEmailWithResend(mail, 'invalid\r\nkey', options)).status, 'not_accepted')
  assert.equal(calls.length, 0)
})

test('explicit rate-limit rejection is retryable; validation rejection is not', async () => {
  const rate = await sendCheckoutMarketingEmailWithResend(mail, key, { enabled: true, env, fetcher: transport(new Response(null, { status: 429 })) })
  assert.deepEqual(rate, { status: 'not_accepted', retryable: true, reason: 'rejected', httpStatus: 429 })
  const invalid = await sendCheckoutMarketingEmailWithResend(mail, key, { enabled: true, env, fetcher: transport(new Response(null, { status: 400 })) })
  assert.deepEqual(invalid, { status: 'not_accepted', retryable: false, reason: 'rejected', httpStatus: 400 })
})

test('network/408/409/5xx/accepted-write missing receipt are ambiguous, never blind-retry results', async () => {
  const responseCases = [new Error('simulated network timeout'), new Response(null, { status: 408 }), new Response(null, { status: 409 }), new Response(null, { status: 503 }), Response.json({}), new Response('unreadable', { status: 200 })]
  for (const response of responseCases) {
    const result = await sendCheckoutMarketingEmailWithResend(mail, key, { enabled: true, env, fetcher: transport(response) })
    assert.equal(result.status, 'ambiguous')
    assert.equal('retryable' in result, false)
  }
})
