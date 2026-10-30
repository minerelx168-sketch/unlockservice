import assert from 'node:assert/strict'
import test from 'node:test'
import {
  MAX_REMINDER_ATTEMPTS,
  MAX_REMINDERS,
  REMINDER_DELAY_MS,
  type AuthoritativeCheckoutGateway,
  type CheckoutMarketingConfig,
  type CheckoutMarketingDependencies,
  type CheckoutMarketingEmail,
  type CheckoutMarketingRecord,
  type CheckoutMarketingState,
  type CheckoutMarketingStore,
  type GatewayVerdict,
  type MarketingSendResult,
  maybeSendCheckoutMarketingReminder,
} from '../lib/checkout-marketing-reminder'
import { createExistingResendMarketingSender } from '../lib/checkout-marketing-resend'

const created = 1_000_000
const billId = 'bill-20261030-01'
const baseConfig: CheckoutMarketingConfig = {
  enabled: true,
  senderBusinessName: 'iUnlockMobile',
  senderPostalAddress: '100 Example Road, Example City',
  senderEmail: 'offers@example.test',
  replyTo: 'support@example.test',
  publicOrigin: 'https://app.example.test',
}

function record(overrides: Partial<CheckoutMarketingRecord> = {}): CheckoutMarketingRecord {
  return {
    billId,
    accountId: 'acct-01',
    planId: 'plan-01',
    hostedCheckoutId: 'ch_01',
    hostedCheckoutUrl: 'https://payments.example.test/checkout/ch_01',
    appCheckoutUrl: 'https://app.example.test/checkout/private/token-01',
    unsubscribeUrl: 'https://app.example.test/unsubscribe/token-01',
    paymentMethod: 'card',
    websiteCheckoutEmail: 'buyer@example.test',
    serviceName: 'Unlock service',
    checkoutCreatedAtMs: created,
    checkoutExpiresAtMs: created + 60 * 60 * 1000,
    quoteCurrency: 'USD',
    quoteTotalMinor: 1099,
    cardCurrency: 'USD',
    cardTotalMinor: 1099,
    marketingConsent: { verified: true, source: 'explicit_checkout_opt_in', verifiedAtMs: created },
    recipientKey: 'recipient-key-01',
    dedupeKey: 'service-device-key-01',
    ...overrides,
  }
}

class MockStore implements CheckoutMarketingStore {
  readonly sent: Array<{ id: string; key: string }> = []
  readonly notAccepted: Array<{ attempt: number; nextAttemptAtMs: number | null; key: string }> = []
  readonly ambiguous: string[] = []
  readonly claims: string[] = []
  state: CheckoutMarketingState = { paymentState: 'pending', marketingSuppressed: false }
  claimMode: 'normal' | 'dedupe' = 'normal'
  private claimed = false
  private unresolved = false
  private readCount = 0
  raceState: CheckoutMarketingState | null = null
  readonly savedRecord: CheckoutMarketingRecord

  constructor(savedRecord = record()) { this.savedRecord = savedRecord }
  async getCheckout() { return this.savedRecord }
  async readCurrentState() {
    this.readCount += 1
    if (this.raceState && this.readCount === 2) this.state = this.raceState
    return this.state
  }
  async claimReminder(input: Parameters<CheckoutMarketingStore['claimReminder']>[0]) {
    this.claims.push(input.idempotencyKey)
    if (this.claimMode === 'dedupe') return { kind: 'skipped' as const, reason: 'deduplicated' as const }
    if (this.unresolved) return { kind: 'skipped' as const, reason: 'unresolved' as const }
    if (this.claimed) return { kind: 'skipped' as const, reason: 'active_lease' as const }
    this.claimed = true
    return { kind: 'claimed' as const, leaseToken: `lease-token-opaque-${this.claims.length}`, attempt: this.notAccepted.length + 1 }
  }
  async recordAccepted(input: Parameters<CheckoutMarketingStore['recordAccepted']>[0]) {
    this.sent.push({ id: input.providerMessageId, key: input.idempotencyKey })
    return 'recorded' as const
  }
  async recordNotAccepted(input: Parameters<CheckoutMarketingStore['recordNotAccepted']>[0]) {
    this.notAccepted.push({ attempt: input.attempt, nextAttemptAtMs: input.nextAttemptAtMs, key: input.idempotencyKey })
    this.claimed = false
  }
  async recordAmbiguous(input: Parameters<CheckoutMarketingStore['recordAmbiguous']>[0]) {
    this.ambiguous.push(input.reason)
    this.unresolved = true
  }
  /** A test-only retry hook; production persistence must enforce this atomically. */
  allowRetry() { this.claimed = false }
}

class MockGateway implements AuthoritativeCheckoutGateway {
  verdict: GatewayVerdict = {
    kind: 'confirmed_unpaid', billId, accountId: 'acct-01', planId: 'plan-01',
    hostedCheckoutId: 'ch_01', currency: 'USD', totalMinor: 1099,
  }
  calls = 0
  async verifyPendingCheckout() { this.calls += 1; return this.verdict }
}

class MockMailer {
  readonly messages: CheckoutMarketingEmail[] = []
  outcomes: MarketingSendResult[] = [{ kind: 'accepted', providerMessageId: 'msg-01' }]
  async sendMarketingEmail(message: CheckoutMarketingEmail) {
    this.messages.push(message)
    return this.outcomes.shift() ?? { kind: 'ambiguous', reason: 'no test outcome' }
  }
}

function deps(store = new MockStore(), gateway = new MockGateway(), mailer = new MockMailer()): CheckoutMarketingDependencies {
  return { store, gateway, mailer }
}

const due = created + REMINDER_DELAY_MS

test('disabled by default and invalid consent/postal configuration never touches ports', async () => {
  const store = new MockStore()
  const gateway = new MockGateway()
  const mailer = new MockMailer()
  const disabled = await maybeSendCheckoutMarketingReminder(billId, { ...baseConfig, enabled: false }, deps(store, gateway, mailer), due)
  assert.deepEqual(disabled, { kind: 'disabled', reason: 'feature_disabled' })
  const noPostal = await maybeSendCheckoutMarketingReminder(billId, { ...baseConfig, senderPostalAddress: '' }, deps(store, gateway, mailer), due)
  assert.equal(noPostal.kind, 'skipped')
  const noConsent = new MockStore(record({ marketingConsent: null }))
  const result = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(noConsent, gateway, mailer), due)
  assert.deepEqual(result, { kind: 'skipped', reason: 'not_eligible' })
  assert.equal(mailer.messages.length, 0)
})

test('waits through 4:59 and sends at exactly 5:00 for a valid pending card checkout', async () => {
  const earlyMailer = new MockMailer()
  const early = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(new MockStore(), new MockGateway(), earlyMailer), due - 1_000)
  assert.deepEqual(early, { kind: 'skipped', reason: 'outside_reminder_window' })
  const mailer = new MockMailer()
  const store = new MockStore()
  const result = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(store, new MockGateway(), mailer), due)
  assert.equal(result.kind, 'sent')
  assert.equal(mailer.messages.length, 1)
  assert.equal(mailer.messages[0].to, 'buyer@example.test')
  assert.equal(mailer.messages[0].subject, 'Complete your iUnlockMobile checkout')
  assert.match(mailer.messages[0].headers['List-Unsubscribe'], /^<https:\/\/app\.example\.test\//)
  assert.equal(mailer.messages[0].headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
  assert.equal(store.sent.length, 1)
})

test('rejects paid, review, expired, crypto, mismatched totals, and unsafe application records', async () => {
  for (const state of ['paid', 'review'] as const) {
    const store = new MockStore(); store.state = { paymentState: state, marketingSuppressed: false }
    const result = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(store), due)
    assert.equal(result.kind, 'skipped')
  }
  const expired = new MockStore(record({ checkoutExpiresAtMs: due }))
  assert.deepEqual(await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(expired), due), { kind: 'skipped', reason: 'not_eligible' })
  for (const bad of [
    record({ paymentMethod: 'crypto' }),
    record({ cardTotalMinor: 1100 }),
    record({ appCheckoutUrl: 'https://other.example.test/private' }),
    record({ unsubscribeUrl: 'http://app.example.test/unsubscribe' }),
  ]) {
    const result = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(new MockStore(bad)), due)
    assert.equal(result.kind, 'skipped')
  }
})

test('fails closed on gateway ambiguity and on a paid/suppressed state race after verification', async () => {
  const gateway = new MockGateway(); gateway.verdict = { kind: 'ambiguous' }
  const mailer = new MockMailer()
  const ambiguous = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(new MockStore(), gateway, mailer), due)
  assert.deepEqual(ambiguous, { kind: 'skipped', reason: 'gateway_not_confirmed_unpaid' })
  assert.equal(mailer.messages.length, 0)

  const racedStore = new MockStore(); racedStore.raceState = { paymentState: 'paid', marketingSuppressed: false }
  const raced = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(racedStore, new MockGateway(), mailer), due)
  assert.deepEqual(raced, { kind: 'skipped', reason: 'state_changed_before_send' })
  assert.equal(mailer.messages.length, 0)
})

test('atomic claim permits one accepted message under repeated/concurrent calls and honors deduplication', async () => {
  const store = new MockStore(); const mailer = new MockMailer(); const dependencies = deps(store, new MockGateway(), mailer)
  const results = await Promise.all(Array.from({ length: 4 }, () => maybeSendCheckoutMarketingReminder(billId, baseConfig, dependencies, due)))
  assert.equal(results.filter((result) => result.kind === 'sent').length, 1)
  assert.equal(mailer.messages.length, 1)
  assert.equal(store.sent.length, 1)
  const dedup = new MockStore(); dedup.claimMode = 'dedupe'
  const skipped = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(dedup, new MockGateway(), new MockMailer()), due)
  assert.deepEqual(skipped, { kind: 'skipped', reason: 'claim_deduplicated' })
})

test('retries only explicit not-accepted transport outcomes with one stable key', async () => {
  const store = new MockStore(); const gateway = new MockGateway(); const mailer = new MockMailer()
  mailer.outcomes = [{ kind: 'not_accepted', reason: 'provider_503' }, { kind: 'accepted', providerMessageId: 'msg-02' }]
  const first = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(store, gateway, mailer), due)
  assert.equal(first.kind, 'retry_scheduled')
  store.allowRetry()
  const second = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(store, gateway, mailer), due + 30 * 60 * 1000)
  assert.equal(second.kind, 'sent')
  assert.equal(store.claims[0], store.claims[1])
  assert.equal(store.notAccepted[0].attempt, 1)
  assert.equal(MAX_REMINDER_ATTEMPTS, 3)
  assert.equal(MAX_REMINDERS, 1)
})

test('permanent transport rejection records no retry schedule', async () => {
  const store = new MockStore(); const mailer = new MockMailer()
  mailer.outcomes = [{ kind: 'not_accepted', reason: 'validation_rejected', retryable: false }]
  const result = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(store, new MockGateway(), mailer), due)
  assert.equal(result.kind, 'not_accepted_exhausted')
  assert.equal(store.notAccepted[0].nextAttemptAtMs, null)
  assert.equal(store.sent.length, 0)
})

test('draft core connects to the existing-settings Resend adapter with mock HTTP, not a new mail service', async () => {
  const store = new MockStore()
  let calls = 0
  const mailer = createExistingResendMarketingSender({
    enabled: true,
    env: {
      RESEND_API_KEY: 'test-only-never-real',
      IUNLOCKMOBILE_EMAIL_FROM: 'iUnlockMobile <offers@example.test>',
      IUNLOCKMOBILE_EMAIL_REPLY_TO: 'support@example.test',
      IUNLOCKMOBILE_PUBLIC_ORIGIN: 'https://app.example.test',
    },
    fetcher: async (input, init) => {
      assert.equal(String(input), 'https://api.resend.com/emails')
      const body = JSON.parse(String(init?.body))
      assert.deepEqual(body.to, ['buyer@example.test'])
      assert.equal(body.from, 'iUnlockMobile <offers@example.test>')
      assert.equal(body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click')
      assert.ok(body.text.includes('do not pay again'))
      calls++
      return Response.json({ id: '49a3999c-0ce1-4ea6-ab68-afcd6dc2e794' })
    },
  })
  const dependencies = { store, gateway: new MockGateway(), mailer }
  assert.equal((await maybeSendCheckoutMarketingReminder(billId, baseConfig, dependencies, due)).kind, 'sent')
  assert.equal((await maybeSendCheckoutMarketingReminder(billId, baseConfig, dependencies, due)).kind, 'skipped')
  assert.equal(calls, 1)
  assert.equal(store.sent.length, 1)
})

test('ambiguous transport remains unresolved and cannot blindly retry or rotate its key', async () => {
  const store = new MockStore(); const gateway = new MockGateway(); const mailer = new MockMailer()
  mailer.outcomes = [{ kind: 'ambiguous', reason: 'timeout_after_submit' }, { kind: 'accepted', providerMessageId: 'must-not-send' }]
  const first = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(store, gateway, mailer), due)
  assert.deepEqual(first, { kind: 'ambiguous', idempotencyKey: `checkout-marketing-reminder:${billId}` })
  const second = await maybeSendCheckoutMarketingReminder(billId, baseConfig, deps(store, gateway, mailer), due + 30 * 60 * 1000)
  assert.deepEqual(second, { kind: 'skipped', reason: 'claim_unresolved' })
  assert.equal(mailer.messages.length, 1)
  assert.deepEqual(store.ambiguous, ['timeout_after_submit'])
})

test('escapes copy/address/URLs, uses saved checkout email, and never includes raw device identifiers', async () => {
  const savedEmail = 'saved@example.test'
  const mailer = new MockMailer()
  const result = await maybeSendCheckoutMarketingReminder(billId, { ...baseConfig, senderBusinessName: 'Name & Co', senderPostalAddress: undefined as unknown as string }, deps(new MockStore(record({
    websiteCheckoutEmail: savedEmail,
    serviceName: '<script>alert("x")</script>',
    appCheckoutUrl: 'https://app.example.test/checkout/private/a?sig=x',
  })), new MockGateway(), mailer), due)
  // The undefined override is intentionally invalid and proves no malformed footer can send.
  assert.deepEqual(result, { kind: 'skipped', reason: 'invalid_config_or_bill' })

  const validMailer = new MockMailer()
  const valid = await maybeSendCheckoutMarketingReminder(billId, { ...baseConfig, senderBusinessName: 'Name & Co', senderPostalAddress: '1 <Main> & Road' }, deps(new MockStore(record({
    websiteCheckoutEmail: savedEmail,
    serviceName: '<script>alert("x")</script>',
    appCheckoutUrl: 'https://app.example.test/checkout/private/a?sig=x',
  })), new MockGateway(), validMailer), due)
  assert.equal(valid.kind, 'sent')
  const message = validMailer.messages[0]
  assert.equal(message.to, savedEmail)
  assert.match(message.html, /&lt;script&gt;alert\(&quot;x&quot;\)&lt;\/script&gt;/)
  assert.match(message.html, /1 &lt;Main&gt; &amp; Road/)
  assert.doesNotMatch(`${message.html}\n${message.text}`, /(?<!\d)\d{15}(?!\d)/)
  assert.match(message.html, /https:\/\/app\.example\.test\/checkout\/private\/a\?sig=x/)
  assert.doesNotMatch(message.html, /customer_email/)
})
