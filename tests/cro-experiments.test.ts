import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'
import {
  EXPERIMENT_IDS, MIN_SESSIONS_PER_ARM, allVariants, applyOrderBump, bucket, detectAiReferral, experimentStatus,
  parseOverrides, parseVariantSummary, twoProportionZTest, variantFor, variantSummary, validVisitorId,
} from '../lib/cro/experiments'
import { PHASE2_KEYS, p2, phase2Translations } from '../lib/i18n/phase2'

const directory = mkdtempSync(join(tmpdir(), 'cro-report-'))
process.env.IUNLOCKMOBILE_DB = join(directory, 'cro.db')
let connection: ReturnType<typeof import('../lib/db').db>
let store: typeof import('../lib/cro/store')
before(async () => { connection = (await import('../lib/db')).db(); store = await import('../lib/cro/store') })
after(() => { connection.close(); rmSync(directory, { recursive: true, force: true }) })

const visitor = (n: number) => n.toString(16).padStart(32, '0')

test('bucketing is deterministic per visitor and experiment', () => {
  const id = 'a'.repeat(32)
  for (const experiment of EXPERIMENT_IDS) assert.equal(bucket(id, experiment), bucket(id, experiment))
  assert.equal(variantFor(null, 'CRO-01'), 'A')
  assert.equal(validVisitorId('A'.repeat(32)), null)
  assert.equal(validVisitorId('0123456789abcdef0123456789abcdef'), '0123456789abcdef0123456789abcdef')
})

test('each of CRO-01..05 splits close to 50:50 and the experiments are independent', () => {
  const n = 20000
  for (const experiment of EXPERIMENT_IDS) {
    let b = 0
    for (let i = 0; i < n; i++) if (bucket(visitor(i * 7919 + 13), experiment) === 'B') b++
    assert.ok(Math.abs(b / n - 0.5) < 0.02, `${experiment} B share ${b / n}`)
  }
  let same = 0
  for (let i = 0; i < n; i++) if (bucket(visitor(i), 'CRO-01') === bucket(visitor(i), 'CRO-05')) same++
  assert.ok(Math.abs(same / n - 0.5) < 0.03, `correlated arms ${same / n}`)
})

test('NEXT_PUBLIC_CRO_OVERRIDES forces winners and ignores junk', () => {
  const overrides = parseOverrides('{"CRO-01":"variant","CRO-05":"variant","CRO-03":"off","CRO-99":"variant","CRO-02":7}')
  assert.deepEqual(overrides, { 'CRO-01': 'B', 'CRO-05': 'B', 'CRO-03': 'A' })
  assert.deepEqual(parseOverrides('not json'), {})
  for (let i = 0; i < 50; i++) {
    assert.equal(variantFor(visitor(i), 'CRO-01', overrides), 'B')
    assert.equal(variantFor(visitor(i), 'CRO-03', overrides), 'A')
  }
})

test('variant summary round-trips into checkout metadata format', () => {
  const summary = variantSummary(allVariants(visitor(42)))
  assert.match(summary, /^CRO-01:[AB],CRO-02:[AB],CRO-03:[AB],CRO-04:[AB],CRO-05:[AB]$/)
  assert.deepEqual(Object.keys(parseVariantSummary(summary)), EXPERIMENT_IDS)
  assert.deepEqual(parseVariantSummary('CRO-01:B,bogus,CRO-02:Z'), { 'CRO-01': 'B' })
})

test('CRO-05 swaps 444 Lite to 445 Pro only for variant B with the box ticked', () => {
  assert.deepEqual(applyOrderBump('APPLE_CARRIER_LITE', true, 'B'), { productCode: 'APPLE_CARRIER_PRO', bumped: true })
  assert.deepEqual(applyOrderBump('APPLE_CARRIER_LITE', true, 'A'), { productCode: 'APPLE_CARRIER_LITE', bumped: false })
  assert.deepEqual(applyOrderBump('APPLE_CARRIER_LITE', false, 'B'), { productCode: 'APPLE_CARRIER_LITE', bumped: false })
  assert.deepEqual(applyOrderBump('UNLOCK_346', true, 'B'), { productCode: 'UNLOCK_346', bumped: false })
})

test('two-proportion z-test matches a hand-computed value', () => {
  // A: 20/1000, B: 40/1000. pooled 0.03, se = sqrt(.03*.97*.002) = 0.0076289; z = 2.6216
  const { z, p } = twoProportionZTest(20, 1000, 40, 1000)
  assert.ok(Math.abs(z - 2.6216) < 1e-3, String(z))
  assert.ok(Math.abs(p - 0.00875) < 2e-4, String(p))
  assert.deepEqual(twoProportionZTest(0, 0, 1, 10), { z: 0, p: 1 })
  assert.deepEqual(twoProportionZTest(0, 100, 0, 100), { z: 0, p: 1 })
  assert.ok(twoProportionZTest(40, 1000, 20, 1000).z < 0)
})

test('status: sample floor, then winners at p < 0.05', () => {
  assert.equal(experimentStatus(MIN_SESSIONS_PER_ARM - 1, 5000, 5, 0.0001), 'collecting_sample')
  assert.equal(experimentStatus(300, 300, 2.5, 0.01), 'significant_winner_B')
  assert.equal(experimentStatus(300, 300, -2.5, 0.01), 'significant_winner_A')
  assert.equal(experimentStatus(300, 300, 1, 0.3), 'inconclusive')
})

test('AI referrals are recognised by referrer host or utm_source only', () => {
  assert.equal(detectAiReferral('https://chatgpt.com/', null), 'chatgpt')
  assert.equal(detectAiReferral(null, 'perplexity'), 'perplexity')
  assert.equal(detectAiReferral('https://claude.ai/chat/x', null), 'claude')
  assert.equal(detectAiReferral('https://copilot.microsoft.com', null), 'copilot')
  assert.equal(detectAiReferral('https://gemini.google.com/app', null), 'gemini')
  assert.equal(detectAiReferral('https://www.google.com/', 'newsletter'), null)
  assert.equal(detectAiReferral('https://evilchatgpt.com.example/', null), null)
})

test('every phase-2 UI string is translated into all five languages with its placeholders', () => {
  for (const key of PHASE2_KEYS) {
    const placeholders = (key.match(/\{\w+\}/g) ?? []).sort()
    for (const value of phase2Translations(key)) {
      assert.ok(value.trim().length > 0, key)
      assert.deepEqual((value.match(/\{\w+\}/g) ?? []).sort(), placeholders, `${key} -> ${value}`)
    }
  }
  // Long sentences must actually be translated, not copied from English.
  for (const key of PHASE2_KEYS.filter((k) => k.split(' ').length > 6)) for (const value of phase2Translations(key)) assert.notEqual(value, key)
  assert.equal(p2('es', 'Check locked carrier ({price})', { price: '$1.70' }), 'Ver operador bloqueado ($1.70)')
})

test('the CRO report counts exposed visitors, verified purchases and gross profit per arm', () => {
  const db = connection
  const insertGuest = db.prepare(`INSERT INTO guest_checkouts (reference,request_key,email,product_code,product_name,imei_encrypted,price_cents,fee_cents,account_id,product_id,environment,state,paid_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  const variants = (v: 'A' | 'B') => `CRO-01:${v},CRO-02:A,CRO-03:A,CRO-04:A,CRO-05:${v}`
  for (let i = 0; i < 300; i++) {
    store.recordExposure(visitor(i), 'CRO-05', 'A')
    store.recordExposure(visitor(10_000 + i), 'CRO-05', 'B')
  }
  assert.equal(store.recordExposure(visitor(1), 'CRO-05', 'A'), false, 'repeat exposure is ignored')
  // A: 3 checkouts, 2 paid Lite. B: 4 checkouts, 3 paid Pro (one bumped), 1 refunded.
  const orders: Array<[number, 'A' | 'B', string, number, string, string | null, boolean]> = [
    [0, 'A', 'APPLE_CARRIER_LITE', 170, 'paid', '2026-11-13 10:00:00', false],
    [1, 'A', 'APPLE_CARRIER_LITE', 170, 'completed', '2026-11-13 10:00:00', false],
    [2, 'A', 'APPLE_CARRIER_LITE', 170, 'pending', null, false],
    [10_000, 'B', 'APPLE_CARRIER_PRO', 295, 'paid', '2026-11-13 10:00:00', true],
    [10_001, 'B', 'APPLE_CARRIER_PRO', 295, 'completed', '2026-11-13 10:00:00', false],
    [10_002, 'B', 'APPLE_CARRIER_PRO', 295, 'paid', '2026-11-13 10:00:00', false],
    [10_003, 'B', 'APPLE_CARRIER_PRO', 295, 'refunded', '2026-11-13 10:00:00', false],
  ]
  orders.forEach(([n, arm, code, price, state, paidAt, bump], index) => {
    const reference = index.toString(16).padStart(32, 'f')
    insertGuest.run(reference, `key-${index}`.padEnd(32, '0'), 'buyer@example.com', code, code, 'x', price, 0, 'acct', 'prod', 'sandbox', state, paidAt)
    store.recordCheckout({ reference, visitor: visitor(n), variants: variants(arm), productCode: code, orderBump: bump })
  })
  const report = store.croReport().find((row) => row.experiment_id === 'CRO-05')!
  assert.equal(report.A.exposures, 300)
  assert.equal(report.B.exposures, 300)
  assert.equal(report.A.begin_checkout, 3)
  assert.equal(report.B.begin_checkout, 4)
  assert.equal(report.A.verified_purchases, 2)
  assert.equal(report.B.verified_purchases, 3)
  assert.equal(report.B.order_bumps_accepted, 1)
  assert.equal(report.A.gross_profit_usd, 3.32) // 2 × (1.70 − 0.04)
  assert.equal(report.B.gross_profit_usd, 8.61) // 3 × (2.95 − 0.08)
  assert.equal(report.A.paid_cvr_pct, 0.667)
  assert.equal(report.status, 'inconclusive')
  assert.equal(store.croReport().find((row) => row.experiment_id === 'CRO-02')!.status, 'collecting_sample')
})
