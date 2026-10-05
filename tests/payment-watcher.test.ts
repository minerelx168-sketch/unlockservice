import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'

/*
 * The payment watcher against a simulated BNB Smart Chain JSON-RPC and a
 * simulated TronGrid, served from memory through a stubbed fetch. Every
 * path runs end to end: scan → code match → attach → verify → credit.
 */

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-payment-watcher-'))
const wallet = '0x1111111111111111111111111111111111111111'
const stranger = '0x2222222222222222222222222222222222222222'
const bscUsd = '0x55d398326f99059ff775485246999027b3197955'
const tronWallet = 'TBXSw8fM4jpQkGc6zZjsVABFpVN7UvXPdV'
const tronUsdt = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
const tronUsdtHex = 'a614f803b6fd780986a42c78ec9c7f77e6ded13c'
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

process.env.IUNLOCKMOBILE_DB = join(workDir, 'watcher.db')
process.env.IUNLOCKMOBILE_TOPUP_ENABLED = '1'
process.env.IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS = wallet
process.env.IUNLOCKMOBILE_TRON_RECEIVING_ADDRESS = tronWallet
process.env.IUNLOCKMOBILE_TOPUP_TRC20_USDT_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_BEP20_USDC_ENABLED = '0'
process.env.IUNLOCKMOBILE_TOPUP_ERC20_USDT_ENABLED = '0'
process.env.IUNLOCKMOBILE_TOPUP_ERC20_USDC_ENABLED = '0'
process.env.IUNLOCKMOBILE_PAYMENT_WATCHER = '1'
process.env.IUNLOCKMOBILE_TRONGRID_API_KEY = 'test-trongrid-key'
process.env.IUNLOCKMOBILE_BSC_CONFIRMATIONS = '3'
process.env.IUNLOCKMOBILE_TRON_CONFIRMATIONS = '3'
delete process.env.IUNLOCKMOBILE_REQUIRE_EMAIL_VERIFICATION

/* ---- simulated chains ------------------------------------------------------- */

type EvmLog = {
  address: string
  topics: string[]
  data: string
  blockNumber: string
  transactionHash: string
  logIndex: string
  removed: boolean
}

const bsc = {
  head: 1_000,
  logs: [] as EvmLog[],
  times: new Map<number, number>(),
  receipts: new Map<string, unknown>(),
  getLogsAnswersNull: false,
  finalizedUnsupported: false,
  /** Ranges wider than this answer with more than the 1 MB the adapter accepts. */
  tooLargeAbove: 0,
}

type TronEntry = {
  transaction_id: string
  block_timestamp: number
  from: string
  to: string
  value: string
  token_info: { address: string; decimals: number }
  blockNumber: number
}

const tron = { head: 5_000, entries: [] as TronEntry[] }
let counter = 0
const hex = (value: number | bigint) => `0x${value.toString(16)}`
const blockHash = (block: number) => `0x${block.toString(16).padStart(64, '0')}`
const topic = (address: string) => `0x${address.slice(2).toLowerCase().padStart(64, '0')}`

/** One transaction carrying several BEP-20 transfers into the wallet (an exchange batch). */
function sendBscBatch(rawAmounts: bigint[]): string {
  counter += 1
  const txHash = `0x${counter.toString(16).padStart(64, 'e')}`
  const block = bsc.head + 1
  const logs = rawAmounts.map((rawAmount, index) => ({
    address: bscUsd,
    topics: [transferTopic, topic(stranger), topic(wallet)],
    data: hex(rawAmount),
    blockNumber: hex(block),
    transactionHash: txHash,
    logIndex: hex(index),
    removed: false,
  }))
  bsc.logs.push(...logs)
  bsc.receipts.set(txHash, { status: '0x1', blockNumber: hex(block), blockHash: blockHash(block), transactionHash: txHash, logs })
  bsc.times.set(block, Math.floor(Date.now() / 1_000) + 2)
  bsc.head = block
  return txHash
}

/** A BEP-20 transfer into the wallet; the block lands `secondsFromNow` from now (default: a moment later). */
function sendBsc(rawAmount: bigint, options: { to?: string; secondsFromNow?: number } = {}): string {
  counter += 1
  const txHash = `0x${counter.toString(16).padStart(64, 'b')}`
  const block = bsc.head + 1
  const log: EvmLog = {
    address: bscUsd,
    topics: [transferTopic, topic(stranger), topic(options.to ?? wallet)],
    data: hex(rawAmount),
    blockNumber: hex(block),
    transactionHash: txHash,
    logIndex: '0x0',
    removed: false,
  }
  bsc.logs.push(log)
  bsc.receipts.set(txHash, { status: '0x1', blockNumber: hex(block), blockHash: blockHash(block), transactionHash: txHash, logs: [log] })
  bsc.times.set(block, Math.floor(Date.now() / 1_000) + (options.secondsFromNow ?? 2))
  bsc.head = block
  return txHash
}

function sendTron(rawAmount: bigint, options: { secondsFromNow?: number; extraMs?: number } = {}): string {
  counter += 1
  const txId = counter.toString(16).padStart(64, 'c')
  tron.head += 1
  tron.entries.push({
    transaction_id: txId,
    block_timestamp: Date.now() + (options.secondsFromNow ?? 2) * 1_000 + (options.extraMs ?? 0),
    from: 'TXYZopYRdj2D9XRtbG411XZZ3kM5VkAeBf',
    to: tronWallet,
    value: rawAmount.toString(),
    token_info: { address: tronUsdt, decimals: 6 },
    blockNumber: tron.head,
  })
  return txId
}

function mine(blocks = 10) {
  bsc.head += blocks
  tron.head += blocks
}

function json(payload: unknown) {
  return new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })
}

const originalFetch = globalThis.fetch
globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)

  if (url.hostname === 'api.trongrid.io') {
    if (url.pathname.startsWith('/v1/accounts/')) {
      const min = Number(url.searchParams.get('min_timestamp') ?? 0)
      const limit = Number(url.searchParams.get('limit') ?? 200)
      const offset = Number(url.searchParams.get('fingerprint') ?? 0)
      const all = tron.entries
        .filter((entry) => entry.block_timestamp >= min && url.pathname.includes(entry.to))
        .sort((a, b) => a.block_timestamp - b.block_timestamp)
      const data = all.slice(offset, offset + limit).map((entry) => ({ ...entry, blockNumber: undefined }))
      const more = offset + limit < all.length
      return json({ data, success: true, meta: { page_size: data.length, ...(more ? { fingerprint: String(offset + limit) } : {}) } })
    }
    if (url.pathname === '/wallet/gettransactioninfobyid') {
      const { value } = JSON.parse(String(init?.body)) as { value: string }
      const entry = tron.entries.find((candidate) => candidate.transaction_id === value)
      if (!entry) return json({})
      const config = await import('../lib/payment-config')
      const entries = tron.entries.filter((candidate) => candidate.transaction_id === value)
      return json({
        id: entry.transaction_id,
        blockNumber: entry.blockNumber,
        blockTimeStamp: entry.block_timestamp,
        receipt: { result: 'SUCCESS' },
        log: entries.map((item) => ({
            address: tronUsdtHex,
            topics: [
              transferTopic.slice(2),
              '0'.repeat(64),
              config.tronAddressToHex20(item.to)!.slice(2).padStart(64, '0'),
            ],
            data: BigInt(item.value).toString(16).padStart(64, '0'),
          })),
      })
    }
    if (url.pathname === '/walletsolidity/getnowblock') {
      return json({ block_header: { raw_data: { number: tron.head } } })
    }
    return json({ Error: 'unsupported' })
  }

  if (url.hostname === 'bsc-dataseed.bnbchain.org') {
    const { id, method, params } = JSON.parse(String(init?.body)) as { id: number; method: string; params: unknown[] }
    let result: unknown
    if (method === 'eth_chainId') result = '0x38'
    else if (method === 'eth_blockNumber') result = hex(bsc.head)
    else if (method === 'eth_getLogs') {
      const filter0 = params[0] as { fromBlock: string; toBlock: string }
      const width = Number.parseInt(filter0.toBlock, 16) - Number.parseInt(filter0.fromBlock, 16) + 1
      if (bsc.tooLargeAbove && width > bsc.tooLargeAbove) {
        return new Response(JSON.stringify({ jsonrpc: '2.0', id, result: [], padding: 'x'.repeat(12_100_000) }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      }
      if (bsc.getLogsAnswersNull) result = null
      else {
        const filter = params[0] as { fromBlock: string; toBlock: string; address: string; topics: Array<string | null> }
        const from = Number.parseInt(filter.fromBlock, 16)
        const to = Number.parseInt(filter.toBlock, 16)
        result = bsc.logs.filter((log) => {
          const block = Number.parseInt(log.blockNumber, 16)
          return block >= from && block <= to && log.address === filter.address && log.topics[2] === filter.topics[2]
        })
      }
    } else if (method === 'eth_getBlockByNumber') {
      const tag = String(params[0])
      if (tag === 'finalized' && bsc.finalizedUnsupported) {
        return json({ jsonrpc: '2.0', id, error: { code: -32602, message: 'finalized block unsupported' } })
      }
      const block = tag === 'finalized' ? bsc.head - 3 : tag === 'safe' ? bsc.head - 2 : Number.parseInt(tag, 16)
      result = { number: hex(block), hash: blockHash(block), timestamp: hex(bsc.times.get(block) ?? Math.floor(Date.now() / 1_000)) }
    } else if (method === 'eth_getTransactionReceipt') result = bsc.receipts.get(String(params[0])) ?? null
    else return json({ jsonrpc: '2.0', id, error: { message: `unsupported ${method}` } })
    return json({ jsonrpc: '2.0', id, result })
  }

  return originalFetch(input, init)
}) as typeof fetch

/* ---- app ---------------------------------------------------------------------- */

let auth: typeof import('../lib/auth')
let credits: typeof import('../lib/credits')
let database: typeof import('../lib/db')
let payments: typeof import('../lib/payments')
let verification: typeof import('../lib/payment-verification')
let watcher: typeof import('../lib/payment-watcher')
let codes: typeof import('../lib/payment-codes')
let users = 0

function newUser() {
  users += 1
  return auth.register(`watcher${users}`, `watcher${users}@example.test`, 'correct-horse-battery-staple')
}

/** A request created a minute ago, the way a customer opens one before going to their exchange. */
function request(userId: number, routeId: string, cents: number) {
  const invoice = payments.createInvoice(userId, routeId, cents)
  database.db().prepare(`UPDATE invoices SET created_at = datetime('now', '-60 seconds') WHERE reference = ?`).run(invoice.reference)
  return payments.getInvoice(invoice.reference, userId)!
}

const bscRaw = (e4: number) => BigInt(e4) * 10n ** 14n
const tronRaw = (e4: number) => BigInt(e4) * 100n

before(async () => {
  database = await import('../lib/db')
  auth = await import('../lib/auth')
  credits = await import('../lib/credits')
  payments = await import('../lib/payments')
  verification = await import('../lib/payment-verification')
  watcher = await import('../lib/payment-watcher')
  codes = await import('../lib/payment-codes')
  database.db()
})

after(() => {
  globalThis.fetch = originalFetch
  rmSync(workDir, { recursive: true, force: true })
})

async function scan() {
  const summary = await watcher.scanPaymentWallets()
  assert.equal(summary.errors, 0, JSON.stringify(summary))
  return summary
}

/* ---- tests -------------------------------------------------------------------- */

test('every request asks for a coded amount, unique among open requests near it on the same route', () => {
  const seen = new Set<number>()
  for (let index = 0; index < 12; index += 1) {
    const invoice = payments.createInvoice(newUser().id, 'bsc-usdt-peg', 2500)
    assert.ok(invoice.payment_amount_e4! > 250_000 && invoice.payment_amount_e4! < 250_100)
    seen.add(codes.paymentCode(invoice.payment_amount_e4!))
  }
  assert.equal(seen.size, 12)
})
test('watcher refuses to scan until an operator explicitly enables it', async () => {
  process.env.IUNLOCKMOBILE_PAYMENT_WATCHER = '0'
  try {
    const result = await watcher.scanPaymentWallets()
    assert.deepEqual(result, { enabled: false, routes: [], errors: 0 })
    assert.equal(watcher.watchableRoute({ providerMode: 'bnb_rpc' }), false)
  } finally {
    process.env.IUNLOCKMOBILE_PAYMENT_WATCHER = '1'
  }
})

test('a BEP-20 transfer carrying the code is credited with nothing pasted', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 2500)
  sendBsc(bscRaw(invoice.payment_amount_e4!))
  mine()
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
  assert.equal(credits.getBalance(user.id).creditCents, 2500)
  const view = verification.getInvoiceVerification(invoice.reference, user.id)!
  assert.equal(view.status, 'verified')

  await scan()
  assert.equal(credits.getBalance(user.id).creditCents, 2500, 'scanning again never credits twice')
})
test('a $1 BEP-20 transfer below the dust floor after a small withdrawal fee matches only its open coded request', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 100)
  const paid = sendBsc(bscRaw(invoice.payment_amount_e4! - 100)) // 0.01 token fee, code unchanged
  const unrelatedDust = sendBsc(bscRaw(invoice.payment_amount_e4! - 1_000)) // same code, beyond allowed shortfall
  mine()
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
  assert.equal(credits.getBalance(user.id).creditCents, 100)
  assert.equal(verification.getInvoiceVerification(invoice.reference, user.id)!.status, 'verified')
  const transferCount = database.db().prepare('SELECT COUNT(*) AS count FROM chain_transfers WHERE tx_hash = ?')
  assert.equal((transferCount.get(paid) as { count: number }).count, 1)
  assert.equal((transferCount.get(unrelatedDust) as { count: number }).count, 0)
  await scan()
  assert.equal(credits.getBalance(user.id).creditCents, 100, 'the credited transfer is never applied twice')
})
test('BSC first scan stays in the free-tier log-query budget without skipping later blocks', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 2700)
  mine(5_000) // force a true 4,800-block initial lookback, not the test's small initial head
  sendBsc(bscRaw(invoice.payment_amount_e4!))
  mine()
  database.db().prepare("UPDATE payment_watch_cursors SET last_block = NULL WHERE route_id = 'bsc-usdt-peg'").run()
  let logCalls = 0
  const original = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (typeof init?.body === 'string' && init.body.includes('eth_getLogs')) logCalls += 1
    return original(input, init)
  }) as typeof fetch
  try {
    const first = await watcher.scanPaymentRoute('bsc-usdt-peg', { force: true })
    assert.equal(first.status, 'ok')
    assert.equal(logCalls, 1, 'a 2,000-block log query uses the whole per-route scan budget')
    assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending')
    for (let i = 0; i < 4 && payments.getInvoice(invoice.reference, user.id)!.status !== 'success'; i += 1) {
      const next = await watcher.scanPaymentRoute('bsc-usdt-peg', { force: true })
      assert.equal(next.status, 'ok')
    }
  } finally {
    globalThis.fetch = original
  }
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
  assert.equal(credits.getBalance(user.id).creditCents, 2700)
})

test('a TRC-20 transfer carrying the code is credited with nothing pasted', async () => {
  const user = newUser()
  const invoice = request(user.id, 'usdt-trc20', 1800)
  sendTron(tronRaw(invoice.payment_amount_e4!))
  mine(20)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
  assert.equal(credits.getBalance(user.id).creditCents, 1800)
})
test('a $1 TRC-20 transfer below the dust floor after a small withdrawal fee matches its coded request', async () => {
  const user = newUser()
  const invoice = request(user.id, 'usdt-trc20', 100)
  sendTron(tronRaw(invoice.payment_amount_e4! - 100))
  mine(20)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
  assert.equal(credits.getBalance(user.id).creditCents, 100)
})

test('a transfer is not attached until it is past the confirmation threshold, then credited', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 1200)
  sendBsc(bscRaw(invoice.payment_amount_e4!))
  mine(1)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending', 'not yet past the safe head')

  mine(10)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
})

test('a transfer without the code waits in the admin list; pasting it sends it to a person, not to credit', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 3000)
  const txHash = sendBsc(bscRaw(300_000)) // rounded to 30.00
  mine()
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending')
  const listed = watcher.unmatchedTransfers().rows.find((row) => row.tx_hash === txHash)!
  assert.ok(listed.candidates.some((candidate) => candidate.reference === invoice.reference))

  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'manual_review')
  assert.equal(verification.getInvoiceVerification(invoice.reference, user.id)!.verified_credit_cents, 3000)
  assert.equal(credits.getBalance(user.id).creditCents, 0)
  assert.ok(!watcher.unmatchedTransfers().rows.some((row) => row.tx_hash === txHash), 'once pasted it lives in the review queue only')
})

test('a request opened after the money moved can never catch it', async () => {
  const victimTx = sendBsc(bscRaw(520_042), { secondsFromNow: -5 })
  mine()
  await scan()
  const hunter = newUser()
  for (const cents of [5000, 5100, 5200, 5300, 5400]) payments.createInvoice(hunter.id, 'bsc-usdt-peg', cents)
  await scan()
  watcher.matchRecordedTransfers()
  assert.equal(credits.getBalance(hunter.id).creditCents, 0)
  const row = watcher.unmatchedTransfers().rows.find((entry) => entry.tx_hash === victimTx)!
  assert.equal(row.candidates.length, 0)
})

test('a coded transfer pasted on the wrong request is handed to the request whose code it carries', async () => {
  const owner = newUser()
  const ownerInvoice = request(owner.id, 'bsc-usdt-peg', 4400)
  const txHash = sendBsc(bscRaw(ownerInvoice.payment_amount_e4!))
  const thief = newUser()
  const thiefInvoice = request(thief.id, 'bsc-usdt-peg', 4400)
  // Pasted before it is even confirmed, so the watcher has not seen it yet.
  payments.submitPaymentReference(thiefInvoice.reference, thief.id, txHash, '')
  assert.throws(() => payments.submitPaymentReference(ownerInvoice.reference, owner.id, txHash, ''), /already attached/)
  mine()
  await scan() // the watcher sees it is already pasted and leaves it to that check
  // The next check of the pasted hash (the poll timer's) hands it over.
  assert.equal(await verification.verifyInvoiceTransaction(thiefInvoice.reference), 'pending')

  assert.equal(payments.getInvoice(ownerInvoice.reference, owner.id)!.status, 'success')
  assert.equal(credits.getBalance(owner.id).creditCents, 4400)
  const back = payments.getInvoice(thiefInvoice.reference, thief.id)!
  assert.equal(back.status, 'pending')
  assert.match(back.note!, /another payment request/)
  assert.equal(credits.getBalance(thief.id).creditCents, 0)
})

test('an administrator rejecting a pasted transfer releases it for the request it belongs to', async () => {
  const admin = newUser()
  database.db().prepare("UPDATE users SET account_type = 'admin' WHERE id = ?").run(admin.id)
  const owner = newUser()
  const ownerInvoice = request(owner.id, 'bsc-usdt-peg', 3600)
  const txHash = sendBsc(bscRaw(360_000)) // rounded: no code, so nobody owns it automatically
  mine()
  await scan()
  const thief = newUser()
  const thiefInvoice = request(thief.id, 'bsc-usdt-peg', 3600)
  payments.submitPaymentReference(thiefInvoice.reference, thief.id, txHash, '')
  assert.equal(await verification.verifyInvoiceTransaction(thiefInvoice.reference), 'manual_review')

  await verification.decideInvoiceVerification(admin.id, {
    invoiceReference: thiefInvoice.reference,
    decision: 'reject',
    reason: 'Not this customer’s transfer',
    idempotencyKey: 'reject-thief-0001',
  })
  // The owner can now paste it; a person then confirms the rounded amount.
  payments.submitPaymentReference(ownerInvoice.reference, owner.id, txHash, '')
  assert.equal(await verification.verifyInvoiceTransaction(ownerInvoice.reference), 'manual_review')
  await verification.decideInvoiceVerification(admin.id, {
    invoiceReference: ownerInvoice.reference,
    decision: 'approve',
    reason: 'Rounded payment from the owner',
    idempotencyKey: 'approve-owner-0001',
  })
  assert.equal(credits.getBalance(owner.id).creditCents, 3600)
  assert.equal(credits.getBalance(thief.id).creditCents, 0)
})

test('zero-value and dust transfers are never recorded', async () => {
  for (let index = 0; index < 5; index += 1) sendBsc(0n)
  sendBsc(bscRaw(5_000)) // 0.5
  const real = sendBsc(bscRaw(420_000))
  mine()
  await scan()
  const { rows } = watcher.unmatchedTransfers()
  assert.ok(rows.some((row) => row.tx_hash === real))
  assert.ok(rows.every((row) => row.amount_e4 >= codes.DUST_FLOOR_E4))
})

test('a node that answers eth_getLogs with null stops the scan instead of skipping blocks', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 1300)
  sendBsc(bscRaw(invoice.payment_amount_e4!))
  mine()
  bsc.getLogsAnswersNull = true
  try {
    const result = await watcher.scanPaymentRoute('bsc-usdt-peg', { force: true })
    assert.equal(result.status, 'error')
  } finally {
    bsc.getLogsAnswersNull = false
  }
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success', 'the blocks were read on the next scan')
})

test('one account cannot hold more than five open requests', () => {
  const user = newUser()
  for (const cents of [1000, 1100, 1200, 1300, 1400]) payments.createInvoice(user.id, 'bsc-usdt-peg', cents)
  assert.throws(() => payments.createInvoice(user.id, 'bsc-usdt-peg', 1500), /5 payment requests waiting/)
  assert.ok(payments.createInvoice(user.id, 'bsc-usdt-peg', 1200), 'reopening one of them is fine')
})

test('unpaid coded requests close after the payment window and grace day', async () => {
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'bsc-usdt-peg', 2200)
  database.db().prepare(`UPDATE invoices SET created_at = datetime('now', '-9 days') WHERE reference = ?`).run(invoice.reference)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'failed')
})

test('a customer watching their request triggers a scan; scans never overlap', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 1700)
  sendBsc(bscRaw(invoice.payment_amount_e4!))
  mine()
  database.db().prepare(`UPDATE payment_watch_cursors SET last_scan_at = NULL WHERE route_id = 'bsc-usdt-peg'`).run()
  await watcher.nudgeInvoicePayment(invoice.reference)
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')

  const [first, second] = await Promise.all([
    watcher.scanPaymentRoute('bsc-usdt-peg', { force: true }),
    watcher.scanPaymentRoute('bsc-usdt-peg', { force: true }),
  ])
  assert.deepEqual([first.status, second.status].sort(), ['busy', 'ok'])
})

test('a range made too large by spam is read in narrower pieces instead of stalling', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 1900)
  sendBsc(bscRaw(invoice.payment_amount_e4!))
  mine()
  bsc.tooLargeAbove = 100
  try {
    await scan()
  } finally {
    bsc.tooLargeAbove = 0
  }
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
})

test('a busy TRON wallet is read to the end across scans, never re-reading the same pages forever', async () => {
  const user = newUser()
  const invoice = request(user.id, 'usdt-trc20', 2100)
  // Spread over a few seconds, the way they would land in successive blocks.
  for (let index = 0; index < 1_100; index += 1) sendTron(tronRaw(20_000 + index * 100), { extraMs: index * 3 })
  sendTron(tronRaw(invoice.payment_amount_e4!), { secondsFromNow: 6 })
  mine(20)
  for (let index = 0; index < 60; index += 1) {
    const result = await watcher.scanPaymentRoute('usdt-trc20', { force: true })
    assert.equal(result.status, 'ok')
  }
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
})
test('TRON resumes its fingerprint when more than a thousand transfers share a timestamp', async () => {
  const user = newUser()
  const invoice = request(user.id, 'usdt-trc20', 3100)
  const sharedTimestamp = Date.now() + 12_000
  // Move past previous synthetic transactions, but never advance across this batch.
  database.db().prepare(
    "UPDATE payment_watch_cursors SET last_time_ms = ?, resume_from_ms = ?, resume_fingerprint = NULL WHERE route_id = 'usdt-trc20'",
  ).run(sharedTimestamp, sharedTimestamp)
  for (let index = 0; index < 1_100; index += 1) {
    sendTron(tronRaw(20_000 + index * 100))
    tron.entries.at(-1)!.block_timestamp = sharedTimestamp
  }
  sendTron(tronRaw(invoice.payment_amount_e4!))
  tron.entries.at(-1)!.block_timestamp = sharedTimestamp
  mine(20)
  assert.equal((await watcher.scanPaymentRoute('usdt-trc20', { force: true })).status, 'ok')
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending')
  const paused = database.db().prepare(
    "SELECT resume_fingerprint FROM payment_watch_cursors WHERE route_id = 'usdt-trc20'",
  ).get() as { resume_fingerprint: string | null }
  assert.ok(paused.resume_fingerprint, 'pagination state persists between runs')
  let completedPagination = false
  for (let index = 0; index < 60; index += 1) {
    const result = await watcher.scanPaymentRoute('usdt-trc20', { force: true })
    assert.equal(result.status, 'ok')
    const row = database.db().prepare("SELECT resume_fingerprint FROM payment_watch_cursors WHERE route_id='usdt-trc20'")
      .get() as { resume_fingerprint: string | null }
    if (row.resume_fingerprint === null) { completedPagination = true; break }
  }
  assert.ok(completedPagination, 'fingerprint eventually reaches the final page without skipping tied timestamps')
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
  assert.equal(credits.getBalance(user.id).creditCents, 3100)
  const completed = database.db().prepare(
    "SELECT resume_fingerprint FROM payment_watch_cursors WHERE route_id = 'usdt-trc20'",
  ).get() as { resume_fingerprint: string | null }
  assert.equal(completed.resume_fingerprint, null)
})

test('an open page does not turn a hash that never appears into a stream of provider calls', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 2300)
  payments.submitPaymentReference(invoice.reference, user.id, `0x${'d0'.repeat(32)}`, '')
  assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'pending')
  let lookups = 0
  const counting = globalThis.fetch
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    if (typeof init?.body === 'string' && init.body.includes('eth_getTransactionReceipt')) lookups += 1
    return counting(input, init)
  }) as typeof fetch
  try {
    for (let index = 0; index < 4; index += 1) await watcher.nudgeInvoicePayment(invoice.reference)
  } finally {
    globalThis.fetch = counting
  }
  assert.equal(lookups, 0, 'the poll back-off still applies')
})

test('codes used by long-closed requests are never reused; exhaustion requires a human', () => {
  for (let index = 0; index < 99; index += 1) {
    database.db().prepare(
      `INSERT INTO invoices (reference, user_id, gateway, credit_amount_cents, total_due_cents, status,
                             payment_route_id, payment_amount_e4, created_at)
       VALUES (?, 1, 'usdt-trc20', 7700, 7700, 'success', 'usdt-trc20', ?, datetime('now', '-100 days'))`,
    ).run(`filler-${index}`, 770_000 + index + 1)
  }
  const user = newUser()
  const invoice = payments.createInvoice(user.id, 'usdt-trc20', 7700)
  assert.equal(invoice.payment_amount_e4, null)
  assert.equal(payments.createInvoice(user.id, 'usdt-trc20', 7700).reference, invoice.reference)
})

test('a batched transaction with two wallet transfers never credits either customer through the single-hash path', async () => {
  const a = newUser()
  const b = newUser()
  const invoiceA = request(a.id, 'bsc-usdt-peg', 5000)
  const invoiceB = request(b.id, 'bsc-usdt-peg', 3000)
  const tx = sendBscBatch([bscRaw(invoiceA.payment_amount_e4!), bscRaw(invoiceB.payment_amount_e4!)])
  const thief = newUser()
  const thiefInvoice = request(thief.id, 'bsc-usdt-peg', 5000)
  payments.submitPaymentReference(thiefInvoice.reference, thief.id, tx, '')
  mine()
  await scan()
  assert.equal(await verification.verifyInvoiceTransaction(thiefInvoice.reference), 'manual_review')
  assert.equal(credits.getBalance(thief.id).creditCents, 0)
  assert.equal(credits.getBalance(a.id).creditCents, 0)
  assert.equal(credits.getBalance(b.id).creditCents, 0)
  const rows = database.db().prepare(
    "SELECT id, status FROM chain_transfers WHERE route_id = 'bsc-usdt-peg' AND tx_hash = ? ORDER BY log_index",
  ).all(tx) as Array<{ id: number; status: string }>
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map((row) => row.status), ['unmatched', 'unmatched'])
  const admin = newUser()
  database.db().prepare("UPDATE users SET account_type = 'admin' WHERE id = ?").run(admin.id)
  const decisions = await import('../lib/admin-payment-transfers')
  await assert.rejects(decisions.decideUnmatchedTransfer(admin.id, {
    transferId: rows[0].id, invoiceReference: invoiceA.reference, decision: 'confirm',
    reason: 'Single-hash verification cannot claim two events.', idempotencyKey: 'multi-event-unsafe-confirm',
  }), /multiple wallet transfers/)
  assert.equal(credits.getBalance(a.id).creditCents, 0)
})

test('a pasted transfer older than the request is flagged as outside its window', async () => {
  const user = newUser()
  const txHash = sendBsc(bscRaw(270_000), { secondsFromNow: -300 })
  mine()
  const invoice = request(user.id, 'bsc-usdt-peg', 2700)
  database.db().prepare(`UPDATE invoices SET created_at = datetime('now', '-30 seconds') WHERE reference = ?`).run(invoice.reference)
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'manual_review')
  assert.equal(verification.getInvoiceVerification(invoice.reference, user.id)!.error_code, 'transaction_outside_invoice_window')
})

test('rejecting a transfer the watcher attached puts it back where a person can see it', async () => {
  const admin = newUser()
  database.db().prepare("UPDATE users SET account_type = 'admin' WHERE id = ?").run(admin.id)
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 2800)
  // A fee policy the auto path will not settle sends the attached transfer to a person.
  database.db().prepare('UPDATE invoices SET fee_cents = 1 WHERE reference = ?').run(invoice.reference)
  const txHash = sendBsc(bscRaw(invoice.payment_amount_e4!))
  mine()
  await scan()
  assert.equal(verification.getInvoiceVerification(invoice.reference, user.id)!.status, 'manual_review')
  await verification.decideInvoiceVerification(admin.id, {
    invoiceReference: invoice.reference,
    decision: 'reject',
    reason: 'Fee policy mismatch, refund it',
    idempotencyKey: 'reject-fee-0001',
  })
  const row = database.db().prepare('SELECT status, note FROM chain_transfers WHERE tx_hash = ?').get(txHash) as
    { status: string; note: string | null } | undefined
  assert.equal(row?.status, 'unmatched', 'the transfer is listed again')
  assert.match(row?.note ?? '', /Rejected on payment request/)
})
test('a dismissed on-chain transfer cannot be reattached by watcher or customer', () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 3900)
  const txHash = sendBsc(bscRaw(invoice.payment_amount_e4!))
  mine()
  const inserted = database.db().prepare(
    `INSERT INTO chain_transfers
      (route_id, tx_hash, log_index, block_number, block_time, amount_raw, amount_e4)
     VALUES ('bsc-usdt-peg', ?, 0, ?, ?, ?, ?)`,
  ).run(txHash, bsc.head - 10, new Date(Date.now() + 2_000).toISOString(),
    bscRaw(invoice.payment_amount_e4!).toString(), invoice.payment_amount_e4!)
  watcher.dismissTransfer(Number(inserted.lastInsertRowid), 'Refunded after checking the chain')
  assert.throws(() => verification.attachDetectedTransfer(invoice.reference, txHash), /dismissed/)
  assert.throws(() => payments.submitPaymentReference(invoice.reference, user.id, txHash, ''), /dismissed/)
  assert.deepEqual(watcher.matchRecordedTransfers('bsc-usdt-peg'), [])
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending')
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})
test('failed attach rolls back its claimed transfer row instead of leaving a matched orphan', () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 4700)
  const txHash = sendBsc(bscRaw(invoice.payment_amount_e4!))
  const inserted = database.db().prepare(
    `INSERT INTO chain_transfers
      (route_id, tx_hash, log_index, block_number, block_time, amount_raw, amount_e4)
     VALUES ('bsc-usdt-peg', ?, 0, ?, ?, ?, ?)`,
  ).run(txHash, bsc.head, new Date(Date.now() + 2_000).toISOString(),
    bscRaw(invoice.payment_amount_e4!).toString(), invoice.payment_amount_e4!)
  process.env.IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED = '0'
  try {
    assert.deepEqual(watcher.matchRecordedTransfers('bsc-usdt-peg'), [])
  } finally {
    process.env.IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED = '1'
  }
  const row = database.db().prepare('SELECT status, invoice_reference FROM chain_transfers WHERE id = ?')
    .get(Number(inserted.lastInsertRowid)) as { status: string; invoice_reference: string | null }
  assert.equal(row.status, 'unmatched')
  assert.equal(row.invoice_reference, null)
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})

// An unmatched transfer is public-chain data, not proof that any particular
// user owns it. Even a nearby amount must be independently verified first.
test('admin Confirm validates a finalized uncoded transfer, then requires invoice review before exactly-once credit', async () => {
  const decisions = await import('../lib/admin-payment-transfers')
  const admin = newUser()
  database.db().prepare("UPDATE users SET account_type = 'admin' WHERE id = ?").run(admin.id)
  const customer = newUser()
  const invoice = request(customer.id, 'bsc-usdt-peg', 3600)
  const tx = sendBsc(bscRaw(360_000)) // rounded amount: no request code
  mine()
  await scan()
  const transfer = database.db().prepare('SELECT id, status FROM chain_transfers WHERE tx_hash = ?').get(tx) as { id: number; status: string }
  assert.equal(transfer.status, 'unmatched')
  const input = {
    transferId: transfer.id, invoiceReference: invoice.reference, decision: 'confirm' as const,
    reason: 'Customer supplied separate evidence for this finalized deposit.', idempotencyKey: 'manual-unmatched-confirm-1',
  }
  await assert.rejects(decisions.decideUnmatchedTransfer(customer.id, input), /Administrator access/)
  const result = await decisions.decideUnmatchedTransfer(admin.id, input)
  assert.equal(result.status, 'review')
  assert.equal(credits.getBalance(customer.id).creditCents, 0, 'choosing a nearby request alone never credits')
  assert.deepEqual(await decisions.decideUnmatchedTransfer(admin.id, input), { replayed: true, status: 'review' })
  assert.equal(verification.getInvoiceVerification(invoice.reference, customer.id)?.error_code, 'amount_without_invoice_code')
  assert.equal((verification.getInvoiceVerification(invoice.reference, customer.id)?.confirmations ?? 0) >= 3, true)
  const row = database.db().prepare('SELECT status, invoice_reference FROM chain_transfers WHERE id = ?').get(transfer.id) as { status: string; invoice_reference: string }
  assert.deepEqual(row, { status: 'matched', invoice_reference: invoice.reference })
  assert.equal((await verification.decideInvoiceVerification(admin.id, {
    invoiceReference: invoice.reference, decision: 'approve', reason: 'Independent customer evidence and finalized receipt match.', idempotencyKey: 'manual-unmatched-approve-1',
  })).replayed, false)
  assert.equal(credits.getBalance(customer.id).creditCents, 3600)
  const effect = database.db().prepare("SELECT COUNT(*) AS n FROM credit_ledger WHERE ref_type = 'invoice' AND ref_id = ? AND type = 'topup'")
    .get(invoice.reference) as { n: number }
  assert.equal(effect.n, 1)
  assert.throws(() => database.db().prepare("UPDATE chain_transfer_admin_events SET reason = 'tampered'").run(), /append-only/)
  assert.throws(() => database.db().prepare('DELETE FROM chain_transfer_admin_events').run(), /append-only/)
})

test('admin Reject and Dismiss are distinct audited decisions; both forbid later attach and double-credit', async () => {
  const decisions = await import('../lib/admin-payment-transfers')
  const admin = newUser()
  database.db().prepare("UPDATE users SET account_type = 'admin' WHERE id = ?").run(admin.id)
  const customer = newUser()
  const invoice = request(customer.id, 'bsc-usdt-peg', 5100)
  for (const decision of ['reject', 'dismiss'] as const) {
    const tx = sendBsc(bscRaw(510_000 + (decision === 'reject' ? 10_000 : 20_000)))
    mine()
    await scan()
    const row = database.db().prepare('SELECT id FROM chain_transfers WHERE tx_hash = ?').get(tx) as { id: number }
    const input = { transferId: row.id, decision, reason: 'Cannot associate this transfer to any verified owner.', idempotencyKey: `admin-${decision}-${row.id}` }
    assert.equal((await decisions.decideUnmatchedTransfer(admin.id, input)).status, 'closed')
    assert.equal((await decisions.decideUnmatchedTransfer(admin.id, input)).replayed, true)
    assert.equal((database.db().prepare('SELECT status FROM chain_transfers WHERE id = ?').get(row.id) as { status: string }).status, 'dismissed')
    await assert.rejects(decisions.decideUnmatchedTransfer(admin.id, { ...input, idempotencyKey: `admin-repeat-${row.id}` }), /already been handled/)
    assert.throws(() => payments.submitPaymentReference(invoice.reference, customer.id, tx, ''), /dismissed/)
  }
  const audit = database.db().prepare("SELECT action FROM chain_transfer_admin_events WHERE admin_user_id = ? ORDER BY id").all(admin.id) as Array<{ action: string }>
  assert.deepEqual(audit.map((row) => row.action), ['reject', 'dismiss'])
  assert.equal(credits.getBalance(customer.id).creditCents, 0)
})

test('admin Confirm fails closed when the receipt amount or finality differs from the recorded transfer', async () => {
  const decisions = await import('../lib/admin-payment-transfers')
  const admin = newUser()
  database.db().prepare("UPDATE users SET account_type = 'admin' WHERE id = ?").run(admin.id)
  const customer = newUser()
  const invoice = request(customer.id, 'bsc-usdt-peg', 5800)
  const tx = sendBsc(bscRaw(580_000))
  mine()
  await scan()
  const row = database.db().prepare('SELECT id FROM chain_transfers WHERE tx_hash = ?').get(tx) as { id: number }
  const original = bsc.head
  const receipt = bsc.receipts.get(tx) as { logs: EvmLog[] }
  bsc.head = Number.parseInt(receipt.logs[0].blockNumber, 16) // only one confirmation
  try {
    await assert.rejects(decisions.decideUnmatchedTransfer(admin.id, {
      transferId: row.id, invoiceReference: invoice.reference, decision: 'confirm',
      reason: 'Not final; this action must not add customer credit.', idempotencyKey: 'admin-unfinalized-1',
    }), /finality|network could not verify/i)
  } finally {
    bsc.head = original
  }
  const beforeAmount = receipt.logs[0].data
  receipt.logs[0].data = hex(bscRaw(580_100))
  try {
    await assert.rejects(decisions.decideUnmatchedTransfer(admin.id, {
      transferId: row.id, invoiceReference: invoice.reference, decision: 'confirm',
      reason: 'Receipt content was altered; fail closed.', idempotencyKey: 'admin-receipt-mismatch-1',
    }), /did not match/)
  } finally {
    receipt.logs[0].data = beforeAmount
  }
  assert.equal(credits.getBalance(customer.id).creditCents, 0)
  assert.equal((database.db().prepare('SELECT status FROM chain_transfers WHERE id = ?').get(row.id) as { status: string }).status, 'unmatched')
})

test('a settled invoice keeps its code quarantined; a later transfer with that code cannot pay a different customer', async () => {
  const decisions = await import('../lib/admin-payment-transfers')
  const admin = newUser()
  database.db().prepare("UPDATE users SET account_type='admin' WHERE id=?").run(admin.id)
  const first = newUser()
  const paid = request(first.id, 'bsc-usdt-peg', 2500)
  sendBsc(bscRaw(paid.payment_amount_e4!))
  mine()
  await scan()
  assert.equal(payments.getInvoice(paid.reference, first.id)?.status, 'success')
  const second = newUser()
  const pending = request(second.id, 'bsc-usdt-peg', 2500)
  assert.notEqual(pending.payment_amount_e4! % 100, paid.payment_amount_e4! % 100)
  const repeated = sendBsc(bscRaw(paid.payment_amount_e4!))
  mine()
  await scan()
  const transfer = database.db().prepare('SELECT id FROM chain_transfers WHERE tx_hash = ?').get(repeated) as { id: number }
  await assert.rejects(decisions.decideUnmatchedTransfer(admin.id, {
    transferId: transfer.id, invoiceReference: pending.reference, decision: 'confirm',
    reason: 'Attempt to associate a previously settled payment code.', idempotencyKey: 'quarantine-admin-1',
  }), /different open request owns this transfer code/)
  payments.submitPaymentReference(pending.reference, second.id, repeated, '')
  assert.equal(await verification.verifyInvoiceTransaction(pending.reference), 'manual_review')
  assert.equal(verification.getInvoiceVerification(pending.reference, second.id)?.error_code, 'transfer_carries_another_request_code')
  assert.equal(credits.getBalance(second.id).creditCents, 0)
})

// Account-history entries have no event index. A transaction may straddle
// TronGrid's page boundary; its receipt must give stable indices on both runs.
test('TRON page boundary keeps both receipt log indices across resumed scans', async () => {
  const user = newUser()
  const invoice = request(user.id, 'usdt-trc20', 9300)
  const timestamp = Date.now() + 9_000
  database.db().prepare(
    "UPDATE payment_watch_cursors SET last_time_ms=?, resume_from_ms=?, resume_fingerprint=NULL WHERE route_id='usdt-trc20'",
  ).run(timestamp, timestamp)
  for (let index = 0; index < 19; index += 1) {
    sendTron(tronRaw(20_000 + index * 100))
    tron.entries.at(-1)!.block_timestamp = timestamp
  }
  const first = sendTron(tronRaw(22_345))
  tron.entries.at(-1)!.block_timestamp = timestamp
  const firstBlock = tron.entries.at(-1)!.blockNumber
  sendTron(tronRaw(invoice.payment_amount_e4!))
  tron.entries.at(-1)!.block_timestamp = timestamp
  tron.entries.at(-1)!.blockNumber = firstBlock
  tron.entries.at(-1)!.transaction_id = first
  mine(20)
  assert.equal((await watcher.scanPaymentRoute('usdt-trc20', { force: true })).status, 'ok')
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending', 'a multi-event transaction must not credit just one log')
  for (let index = 0; index < 3; index += 1) {
    const result = await watcher.scanPaymentRoute('usdt-trc20', { force: true })
    assert.equal(result.status, 'ok')
  }
  const rows = database.db().prepare(
    "SELECT log_index, status FROM chain_transfers WHERE route_id='usdt-trc20' AND tx_hash=? ORDER BY log_index",
  ).all(first) as Array<{ log_index: number; status: string }>
  assert.deepEqual(rows.map((row) => row.log_index), [0, 1])
  assert.deepEqual(rows.map((row) => row.status), ['unmatched', 'unmatched'])
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})

// Depth behind eth_blockNumber is not a canonical/finalized proof. Neither an
// unsupported finalized tag nor a receipt from a different block may credit.
test('BSC finalized tag unavailable fails closed without customer credit', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 8400)
  sendBsc(bscRaw(invoice.payment_amount_e4!))
  mine(20)
  bsc.finalizedUnsupported = true
  try {
    const result = await watcher.scanPaymentRoute('bsc-usdt-peg', { force: true })
    assert.equal(result.status, 'error')
  } finally {
    bsc.finalizedUnsupported = false
  }
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending')
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})

test('BSC receipt block hash differing from canonical block never credits', async () => {
  const user = newUser()
  const invoice = request(user.id, 'bsc-usdt-peg', 8500)
  const hash = sendBsc(bscRaw(invoice.payment_amount_e4!))
  mine(20)
  const receipt = bsc.receipts.get(hash) as { blockHash: string }
  const valid = receipt.blockHash
  receipt.blockHash = `0x${'f'.repeat(64)}`
  try {
    await scan()
    assert.notEqual(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
    assert.equal(credits.getBalance(user.id).creditCents, 0)
  } finally {
    receipt.blockHash = valid
  }
})
