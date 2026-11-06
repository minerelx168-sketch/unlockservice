import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'

const workDir = mkdtempSync(join(tmpdir(), 'checkout-reminders-safe-'))
Object.assign(process.env, {
  IUNLOCKMOBILE_DB: join(workDir, 'reminders.db'),
  IUNLOCKMOBILE_CHECKOUT_REMINDERS_ENABLED: '1',
  IUNLOCKMOBILE_CHECKOUT_REMINDERS_SECRET: 'reminder-test-secret-that-is-at-least-32-chars',
  IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS: 'iUnlockMobile, 1 Test Street, Test City',
  IUNLOCKMOBILE_PUBLIC_ORIGIN: 'https://iunlockmobile.com',
  RESEND_API_KEY: 'test-only',
  IUNLOCKMOBILE_EMAIL_FROM: 'iUnlockMobile <no-reply@example.test>',
  IUNLOCKMOBILE_WHOP_ENABLED: '1',
  WHOP_MODE: 'live',
  WHOP_ACCOUNT_ID: 'biz_test',
  WHOP_PRODUCT_ID: 'prod_test',
  WHOP_API_KEY: 'whop-test-only',
  WHOP_WEBHOOK_SECRET: 'whop-secret-test-only',
})

type MailRequest = {
  body: Record<string, unknown>
  headers: Headers
  redirect: RequestRedirect | undefined
}
type GatewayPage = { data: Array<Record<string, unknown>>; endCursor: string | null }
type ResendResponse = Response | (() => Response | Promise<Response>)

type CustomerOptions = {
  accountType?: string
  status?: string
  verified?: boolean
  banned?: boolean
}

let database: typeof import('../lib/db')
let reminders: typeof import('../lib/checkout-reminders')
let accountSecurity: typeof import('../lib/account-security')
let encryptPaidReportImei: typeof import('../lib/paid-report-imei').encryptPaidReportImei
const originalFetch = globalThis.fetch
const mailRequests: MailRequest[] = []
let resendResponses: ResendResponse[] = []
let resendFailure = false
let gatewayFailure = false
let gatewayPages: GatewayPage[] = [{ data: [], endCursor: null }]
let gatewayPause: { started: () => void; release: Promise<void> } | null = null
let gatewayStarted: Promise<void> | null = null
let userCounter = 0
let referenceCounter = 0

function page(data: Array<Record<string, unknown>>, endCursor: string | null = null): GatewayPage {
  return { data, endCursor }
}

function providerPageResponse(result: GatewayPage): Response {
  return Response.json({
    data: result.data,
    page_info: {
      end_cursor: result.endCursor,
      has_next_page: result.endCursor !== null,
      has_previous_page: false,
      start_cursor: null,
    },
  })
}

function checkoutConfiguration(checkoutId: string): Record<string, unknown> {
  const topup = database.db().prepare(`SELECT i.reference,i.credit_amount_cents,i.fee_cents,w.account_id,w.product_id,w.environment,
      w.checkout_id,w.plan_id,w.checkout_url
    FROM whop_topups w JOIN invoices i ON i.reference=w.invoice_reference WHERE w.checkout_id=?`).get(checkoutId) as {
      reference: string; credit_amount_cents: number; fee_cents: number; account_id: string; product_id: string; environment: string
      checkout_id: string; plan_id: string; checkout_url: string
    } | undefined
  if (topup) {
    return {
      id: topup.checkout_id,
      account_id: topup.account_id,
      mode: 'payment',
      metadata: { integration: 'iunlockmobile-credit-v1', invoice_reference: topup.reference },
      purchase_url: topup.checkout_url,
      plan: {
        id: topup.plan_id,
        initial_price: (topup.credit_amount_cents + topup.fee_cents) / 100,
        plan_type: 'one_time',
        currency: 'usd',
        renewal_price: 0,
        visibility: 'hidden',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
  }

  const guest = database.db().prepare(`SELECT reference,price_cents,fee_cents,wallet_credit_cents,card_order_price_cents,
      account_id,product_id,environment,checkout_id,plan_id,checkout_url FROM guest_checkouts WHERE checkout_id=?`).get(checkoutId) as {
      reference: string; price_cents: number; fee_cents: number; wallet_credit_cents: number; card_order_price_cents: number | null
      account_id: string; product_id: string; environment: string; checkout_id: string; plan_id: string; checkout_url: string
    } | undefined
  if (!guest) throw new Error(`No synthetic checkout for ${checkoutId}`)
  const amount = guest.card_order_price_cents ?? (guest.price_cents + guest.fee_cents)
  return {
    id: guest.checkout_id,
    account_id: guest.account_id,
    mode: 'payment',
    metadata: { integration: 'iunlockmobile-guest-v1', guest_reference: guest.reference },
    purchase_url: guest.checkout_url,
    plan: {
      id: guest.plan_id,
      initial_price: amount / 100,
      plan_type: 'one_time',
      currency: 'usd',
      renewal_price: 0,
      visibility: 'hidden',
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

before(async () => {
  database = await import('../lib/db')
  reminders = await import('../lib/checkout-reminders')
  accountSecurity = await import('../lib/account-security')
  encryptPaidReportImei = (await import('../lib/paid-report-imei')).encryptPaidReportImei
  database.db().prepare("UPDATE checkout_reminder_settings SET value=? WHERE key='migration_cutover_at_ms'")
    .run(String(Date.now() - 24 * 60 * 60_000))

  globalThis.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    const headers = new Headers(init?.headers)

    if (url.hostname === 'api.resend.com') {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>
      mailRequests.push({ body, headers, redirect: init?.redirect })
      if (resendFailure) throw new Error('resend transport unavailable')
      const response = resendResponses.shift()
      if (response) return typeof response === 'function' ? response() : response
      return Response.json({ id: `re_test_${mailRequests.length}` })
    }

    assert.equal(url.hostname, 'api.whop.com')
    assert.equal(init?.method, 'GET')
    if (url.pathname.includes('checkout_configurations')) {
      return Response.json(checkoutConfiguration(url.pathname.split('/').at(-1)!))
    }
    assert.match(url.pathname, /\/payments$/)
    if (gatewayFailure) throw new Error('provider unavailable')
    if (gatewayPause) {
      const current = gatewayPause
      gatewayPause = null
      current.started()
      await current.release
    }
    const after = url.searchParams.get('after')
    const pageNumber = after ? Math.max(1, Number(after.replace('cursor-', '')) || 1) : 0
    return providerPageResponse(gatewayPages[Math.min(pageNumber, gatewayPages.length - 1)] ?? page([], null))
  }
})

after(() => {
  globalThis.fetch = originalFetch
  database.db().close()
  rmSync(workDir, { recursive: true, force: true })
})

function customer(email?: string, options: CustomerOptions = {}): { id: number; email: string } {
  const number = ++userCounter
  const address = email ?? `reminder${number}@example.test`
  const verified = options.verified !== false
  const id = Number(database.db().prepare(`INSERT INTO users(username,email,password_hash,account_type,status,email_verified_at,banned_at)
    VALUES(?,?,?,?,?,?,?)`).run(
    `reminder-user-${number}`,
    address,
    'test-only',
    options.accountType ?? 'customer',
    options.status ?? 'active',
    verified ? new Date().toISOString() : null,
    options.banned ? new Date().toISOString() : null,
  ).lastInsertRowid)
  return { id, email: address }
}

function reference(): string { return (++referenceCounter).toString(16).padStart(32, '0') }

function cardTopup(userId: number, createdAt = "datetime('now','-6 minutes')"): string {
  const ref = reference()
  database.db().prepare(`INSERT INTO invoices(reference,user_id,gateway,credit_amount_cents,fee_cents,total_due_cents,status,created_at)
    VALUES(?,?,'whop_card',1000,50,1050,'pending',${createdAt})`).run(ref, userId)
  database.db().prepare(`INSERT INTO whop_topups(invoice_reference,user_id,request_key,account_id,product_id,environment,checkout_id,plan_id,checkout_url)
    VALUES(?,?,?,'biz_test','prod_test','live',?,?,?)`).run(
    ref,
    userId,
    ref,
    `ch_${ref}`,
    `plan_${ref}`,
    `https://whop.com/checkout/plan_${ref}/`,
  )
  return ref
}

function cryptoTopup(userId: number, createdAt = "datetime('now','-6 minutes')"): string {
  const ref = reference()
  database.db().prepare(`INSERT INTO invoices(reference,user_id,gateway,credit_amount_cents,fee_cents,total_due_cents,status,payment_route_id,payment_amount_e4,created_at)
    VALUES(?,?,'bsc-usdt-peg',1000,50,1050,'pending','bsc-usdt-peg',105007,${createdAt})`).run(ref, userId)
  return ref
}

function guestCryptoCheckout(ownerId: number, ownerEmail: string, createdAt = "datetime('now','-6 minutes')"): { reference: string; invoiceReference: string } {
  const checkoutReference = reference()
  const invoiceReference = reference()
  const guestUserId = Number(database.db().prepare(`INSERT INTO users(username,email,password_hash,account_type,status)
    VALUES(?,?,'!guest-no-login','guest','guest')`).run(`guest-${checkoutReference}`, `${checkoutReference}@guest.invalid`).lastInsertRowid)
  database.db().prepare(`INSERT INTO invoices(reference,user_id,gateway,credit_amount_cents,fee_cents,total_due_cents,status,payment_route_id,payment_amount_e4,created_at)
    VALUES(?,?,'bsc-usdt-peg',1000,0,1000,'pending','bsc-usdt-peg',100001,${createdAt})`).run(invoiceReference, guestUserId)
  database.db().prepare(`INSERT INTO guest_checkouts(reference,request_key,email,product_code,product_name,imei_encrypted,price_cents,fee_cents,
    account_id,product_id,environment,payment_method,crypto_invoice_reference,user_id,customer_user_id)
    VALUES(?,?,?,?,?,?,1000,0,'crypto','bsc-usdt-peg','live','crypto',?,?,?)`).run(
    checkoutReference,
    `${checkoutReference}-request`,
    ownerEmail,
    'APPLE_CARRIER_LITE',
    'Apple Carrier Lite',
    encryptPaidReportImei('490154203237518'),
    invoiceReference,
    guestUserId,
    ownerId,
  )
  return { reference: checkoutReference, invoiceReference }
}

function enableReadonlyCryptoWatcher(): void {
  process.env.IUNLOCKMOBILE_PAYMENT_WATCHER = '1'
  process.env.IUNLOCKMOBILE_TOPUP_ENABLED = '1'
  process.env.IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED = '1'
  process.env.IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS = '0x1111111111111111111111111111111111111111'
}

function seedFreshWatcherCursor(routeId = 'bsc-usdt-peg'): void {
  const now = new Date().toISOString()
  database.db().prepare(`INSERT INTO payment_watch_cursors(route_id,last_block,last_time_ms,last_scan_at,last_ok_at,last_error,lease_until)
    VALUES(?,100,?,?,?,NULL,NULL)
    ON CONFLICT(route_id) DO UPDATE SET last_block=excluded.last_block,last_time_ms=excluded.last_time_ms,
      last_scan_at=excluded.last_scan_at,last_ok_at=excluded.last_ok_at,last_error=NULL,lease_until=NULL`).run(routeId, Date.now(), now, now)
}

function clearCryptoWatcherEnv(): void {
  delete process.env.IUNLOCKMOBILE_PAYMENT_WATCHER
  delete process.env.IUNLOCKMOBILE_TOPUP_ENABLED
  delete process.env.IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED
  delete process.env.IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS
}

function enroll(referenceValue: string, userId: number, email: string): void {
  assert.equal(reminders.requestCheckoutReminderOptIn('topup', referenceValue, email, userId), true)
  assert.equal(reminders.recordCheckoutReminderOpened('topup', referenceValue, userId, 'test_payment_open'), true)
  // Due-sender cases intentionally fast-forward the persisted five-minute delay;
  // the production open endpoint never does this.
  database.db().prepare("UPDATE checkout_payment_reminders SET due_at=0,next_attempt_at=0 WHERE kind='topup' AND reference=?").run(referenceValue)
}

function reminderRow(ref: string, kind: 'guest' | 'topup' = 'topup'): Record<string, unknown> | undefined {
  return database.db().prepare('SELECT * FROM checkout_payment_reminders WHERE kind=? AND reference=?').get(kind, ref) as Record<string, unknown> | undefined
}

function resetQueue(): void {
  if (gatewayPause) {
    gatewayPause.release.then(() => undefined)
  }
  gatewayPause = null
  gatewayStarted = null
  database.db().exec('DELETE FROM checkout_payment_reminders; DELETE FROM checkout_reminder_suppressions;')
  mailRequests.length = 0
  resendResponses = []
  resendFailure = false
  gatewayFailure = false
  gatewayPages = [page([], null)]
  process.env.IUNLOCKMOBILE_CHECKOUT_REMINDERS_ENABLED = '1'
  process.env.IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS = 'iUnlockMobile, 1 Test Street, Test City'
}

function matchingPayment(ref: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const row = database.db().prepare(`SELECT account_id,product_id,checkout_id,plan_id FROM whop_topups WHERE invoice_reference=?`).get(ref) as {
    account_id: string; product_id: string; checkout_id: string; plan_id: string
  }
  return {
    id: `pay_${ref}`,
    account_id: row.account_id,
    product_id: row.product_id,
    plan_id: row.plan_id,
    checkout_configuration_id: row.checkout_id,
    status: 'paid',
    substatus: 'succeeded',
    metadata: { integration: 'iunlockmobile-credit-v1', invoice_reference: ref },
    ...overrides,
  }
}

let gatewayRelease: (() => void) | null = null

function releaseGatewayList(): void {
  gatewayRelease?.()
  gatewayRelease = null
}

function pauseGatewayList(): Promise<void> {
  let started!: () => void
  let release!: () => void
  gatewayStarted = new Promise<void>(resolve => { started = resolve })
  const releasePromise = new Promise<void>(resolve => { release = resolve })
  gatewayRelease = release
  gatewayPause = { started, release: releasePromise }
  return gatewayStarted
}

test('marketing Resend headers are JSON payload fields and accepted receipts are returned', async () => {
  resetQueue()
  const resultPromise = accountSecurity.sendMarketingEmail(
    'buyer@example.test',
    'Reminder',
    '<p>body</p>',
    'body',
    { idempotencyKey: 'checkout-reminder/topup/test', unsubscribeUrl: 'https://iunlockmobile.com/unsubscribe?token=test', replyTo: 'support@iunlockmobile.com' },
  )
  const result = await resultPromise
  assert.deepEqual(result, { providerMessageId: 're_test_1' })
  assert.equal(mailRequests.length, 1)
  const request = mailRequests[0]
  assert.equal(request.headers.get('Authorization'), 'Bearer test-only')
  assert.equal(request.headers.get('Content-Type'), 'application/json')
  assert.equal(request.headers.get('Idempotency-Key'), 'checkout-reminder/topup/test')
  assert.equal(request.body.reply_to, 'support@iunlockmobile.com')
  assert.equal(request.headers.has('List-Unsubscribe'), false)
  assert.equal(request.headers.has('List-Unsubscribe-Post'), false)
  assert.equal(request.redirect, 'error')
  assert.deepEqual(request.body.headers, {
    'List-Unsubscribe': '<https://iunlockmobile.com/unsubscribe?token=test>',
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  })
})

test('marketing non-acceptance is classified without parsing provider error bodies', async () => {
  for (const [status, uncertain] of [[408, true], [409, true], [429, false], [500, true], [503, true]] as const) {
    resetQueue()
    resendResponses.push(Response.json({ recipient: 'must-not-be-logged' }, { status }))
    await assert.rejects(
      accountSecurity.sendMarketingEmail('buyer@example.test', 'Reminder', '<p>x</p>', 'x', {
        idempotencyKey: `test-${status}`,
        unsubscribeUrl: 'https://iunlockmobile.com/unsubscribe?token=test',
      }),
      error => {
        assert.ok(error instanceof accountSecurity.MarketingEmailError)
        assert.equal(error.status, status)
        assert.equal(error.uncertain, uncertain)
        return true
      },
    )
  }
})

test('disabled flag or missing postal address refuses configuration and enrollment', () => {
  resetQueue()
  const owner = customer(), ref = cardTopup(owner.id)
  process.env.IUNLOCKMOBILE_CHECKOUT_REMINDERS_ENABLED = '0'
  assert.equal(reminders.checkoutReminderConfigured(), false)
  assert.equal(reminders.requestCheckoutReminderOptIn('topup', ref, owner.email, owner.id), false)
  process.env.IUNLOCKMOBILE_CHECKOUT_REMINDERS_ENABLED = '1'
  const postal = process.env.IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS
  delete process.env.IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS
  assert.equal(reminders.checkoutReminderConfigured(), false)
  process.env.IUNLOCKMOBILE_MARKETING_POSTAL_ADDRESS = postal
})

test('consent is explicit, owner-scoped, verified, active, and starts after five minutes', async () => {
  resetQueue()
  const recent = customer(), recentRef = cardTopup(recent.id, "datetime('now','-4 minutes')")
  assert.equal(reminders.requestCheckoutReminderOptIn('topup', recentRef, recent.email, recent.id), true)
  assert.equal((await reminders.sendCheckoutReminders(Date.now())).sent, 0)
  assert.equal(mailRequests.length, 0)

  assert.equal(reminders.recordCheckoutReminderOpened('topup', recentRef, recent.id, 'test_payment_open'), true)
  const opened = reminderRow(recentRef) as { opened_at_ms: number; due_at: number; destination_url: string; amount_cents: number }
  assert.ok(opened.opened_at_ms > 0)
  assert.match(opened.destination_url, /^https:\/\/whop\.com\/checkout\//)
  assert.equal(opened.amount_cents, 1050)
  const openedAt = opened.opened_at_ms
  const dueAt = opened.due_at
  assert.equal(reminders.recordCheckoutReminderOpened('topup', recentRef, recent.id, 'test_retry_open'), true)
  const reopened = reminderRow(recentRef) as { opened_at_ms: number; due_at: number; destination_url: string }
  assert.equal(reopened.opened_at_ms, openedAt)
  assert.equal(reopened.due_at, dueAt)
  assert.equal(reopened.destination_url, opened.destination_url)
  assert.equal((await reminders.sendCheckoutReminders(Date.now() + 4 * 60_000 + 59_000)).sent, 0)
  gatewayPages = [page([])]
  database.db().prepare('UPDATE checkout_payment_reminders SET due_at=0,next_attempt_at=0 WHERE reference=?').run(recentRef)
  assert.equal((await reminders.sendCheckoutReminders()).sent, 1)

  for (const options of [
    { accountType: 'admin' },
    { verified: false },
    { status: 'inactive' },
    { banned: true },
  ] satisfies CustomerOptions[]) {
    const owner = customer(undefined, options), ref = cardTopup(owner.id)
    assert.equal(reminders.requestCheckoutReminderOptIn('topup', ref, owner.email, owner.id), false)
  }
})

test('expired and locally paid, review, or in-progress bills cannot enroll', () => {
  resetQueue()
  const expired = customer(), expiredRef = cardTopup(expired.id, "datetime('now','-24 hours')")
  assert.equal(reminders.requestCheckoutReminderOptIn('topup', expiredRef, expired.email, expired.id), false)

  const paid = customer(), paidRef = cardTopup(paid.id)
  database.db().prepare("UPDATE invoices SET status='success',payment_reference='pay_local',paid_at=datetime('now') WHERE reference=?").run(paidRef)
  assert.equal(reminders.requestCheckoutReminderOptIn('topup', paidRef, paid.email, paid.id), false)

  const reviewed = customer(), reviewedRef = cardTopup(reviewed.id)
  database.db().prepare("UPDATE whop_topups SET review_reason='manual_review' WHERE invoice_reference=?").run(reviewedRef)
  assert.equal(reminders.requestCheckoutReminderOptIn('topup', reviewedRef, reviewed.email, reviewed.id), false)

  const inProgress = customer(), inProgressRef = cardTopup(inProgress.id)
  database.db().prepare("UPDATE invoices SET status='processing' WHERE reference=?").run(inProgressRef)
  assert.equal(reminders.requestCheckoutReminderOptIn('topup', inProgressRef, inProgress.email, inProgress.id), false)
})

test('unsubscribe suppresses the queue and concurrent workers send at most one reminder', async () => {
  resetQueue()
  const owner = customer(), ref = cardTopup(owner.id)
  enroll(ref, owner.id, owner.email)
  const token = reminders.checkoutReminderUnsubscribeToken(owner.email)
  assert.equal(token.includes(owner.email), false)
  assert.equal(reminders.unsubscribeCheckoutReminders(token), true)
  assert.equal((reminderRow(ref) as { suppressed: number }).suppressed, 1)
  assert.equal((await reminders.sendCheckoutReminders()).sent, 0)

  resetQueue()
  const ref2 = cardTopup(owner.id)
  enroll(ref2, owner.id, owner.email)
  const [first, second] = await Promise.all([reminders.sendCheckoutReminders(), reminders.sendCheckoutReminders()])
  assert.equal(first.sent + second.sent, 1)
  assert.equal(mailRequests.length, 1)
  assert.equal(mailRequests[0].body.headers && typeof mailRequests[0].body.headers, 'object')
  assert.equal((mailRequests[0].body.headers as Record<string, string>)['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
  assert.match(String((mailRequests[0].body.headers as Record<string, string>)['List-Unsubscribe']), /^<https:\/\//)
  assert.equal(mailRequests[0].headers.has('List-Unsubscribe'), false)
  assert.equal(mailRequests[0].headers.has('List-Unsubscribe-Post'), false)
  assert.equal((reminderRow(ref2) as { send_accepted_at: string | null }).send_accepted_at !== null, true)
  assert.equal((reminderRow(ref2) as { send_provider_id: string }).send_provider_id, 're_test_1')
  assert.equal((reminderRow(ref2) as { idempotency_key: string }).idempotency_key, `checkout-reminder/topup/${ref2}`)
  assert.match(String(mailRequests[0].body.subject), /^Your iUnlockMobile payment is waiting$/)
  assert.match(String(mailRequests[0].body.text), /https:\/\/whop\.com\/checkout\/plan_/)
  assert.equal((reminderRow(ref2) as { destination_url: string }).destination_url, `https://whop.com/checkout/plan_${ref2}/`)
})

test('a matching gateway payment suppresses, while a mismatched scoped record fails closed', async () => {
  resetQueue()
  const paidOwner = customer(), paidRef = cardTopup(paidOwner.id)
  enroll(paidRef, paidOwner.id, paidOwner.email)
  gatewayPages = [page([matchingPayment(paidRef)])]
  const paidResult = await reminders.sendCheckoutReminders()
  assert.equal(paidResult.sent, 0)
  assert.equal(paidResult.skipped, 1)
  assert.equal((reminderRow(paidRef) as { suppressed: number }).suppressed, 1)
  assert.equal(mailRequests.length, 0)

  resetQueue()
  const foreignOwner = customer(), foreignRef = cardTopup(foreignOwner.id)
  enroll(foreignRef, foreignOwner.id, foreignOwner.email)
  gatewayPages = [page([matchingPayment(foreignRef, { account_id: 'biz_foreign' })])]
  const foreignResult = await reminders.sendCheckoutReminders()
  assert.equal(foreignResult.sent, 0)
  assert.equal(foreignResult.unresolved, 1)
  assert.equal((reminderRow(foreignRef) as { unresolved: number }).unresolved, 1)
  assert.equal(mailRequests.length, 0)
})

test('an empty gateway list permits one accepted reminder and persists the provider receipt', async () => {
  resetQueue()
  const owner = customer(), ref = cardTopup(owner.id)
  enroll(ref, owner.id, owner.email)
  gatewayPages = [page([])]
  const result = await reminders.sendCheckoutReminders()
  assert.equal(result.sent, 1)
  assert.equal((reminderRow(ref) as { send_provider_id: string }).send_provider_id, 're_test_1')
  assert.equal(mailRequests.length, 1)
})

test('provider pagination is capped and provider timeout quarantines without sending', async () => {
  resetQueue()
  const owner = customer(), ref = cardTopup(owner.id)
  enroll(ref, owner.id, owner.email)
  gatewayPages = [page([], 'cursor-1'), page([], 'cursor-2'), page([], 'cursor-3'), page([], null)]
  const capped = await reminders.sendCheckoutReminders()
  assert.equal(capped.sent, 0)
  assert.equal(capped.unresolved, 1)
  assert.equal(mailRequests.length, 0)

  resetQueue()
  const timeoutOwner = customer(), timeoutRef = cardTopup(timeoutOwner.id)
  enroll(timeoutRef, timeoutOwner.id, timeoutOwner.email)
  gatewayFailure = true
  const timedOut = await reminders.sendCheckoutReminders()
  assert.equal(timedOut.sent, 0)
  assert.equal(timedOut.unresolved, 1)
  assert.equal((reminderRow(timeoutRef) as { unresolved: number }).unresolved, 1)
  assert.equal(mailRequests.length, 0)
})

test('owner, unsubscribe, and local payment changes during gateway fetch prevent sending', async () => {
  resetQueue()
  const demoted = customer(), demotedRef = cardTopup(demoted.id)
  enroll(demotedRef, demoted.id, demoted.email)
  gatewayPages = [page([])]
  const demotionStarted = pauseGatewayList()
  const demotionRun = reminders.sendCheckoutReminders()
  await demotionStarted
  database.db().prepare("UPDATE users SET status='inactive' WHERE id=?").run(demoted.id)
  releaseGatewayList()
  const demotionResult = await demotionRun
  assert.equal(demotionResult.sent, 0)
  assert.equal(demotionResult.skipped, 1)
  assert.equal(mailRequests.length, 0)

  resetQueue()
  const unsubscribed = customer(), unsubscribedRef = cardTopup(unsubscribed.id)
  enroll(unsubscribedRef, unsubscribed.id, unsubscribed.email)
  gatewayPages = [page([])]
  const unsubscribeStarted = pauseGatewayList()
  const unsubscribeRun = reminders.sendCheckoutReminders()
  await unsubscribeStarted
  assert.equal(reminders.unsubscribeCheckoutReminders(reminders.checkoutReminderUnsubscribeToken(unsubscribed.email)), true)
  releaseGatewayList()
  const unsubscribeResult = await unsubscribeRun
  assert.equal(unsubscribeResult.sent, 0)
  assert.equal(unsubscribeResult.skipped, 1)
  assert.equal(mailRequests.length, 0)

  resetQueue()
  const paidDuringRead = customer(), paidDuringReadRef = cardTopup(paidDuringRead.id)
  enroll(paidDuringReadRef, paidDuringRead.id, paidDuringRead.email)
  gatewayPages = [page([])]
  const paymentStarted = pauseGatewayList()
  const paymentRun = reminders.sendCheckoutReminders()
  await paymentStarted
  database.db().prepare("UPDATE whop_topups SET payment_id='pay_local' WHERE invoice_reference=?").run(paidDuringReadRef)
  releaseGatewayList()
  const paymentResult = await paymentRun
  assert.equal(paymentResult.sent, 0)
  assert.equal(paymentResult.skipped, 1)
  assert.equal(mailRequests.length, 0)
})

test('missing or unreadable accepted receipts are ambiguous and never retried automatically', async () => {
  for (const response of [
    Response.json({}),
    new Response('{not-json', { status: 200, headers: { 'Content-Type': 'application/json' } }),
  ]) {
    resetQueue()
    const owner = customer(), ref = cardTopup(owner.id)
    enroll(ref, owner.id, owner.email)
    resendResponses.push(response)
    const first = await reminders.sendCheckoutReminders()
    assert.equal(first.sent, 0)
    assert.equal(first.unresolved, 1)
    assert.equal((reminderRow(ref) as { unresolved: number; unresolved_reason: string }).unresolved, 1)
    const calls = mailRequests.length
    const second = await reminders.sendCheckoutReminders()
    assert.equal(second.sent, 0)
    assert.equal(mailRequests.length, calls)
  }
})

test('marketing fetch transport uncertainty is quarantined and a 429 retains the stable idempotency key', async () => {
  resetQueue()
  const owner = customer(), ref = cardTopup(owner.id)
  enroll(ref, owner.id, owner.email)
  resendFailure = true
  const uncertain = await reminders.sendCheckoutReminders()
  assert.equal(uncertain.sent, 0)
  assert.equal(uncertain.unresolved, 1)
  assert.equal((reminderRow(ref) as { unresolved_reason: string }).unresolved_reason, 'delivery_ambiguous')
  const uncertainCalls = mailRequests.length
  resendFailure = false
  assert.equal((await reminders.sendCheckoutReminders()).sent, 0)
  assert.equal(mailRequests.length, uncertainCalls)

  resetQueue()
  const retryOwner = customer(), retryRef = cardTopup(retryOwner.id)
  enroll(retryRef, retryOwner.id, retryOwner.email)
  resendResponses.push(Response.json({ error: 'rate limited' }, { status: 429 }))
  const limited = await reminders.sendCheckoutReminders()
  assert.equal(limited.sent, 0)
  assert.equal(limited.unresolved, 1)
  const retryRow = reminderRow(retryRef) as { next_attempt_at: number; unresolved: number }
  assert.equal(retryRow.unresolved, 0)
  assert.ok(retryRow.next_attempt_at > Date.now())
  const firstKey = mailRequests[0].headers.get('Idempotency-Key')
  database.db().prepare('UPDATE checkout_payment_reminders SET next_attempt_at=0 WHERE reference=?').run(retryRef)
  const retried = await reminders.sendCheckoutReminders()
  assert.equal(retried.sent, 1)
  assert.equal(mailRequests.length, 2)
  assert.equal(mailRequests[1].headers.get('Idempotency-Key'), firstKey)
  assert.equal((reminderRow(retryRef) as { send_provider_id: string }).send_provider_id, 're_test_2')
})

test('crypto reminder verification is readonly, fail-closed without a fresh watcher, and keeps guest/invoice references distinct', async () => {
  resetQueue()
  process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET = 'reminder-guest-link-secret-that-is-at-least-32-chars'
  enableReadonlyCryptoWatcher()
  try {
    const owner = customer()
    const guest = guestCryptoCheckout(owner.id, owner.email)
    assert.equal(reminders.requestCheckoutReminderOptIn('guest', guest.reference, owner.email, owner.id), true)
    assert.equal(reminders.recordCheckoutReminderOpened('guest', guest.reference, owner.id, 'test_guest_crypto_open'), true)
    database.db().prepare("UPDATE checkout_payment_reminders SET due_at=0,next_attempt_at=0 WHERE kind='guest' AND reference=?").run(guest.reference)

    // No cursor means no proof that the normal watcher recently read the route;
    // the reminder must not start a chain scan or write watcher/financial rows.
    const beforeCursor = database.db().prepare("SELECT * FROM payment_watch_cursors WHERE route_id='bsc-usdt-peg'").get()
    const beforeTransfers = (database.db().prepare("SELECT COUNT(*) AS count FROM chain_transfers WHERE route_id='bsc-usdt-peg'").get() as { count: number }).count
    const stale = await reminders.sendCheckoutReminders()
    assert.equal(stale.sent, 0)
    assert.equal(stale.unresolved, 1)
    assert.equal((reminderRow(guest.reference, 'guest') as { unresolved_reason: string }).unresolved_reason, 'crypto_chain_read_failed_or_ambiguous')
    assert.deepEqual(database.db().prepare("SELECT * FROM payment_watch_cursors WHERE route_id='bsc-usdt-peg'").get(), beforeCursor)
    assert.equal((database.db().prepare("SELECT COUNT(*) AS count FROM chain_transfers WHERE route_id='bsc-usdt-peg'").get() as { count: number }).count, beforeTransfers)
    assert.equal(mailRequests.length, 0)

    resetQueue()
    const guestReady = guestCryptoCheckout(owner.id, owner.email)
    assert.equal(reminders.requestCheckoutReminderOptIn('guest', guestReady.reference, owner.email, owner.id), true)
    assert.equal(reminders.recordCheckoutReminderOpened('guest', guestReady.reference, owner.id, 'test_guest_crypto_open'), true)
    database.db().prepare("UPDATE checkout_payment_reminders SET due_at=0,next_attempt_at=0 WHERE kind='guest' AND reference=?").run(guestReady.reference)
    seedFreshWatcherCursor()
    const ready = await reminders.sendCheckoutReminders()
    assert.equal(ready.sent, 1)
    assert.equal(mailRequests.length, 1)
    const expectedDestination = `https://iunlockmobile.com/checkout/crypto/${guestReady.reference}?key=`
    assert.match(String(mailRequests[0].body.text), new RegExp(`${expectedDestination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[a-f0-9]{64}`))
    assert.equal((database.db().prepare("SELECT destination_url FROM checkout_payment_reminders WHERE kind='guest' AND reference=?").get(guestReady.reference) as { destination_url: string }).destination_url.startsWith(expectedDestination), true)
    assert.equal((database.db().prepare("SELECT COUNT(*) AS count FROM chain_transfers WHERE route_id='bsc-usdt-peg'").get() as { count: number }).count, 0)
  } finally {
    clearCryptoWatcherEnv()
    delete process.env.IUNLOCKMOBILE_IMEI_FINGERPRINT_SECRET
  }
})

test('crypto reminders suppress ambiguous transfers and quarantine invoices that expire during the wait', async () => {
  resetQueue()
  enableReadonlyCryptoWatcher()
  try {
    const owner = customer()
    const ambiguousRef = cryptoTopup(owner.id)
    assert.equal(reminders.requestCheckoutReminderOptIn('topup', ambiguousRef, owner.email, owner.id), true)
    assert.equal(reminders.recordCheckoutReminderOpened('topup', ambiguousRef, owner.id, 'test_crypto_open'), true)
    database.db().prepare("UPDATE checkout_payment_reminders SET due_at=0,next_attempt_at=0 WHERE kind='topup' AND reference=?").run(ambiguousRef)
    seedFreshWatcherCursor()
    database.db().prepare(`INSERT INTO chain_transfers(route_id,tx_hash,log_index,block_number,block_time,from_address,amount_raw,amount_e4)
      VALUES('bsc-usdt-peg',?,0,100,datetime('now'),?, '105007000000000000',105007)`).run(`0x${'a'.repeat(64)}`, '0x2222222222222222222222222222222222222222')
    const ambiguous = await reminders.sendCheckoutReminders()
    assert.equal(ambiguous.sent, 0)
    assert.equal(ambiguous.skipped, 1)
    assert.equal((reminderRow(ambiguousRef) as { suppressed: number; unresolved_reason: string }).suppressed, 1)
    assert.equal((reminderRow(ambiguousRef) as { unresolved_reason: string }).unresolved_reason, 'crypto_payment_present')
    assert.equal(mailRequests.length, 0)

    resetQueue()
    const expiredRef = cryptoTopup(owner.id)
    assert.equal(reminders.requestCheckoutReminderOptIn('topup', expiredRef, owner.email, owner.id), true)
    assert.equal(reminders.recordCheckoutReminderOpened('topup', expiredRef, owner.id, 'test_crypto_open'), true)
    database.db().prepare("UPDATE checkout_payment_reminders SET due_at=0,next_attempt_at=0 WHERE kind='topup' AND reference=?").run(expiredRef)
    database.db().prepare("UPDATE invoices SET created_at=datetime('now','-8 days') WHERE reference=?").run(expiredRef)
    seedFreshWatcherCursor()
    const expired = await reminders.sendCheckoutReminders()
    assert.equal(expired.sent, 0)
    assert.equal(expired.unresolved, 1)
    assert.equal((reminderRow(expiredRef) as { unresolved: number; unresolved_reason: string }).unresolved, 1)
    assert.equal((reminderRow(expiredRef) as { unresolved_reason: string }).unresolved_reason, 'crypto_chain_read_failed_or_ambiguous')
    assert.equal(mailRequests.length, 0)
  } finally {
    clearCryptoWatcherEnv()
  }
})

test('transactional success remains status-only and does not require a JSON receipt', async () => {
  resetQueue()
  resendResponses.push(Response.json({}, { status: 200 }))
  await accountSecurity.sendTransactionalEmail('buyer@example.test', 'OTP', '<p>x</p>', 'x', { idempotencyKey: 'otp-test' })
  assert.equal(mailRequests.length, 1)
  assert.equal(mailRequests[0].headers.get('Idempotency-Key'), 'otp-test')
  assert.equal(mailRequests[0].headers.has('List-Unsubscribe'), false)
  assert.equal(mailRequests[0].redirect, undefined)
})
