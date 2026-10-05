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
  bsc.receipts.set(txHash, { status: '0x1', blockNumber: hex(block), transactionHash: txHash, logs })
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
  bsc.receipts.set(txHash, { status: '0x1', blockNumber: hex(block), transactionHash: txHash, logs: [log] })
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
      return json({
        id: entry.transaction_id,
        blockNumber: entry.blockNumber,
        blockTimeStamp: entry.block_timestamp,
        receipt: { result: 'SUCCESS' },
        log: [
          {
            address: tronUsdtHex,
            topics: [
              transferTopic.slice(2),
              '0'.repeat(64),
              config.tronAddressToHex20(entry.to)!.slice(2).padStart(64, '0'),
            ],
            data: BigInt(entry.value).toString(16).padStart(64, '0'),
          },
        ],
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
      const block = Number.parseInt(tag, 16)
      result = { number: tag, timestamp: hex(bsc.times.get(block) ?? Math.floor(Date.now() / 1_000)) }
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

test('a TRC-20 transfer carrying the code is credited with nothing pasted', async () => {
  const user = newUser()
  const invoice = request(user.id, 'usdt-trc20', 1800)
  sendTron(tronRaw(invoice.payment_amount_e4!))
  mine(20)
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'success')
  assert.equal(credits.getBalance(user.id).creditCents, 1800)
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

  verification.decideInvoiceVerification(admin.id, {
    invoiceReference: thiefInvoice.reference,
    decision: 'reject',
    reason: 'Not this customer’s transfer',
    idempotencyKey: 'reject-thief-0001',
  })
  // The owner can now paste it; a person then confirms the rounded amount.
  payments.submitPaymentReference(ownerInvoice.reference, owner.id, txHash, '')
  assert.equal(await verification.verifyInvoiceTransaction(ownerInvoice.reference), 'manual_review')
  verification.decideInvoiceVerification(admin.id, {
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
  await scan()
  await scan()
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
  await scan()
  assert.equal(payments.getInvoice(invoice.reference, user.id)!.status, 'pending')
  const paused = database.db().prepare(
    "SELECT resume_fingerprint FROM payment_watch_cursors WHERE route_id = 'usdt-trc20'",
  ).get() as { resume_fingerprint: string | null }
  assert.ok(paused.resume_fingerprint, 'pagination state persists between runs')
  await scan()
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

test('no request is ever created without a code', () => {
  for (let index = 0; index < 99; index += 1) {
    database.db().prepare(
      `INSERT INTO invoices (reference, user_id, gateway, credit_amount_cents, total_due_cents, status,
                             payment_route_id, payment_amount_e4, created_at)
       VALUES (?, 1, 'usdt-trc20', 7700, 7700, 'pending', 'usdt-trc20', ?, datetime('now'))`,
    ).run(`filler-${index}`, 770_000 + index + 1)
  }
  assert.throws(() => payments.createInvoice(newUser().id, 'usdt-trc20', 7700), /Too many open payment requests near this amount/)
})

test('a batched transaction pasted on the wrong request is handed to a request whose code it carries', async () => {
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
  assert.equal(await verification.verifyInvoiceTransaction(thiefInvoice.reference), 'pending')
  assert.equal(credits.getBalance(thief.id).creditCents, 0)
  assert.equal(credits.getBalance(a.id).creditCents, 5000, 'the first log went to its owner')
  const leftover = database.db().prepare(
    "SELECT status FROM chain_transfers WHERE route_id = 'bsc-usdt-peg' AND tx_hash = ? AND log_index = 1",
  ).get(tx) as { status: string } | undefined
  assert.equal(leftover?.status, 'unmatched', 'the other log in the batch stays available for human review')
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
  verification.decideInvoiceVerification(admin.id, {
    invoiceReference: invoice.reference,
    decision: 'reject',
    reason: 'Fee policy mismatch, refund it',
    idempotencyKey: 'reject-fee-0001',
  })
  const row = watcher.unmatchedTransfers().rows.find((entry) => entry.tx_hash === txHash)
  assert.ok(row, 'the transfer is listed again')
  assert.match(row.note!, /Rejected on payment request/)
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
