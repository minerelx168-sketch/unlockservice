import test, { before } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.IUNLOCKMOBILE_DB = join(mkdtempSync(join(tmpdir(), 'ai-geo-')), 'test.db')

import { attributedSource, attributionMetadata, classifyTouch, decodeTouch, encodeTouch, nextTouches } from '../lib/analytics/ai-attribution'
import { botHit, detectAiBot } from '../lib/analytics/ai-bot-logger'
import { AUTH_ONLY_SERVICE_IDS, DISABLED_SERVICE_IDS, forbiddenTermsIn, isPublicAgentService } from '../lib/agent/public-catalog'
import { isPublicContentPath } from '../lib/public-robots'
import { imeiStatus } from '../lib/imei'
import { QUICK_IMEI_COPY } from '../components/quick-imei-copy'

const FORBIDDEN = /\bLOST\b|Owner ID|Bypass|\bMDM\b|Past Due|bit\.ly/
const touch = (url: string, referrer?: string) => classifyTouch({ url, referrer, now: new Date('2026-11-13T00:00:00Z') })

// ------------------------------------------------------------- attribution

test('confirmed AI referrals are classified from referrer host and UTM markers', () => {
  const cases: [string, string | undefined, string][] = [
    ['https://iunlockmobile.com/?utm_source=chatgpt.com', undefined, 'chatgpt_search'],
    ['https://iunlockmobile.com/', 'https://chatgpt.com/', 'chatgpt_search'],
    ['https://iunlockmobile.com/x?utm_source=chatgpt_gpt_store&utm_medium=custom_gpt', undefined, 'chatgpt_custom_gpt'],
    ['https://iunlockmobile.com/x?utm_medium=custom_gpt', 'https://chatgpt.com/', 'chatgpt_custom_gpt'],
    ['https://iunlockmobile.com/', 'https://www.perplexity.ai/search/abc', 'perplexity'],
    ['https://iunlockmobile.com/', 'https://claude.ai/', 'claude'],
    ['https://iunlockmobile.com/', 'https://copilot.microsoft.com/', 'copilot'],
    ['https://iunlockmobile.com/', 'https://edgeservices.bing.com/edgesvc/chat', 'copilot'],
    ['https://iunlockmobile.com/', 'https://gemini.google.com/app', 'gemini_app'],
  ]
  for (const [url, ref, source] of cases) {
    const t = touch(url, ref)
    assert.equal(t.source, source, `${url} ${ref}`)
    assert.equal(t.confidence, 'confirmed')
    assert.equal(t.channel, 'ai')
  }
})

test('organic search, paid, direct and referral traffic are never counted as AI', () => {
  assert.deepEqual([touch('https://iunlockmobile.com/', 'https://www.google.com/').source, touch('https://iunlockmobile.com/', 'https://www.google.com/').confidence], ['organic_search', 'non_ai'])
  assert.equal(touch('https://iunlockmobile.com/', 'https://www.bing.com/search?q=x').source, 'organic_search')
  assert.equal(touch('https://iunlockmobile.com/?gclid=abc', 'https://www.google.com/').source, 'paid')
  assert.equal(touch('https://iunlockmobile.com/?utm_medium=cpc&utm_source=google').source, 'paid')
  assert.equal(touch('https://iunlockmobile.com/').source, 'direct')
  assert.equal(touch('https://iunlockmobile.com/', 'https://reddit.com/r/iphone').source, 'referral')
  assert.equal(touch('https://iunlockmobile.com/b', 'https://iunlockmobile.com/a').channel, 'internal')
  // Weak AI-like signals are only "probable".
  const probable = touch('https://iunlockmobile.com/?utm_source=openai_newsletter')
  assert.equal(probable.confidence, 'probable')
})

test('referrer query strings are dropped and cookies round-trip strictly', () => {
  const t = touch('https://iunlockmobile.com/es/checar-imei-iphone?utm_source=perplexity.ai', 'https://www.perplexity.ai/search?q=my+imei+356789')
  assert.equal(t.raw_referrer, 'www.perplexity.ai/search')
  assert.equal(t.locale, 'es')
  assert.equal(t.landing_page_path, '/es/checar-imei-iphone')
  assert.deepEqual(decodeTouch(encodeTouch(t)), t)
  assert.equal(decodeTouch('not!base64'), null)
  assert.equal(decodeTouch(Buffer.from(JSON.stringify({ ...t, source: 'evil' })).toString('base64url')), null)
})

test('first touch is written once; last touch only for non-direct arrivals', () => {
  const ai = touch('https://iunlockmobile.com/?utm_source=chatgpt.com')
  const direct = touch('https://iunlockmobile.com/')
  assert.deepEqual(nextTouches({ ft: null, lt: null }, ai), { ft: ai, lt: ai })
  assert.deepEqual(nextTouches({ ft: ai, lt: ai }, direct), { ft: null, lt: null })
  const organic = touch('https://iunlockmobile.com/', 'https://google.com/')
  assert.deepEqual(nextTouches({ ft: ai, lt: ai }, organic), { ft: null, lt: organic })
  // A confirmed AI first touch still wins attribution after a later organic visit.
  assert.deepEqual(attributedSource(ai, organic), { source: 'chatgpt_search', confidence: 'confirmed' })
  assert.deepEqual(attributedSource(direct, organic), { source: 'organic_search', confidence: 'non_ai' })
  const meta = attributionMetadata(ai, organic, { skuId: '444', gaClientId: '123.456', gaSessionId: 'bad', internalOrderId: 'abc' })
  assert.equal(meta.ai_source_ft, 'chatgpt_search')
  assert.equal(meta.ai_source_lt, 'organic_search')
  assert.equal(meta.attribution_confidence, 'confirmed')
  assert.equal(meta.ga_client_id, '123.456')
  assert.equal('ga_session_id' in meta, false)
})

// ------------------------------------------------------------- ledger

let ledger: typeof import('../lib/analytics/ai-revenue-ledger')
let database: typeof import('../lib/db')
before(async () => {
  database = await import('../lib/db')
  ledger = await import('../lib/analytics/ai-revenue-ledger')
})

test('gross profit formula: net collected − fee − supplier cost − refunded', () => {
  assert.equal(ledger.grossProfitCents({ netCollectedCents: 179, paymentFeeCents: 35, supplierCostCents: 100, refundedCents: 0 }), 44)
  assert.equal(ledger.grossProfitCents({ netCollectedCents: 179, paymentFeeCents: 35, supplierCostCents: 100, refundedCents: 179 }), -135)
})

test('payment.succeeded is idempotent per payment id and refunds adjust profit once', () => {
  const ft = touch('https://iunlockmobile.com/articles/x?utm_source=chatgpt.com')
  ledger.saveOrderAttribution('guest', 'a'.repeat(32), ft, ft, { skuId: '444' })
  const input = { paymentId: 'pay_test1', orderRef: 'a'.repeat(32), kind: 'guest_card' as const, productCode: 'APPLE_CARRIER_LITE',
    grossCents: 179, taxCents: 0, paymentFeeCents: 35, paidAt: '2026-11-13T10:00:00Z' }
  assert.equal(ledger.recordPaymentSucceeded(input), 'inserted')
  assert.equal(ledger.recordPaymentSucceeded(input), 'duplicate')
  assert.equal(ledger.recordPaymentSucceeded({ ...input, grossCents: 9999 }), 'duplicate')
  const rows = database.db().prepare("SELECT * FROM ai_revenue_ledger WHERE payment_id='pay_test1'").all() as Record<string, number | string>[]
  assert.equal(rows.length, 1)
  const row = rows[0]
  assert.equal(row.attribution_source, 'chatgpt_search')
  assert.equal(row.attribution_confidence, 'confirmed')
  assert.equal(row.paid_at, '2026-11-13 10:00:00')
  const cost = Number(row.supplier_cost_cents)
  assert.equal(row.gross_profit_cents, 179 - 35 - cost)

  assert.equal(ledger.recordPaymentRefunded('pay_test1', 79), 'updated')
  assert.equal(ledger.recordPaymentRefunded('pay_test1', 79), 'unchanged')
  assert.equal(ledger.recordPaymentRefunded('pay_test1', 50), 'unchanged')
  let after = database.db().prepare("SELECT status, refunded_cents, gross_profit_cents FROM ai_revenue_ledger WHERE payment_id='pay_test1'").get() as Record<string, number | string>
  assert.deepEqual(after, { status: 'partially_refunded', refunded_cents: 79, gross_profit_cents: 179 - 35 - cost - 79 })
  assert.equal(ledger.recordPaymentRefunded('pay_test1', 5000), 'updated')
  after = database.db().prepare("SELECT status, refunded_cents FROM ai_revenue_ledger WHERE payment_id='pay_test1'").get() as Record<string, number | string>
  assert.deepEqual(after, { status: 'refunded', refunded_cents: 179 })
  assert.equal(ledger.recordPaymentRefunded('pay_missing', 10), 'missing')

  const params = ledger.ledgerGa4Params('a'.repeat(32))
  assert.equal(params.ai_source, 'chatgpt_search')
  assert.equal(params.attribution_confidence, 'confirmed')
  assert.equal(params.sku_id, '444')
  assert.equal(typeof params.gross_profit_usd, 'number')
})

test('Whop payments map into the ledger once, with real fees and cumulative refunds', () => {
  const ref = 'b'.repeat(32)
  database.db().prepare(`INSERT INTO guest_checkouts (reference,request_key,email,product_code,product_name,imei_encrypted,price_cents,fee_cents,account_id,product_id,environment)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(ref, 'k'.repeat(32), 'buyer@example.com', 'APPLE_CARRIER_LITE', 'Apple Carrier (Lite)', 'x', 170, 9, 'biz_test', 'prod_test', 'live')
  const money = (amount: string) => ({ amount, currency: 'usd', decimals: 2, display_decimals: 2 })
  const payment = {
    id: 'pay_whop1', status: 'paid', paid_at: '2026-11-13T11:00:00Z', created_at: '2026-11-13T10:59:00Z',
    metadata: { guest_reference: ref, integration: 'iunlockmobile-guest-v1' },
    total: money('1.79'), tax_amount: null, amount_after_fees: money('1.44'), refunded_amount: null, tax_refunded_amount: null,
    billing_address: { country: 'us' },
  } as unknown as import('@whop/sdk').Whop.Payment
  assert.equal(ledger.syncLedgerFromWhopPayment(payment), 'inserted')
  assert.equal(ledger.syncLedgerFromWhopPayment(payment), 'duplicate')
  const refunded = { ...payment, refunded_amount: money('1.79') } as unknown as import('@whop/sdk').Whop.Payment
  assert.equal(ledger.syncLedgerFromWhopPayment(refunded), 'updated')
  assert.equal(ledger.syncLedgerFromWhopPayment(refunded), 'unchanged')
  const row = database.db().prepare("SELECT payment_fee_cents, fee_estimated, country, status, customer_type FROM ai_revenue_ledger WHERE payment_id='pay_whop1'").get()
  assert.deepEqual(row, { payment_fee_cents: 35, fee_estimated: 0, country: 'US', status: 'refunded', customer_type: 'new' })
  // Credit top-ups and foreign integrations are not orders.
  assert.equal(ledger.syncLedgerFromWhopPayment({ ...payment, id: 'pay_x', metadata: { invoice_reference: ref, integration: 'iunlockmobile-credit-v1' } } as unknown as import('@whop/sdk').Whop.Payment), 'skipped')
})

test('admin summary groups verified revenue by AI platform', async () => {
  const { aiReferralSummary, metricsTokenValid } = await import('../lib/analytics/ai-referral-summary')
  const summary = aiReferralSummary('2026-11-01 00:00:00', '2026-12-01 00:00:00')
  const chatgpt = summary.platforms.find(p => p.platform === 'chatgpt_search')!
  assert.equal(chatgpt.confidence, 'confirmed')
  assert.equal(chatgpt.verified_purchases, 1)
  assert.equal(chatgpt.refund_rate, 1)
  assert.equal(summary.totals.verified_purchases, 2)
  process.env.ADMIN_METRICS_TOKEN = 't'.repeat(40)
  assert.equal(metricsTokenValid('Bearer ' + 't'.repeat(40)), true)
  assert.equal(metricsTokenValid('Bearer ' + 't'.repeat(39)), false)
  assert.equal(metricsTokenValid(null), false)
  const { GET } = await import('../app/api/admin/ai-referral-summary/route')
  const res = await GET(new Request('https://iunlockmobile.com/api/admin/ai-referral-summary?days=3650', { headers: { authorization: 'Bearer ' + 't'.repeat(40) } }))
  assert.equal(res.status, 200)
  assert.ok(Array.isArray((await res.json()).platforms))
})

// ------------------------------------------------------------- agent endpoints

async function get(path: string, url: string) {
  const mod = await import(path)
  return mod.GET(new Request(url, { headers: { 'x-real-ip': '203.0.113.' + Math.floor(Math.random() * 200) } })) as Promise<Response>
}

test('validate-imei checks length, Luhn and TAC and links the $1.70 check with UTM', async () => {
  const ok = await get('../app/api/agent/validate-imei/route', 'https://iunlockmobile.com/api/agent/validate-imei?imei=490154203237518')
  assert.equal(ok.status, 200)
  assert.equal(ok.headers.get('access-control-allow-origin'), '*')
  const body = await ok.json()
  assert.equal(body.validFormat, true)
  assert.equal(body.luhnValid, true)
  assert.equal(body.tacPrefix, '49015420')
  assert.match(body.recommendedNextStep, /apple-carrier-lock-status\?utm_source=/)
  const bad = await (await get('../app/api/agent/validate-imei/route', 'https://iunlockmobile.com/api/agent/validate-imei?imei=490154203237519')).json()
  assert.equal(bad.luhnValid, false)
  const short = await (await get('../app/api/agent/validate-imei/route', 'https://iunlockmobile.com/api/agent/validate-imei?imei=12345')).json()
  assert.equal(short.validFormat, false)
  assert.equal((await get('../app/api/agent/validate-imei/route', 'https://iunlockmobile.com/api/agent/validate-imei')).status, 400)
})

test('decode-apple-model reads prefixes, regions and A-numbers', async () => {
  const ll = await (await get('../app/api/agent/decode-apple-model/route', 'https://iunlockmobile.com/api/agent/decode-apple-model?model=MU683LL/A')).json()
  assert.equal(ll.regionCode, 'LL')
  assert.match(ll.liveCarrierCheckUrl, /apple-carrier-lock-status/)
  for (const region of ['VC', 'B', 'J', 'CH']) {
    const res = await get('../app/api/agent/decode-apple-model/route', `https://iunlockmobile.com/api/agent/decode-apple-model?model=MU683${region}/A`)
    assert.equal(res.status, 200, region)
    assert.equal((await res.json()).regionCode, region)
  }
  const a = await (await get('../app/api/agent/decode-apple-model/route', 'https://iunlockmobile.com/api/agent/decode-apple-model?model=A3105')).json()
  assert.ok(Array.isArray(a.variants))
})

test('quote returns PUBLIC SKUs only, with T-Mobile and Verizon as status checks', async () => {
  const all = await (await get('../app/api/agent/quote/route', 'https://iunlockmobile.com/api/agent/quote')).json()
  assert.ok(all.offers.length > 10)
  assert.equal(forbiddenTermsIn(JSON.stringify(all)).length, 0)
  for (const offer of all.offers) {
    assert.ok(![...DISABLED_SERVICE_IDS, ...AUTH_ONLY_SERVICE_IDS].includes(offer.serviceId), offer.serviceId)
    if (/T-Mobile|Verizon/.test(offer.carrier)) assert.equal(offer.serviceMode, 'status_check_only')
  }
  const tmobile = all.offers.find((o: { serviceId: string }) => o.serviceId === '688')
  const verizon = all.offers.find((o: { serviceId: string }) => o.serviceId === '423')
  assert.equal(tmobile.basePriceUsd, 3.47)
  assert.equal(verizon.basePriceUsd, 1.97)
  const lite = all.offers.find((o: { sku: string }) => o.sku === 'APPLE_CARRIER_LITE')
  assert.deepEqual([lite.basePriceUsd, lite.cardTotalUsd], [1.7, 1.79])
  const att = await (await get('../app/api/agent/quote/route', 'https://iunlockmobile.com/api/agent/quote?country=us&carrier=att')).json()
  assert.deepEqual(att.offers.map((o: { basePriceUsd: number }) => o.basePriceUsd).sort((a: number, b: number) => a - b), [8, 18])
  assert.ok(att.offers.every((o: { serviceMode: string }) => o.serviceMode === 'unlock_available'))
})

test('MCP speaks JSON-RPC 2.0: initialize, tools/list, tools/call', async () => {
  const { POST } = await import('../app/api/mcp/route')
  const call = async (body: unknown) => (await POST(new Request('https://iunlockmobile.com/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': '198.51.100.7' }, body: JSON.stringify(body) }))).json()
  const init = await call({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })
  assert.equal(init.result.serverInfo.name, 'iunlockmobile')
  const list = await call({ jsonrpc: '2.0', id: 2, method: 'tools/list' })
  assert.equal(list.result.tools.length, 3)
  assert.ok(list.result.tools.every((t: { annotations: { readOnlyHint: boolean } }) => t.annotations.readOnlyHint))
  const res = await call({ jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'validate_imei', arguments: { imei: '490154203237518' } } })
  assert.equal(JSON.parse(res.result.content[0].text).luhnValid, true)
  const quote = await call({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_service_quote', arguments: {} } })
  assert.equal(forbiddenTermsIn(quote.result.content[0].text).length, 0)
  const bad = await call({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope', arguments: {} } })
  assert.equal(bad.error.code, -32602)
})

test('OpenAPI 3.1 marks every operation non-consequential; discovery files leak nothing', async () => {
  const { GET } = await import('../app/openapi.json/route')
  const spec = await GET().json()
  assert.equal(spec.openapi, '3.1.0')
  const ops = Object.values(spec.paths as Record<string, { get: Record<string, unknown> }>).map(p => p.get)
  assert.equal(ops.length, 3)
  assert.ok(ops.every(op => op['x-openai-isConsequential'] === false))
  const llms = await (await import('../app/llms.txt/route')).GET().text()
  const full = await (await import('../app/llms-full.txt/route')).GET().text()
  for (const text of [llms, full, JSON.stringify(spec)]) assert.doesNotMatch(text, FORBIDDEN)
  assert.match(llms, /Status Check Only/)
  assert.match(llms, /\/openapi\.json/)
  assert.match(llms, /\/api\/mcp/)
  assert.match(llms, /2026-used-iphone-carrier-lock-report/)
  for (const price of ['$1.70', '$2.95', '$1.60', '$3.47', '$1.97', '$8.00', '$19.99', '$4.99', '$26.00', '$13.00', '$16.00']) assert.ok(llms.includes(price), price)
})

test('catalog gate excludes DISABLED and AUTH_ONLY ids', () => {
  for (const id of ['926', '25', '661', '904', '702', '696', '718', '966', '967', '780', '1001', '344', '721', '430', '893', '931', '1000'])
    assert.equal(isPublicAgentService({ serviceId: id, productCode: 'UNLOCK_' + id, status: 'available' }), false, id)
  assert.equal(isPublicAgentService({ serviceId: '444', productCode: 'APPLE_CARRIER_LITE', status: 'available' }), true)
  assert.equal(isPublicAgentService({ serviceId: '9999', productCode: 'X', name: 'MDM removal', status: 'available' }), false)
})

// ------------------------------------------------------------- crawlers, robots, widget

test('robots allows every AI crawler and blocks only private routes', async () => {
  const robots = (await import('../app/robots')).default()
  const rules = robots.rules as { userAgent: string; allow: string[]; disallow: string[] }[]
  for (const bot of ['OAI-SearchBot', 'ChatGPT-User', 'GPTBot', 'PerplexityBot', 'Perplexity-User', 'ClaudeBot', 'Claude-SearchBot', 'Claude-User', 'Googlebot', 'Google-Extended', 'Applebot', 'bingbot']) {
    const rule = rules.find(r => r.userAgent === bot)
    assert.ok(rule, bot)
    for (const path of ['/', '/llms.txt', '/llms-full.txt', '/openapi.json', '/api/agent/', '/api/mcp']) assert.ok(rule!.allow.includes(path), `${bot} ${path}`)
    for (const path of ['/api/user/', '/api/admin/', '/account']) assert.ok(rule!.disallow.includes(path), `${bot} ${path}`)
    for (const open of ['/tools/', '/reports/', '/articles/', '/services/', '/es', '/llms.txt']) assert.ok(!rule!.disallow.some(d => open.startsWith(d)), `${bot} blocks ${open}`)
  }
  assert.equal(detectAiBot('Mozilla/5.0 (compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot)'), 'OAI-SearchBot')
  assert.equal(detectAiBot('Mozilla/5.0 Claude-SearchBot/1.0'), 'Claude-SearchBot')
  assert.equal(detectAiBot('Mozilla/5.0 (iPhone) Safari'), null)
  assert.deepEqual(Object.keys(botHit('GPTBot', '/llms.txt', 200, 'us')), ['type', 'bot_name', 'path', 'status_code', 'ip_country', 'timestamp'])
  assert.equal(botHit('GPTBot', '/', 200, 'us').ip_country, 'US')
})

test('public content paths get the full-snippet robots header; private ones do not', () => {
  for (const p of ['/', '/es', '/es/checar-imei-iphone', '/fr-ca/deverrouiller-iphone-canada', '/articles/x', '/services/imei-check/apple-carrier-lock-status', '/tools/imei-luhn-tac-validator', '/reports/2026-used-iphone-carrier-lock-report', '/llms.txt'])
    assert.ok(isPublicContentPath(p), p)
  for (const p of ['/checkout', '/es/checkout', '/user/dashboard', '/admin', '/login', '/services/unlock/catalog', '/api/agent/quote'])
    assert.ok(!isPublicContentPath(p), p)
})

test('quick IMEI widget: live Luhn state and complete copy in all six languages', () => {
  assert.deepEqual(imeiStatus('49015420323751'), { digits: '49015420323751', complete: false, valid: false })
  assert.deepEqual(imeiStatus('490154 20 323751 8'), { digits: '490154203237518', complete: true, valid: true })
  assert.equal(imeiStatus('490154203237519').valid, false)
  const english = QUICK_IMEI_COPY.en
  for (const locale of ['es', 'fr', 'pt', 'de', 'ar'] as const) {
    const copy = QUICK_IMEI_COPY[locale]
    for (const key of Object.keys(english) as (keyof typeof english)[]) {
      if (key === 'chip' || key === 'left') continue
      assert.notEqual(copy[key], english[key], `${locale}.${key} is untranslated`)
    }
    assert.match(copy.value, /1[.,]70/)
    assert.notEqual(copy.left(3), english.left(3))
  }
})

test('article template renders the quick check above the body for every locale', () => {
  const page = readFileSync(join(process.cwd(), 'components/article-page.tsx'), 'utf8')
  const head = page.indexOf('className="article-head"'), body = page.indexOf('<ArticleBody')
  const widget = page.indexOf('<QuickImeiCheckCard'), english = page.indexOf('<ArticleCarrierWidget')
  assert.ok(head > 0 && widget > head && widget < body && english > head && english < body)
  assert.match(page, /APPLE_CARRIER_LITE/)
})

test('no project file still contains the "Treat any third-party IMEI report" wording', () => {
  const hits: string[] = []
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (['node_modules', '.git', '.next', 'tests'].includes(name)) continue
      const p = join(dir, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (/\.(ts|tsx|md|json|mjs)$/.test(name) && readFileSync(p, 'utf8').includes('Treat any third-party IMEI report')) hits.push(p)
    }
  }
  walk(process.cwd())
  assert.deepEqual(hits, [])
})
