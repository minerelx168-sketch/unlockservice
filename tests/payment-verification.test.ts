import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test, { after, before } from 'node:test'

const workDir = mkdtempSync(join(tmpdir(), 'iunlockmobile-payment-verification-'))
const databasePath = join(workDir, 'payments.db')
const wallet = '0x1111111111111111111111111111111111111111'
const sender = '0x2222222222222222222222222222222222222222'
const contract = '0x55d398326f99059ff775485246999027b3197955'
const ethereumUsdtContract = '0xdac17f958d2ee523a2206206994597c13d831ec7'
const tronWallet = 'TBXSw8fM4jpQkGc6zZjsVABFpVN7UvXPdV'
const tronUsdtHex = '0xa614f803b6fd780986a42c78ec9c7f77e6ded13c'
const transferTopic = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

process.env.IUNLOCKMOBILE_DB = databasePath
process.env.IUNLOCKMOBILE_TOPUP_ENABLED = '1'
process.env.IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS = wallet
process.env.IUNLOCKMOBILE_TRON_RECEIVING_ADDRESS = tronWallet
process.env.IUNLOCKMOBILE_TOPUP_TRC20_USDT_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_BEP20_USDC_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_ERC20_USDT_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_ERC20_USDC_ENABLED = '1'
process.env.IUNLOCKMOBILE_TRONGRID_API_KEY = 'test-trongrid-key'
process.env.IUNLOCKMOBILE_ETHERSCAN_API_KEY = 'test-etherscan-key'
process.env.IUNLOCKMOBILE_TRON_CONFIRMATIONS = '15'
process.env.IUNLOCKMOBILE_BSC_CONFIRMATIONS = '15'
process.env.IUNLOCKMOBILE_ETH_CONFIRMATIONS = '15'

let auth: typeof import('../lib/auth')
let credits: typeof import('../lib/credits')
let database: typeof import('../lib/db')
let payments: typeof import('../lib/payments')
let paymentConfig: typeof import('../lib/payment-config')
let verification: typeof import('../lib/payment-verification')

function topic(address: string): string {
  return `0x${address.slice(2).toLowerCase().padStart(64, '0')}`
}

function transactionHash(character: string): string {
  return `0x${character.repeat(64)}`
}

function tronTransactionId(character: string): string {
  return character.repeat(64)
}

function transferReceipt(
  txHash: string,
  cents: number,
  options: { recipient?: string; block?: number; rawAmount?: bigint; tokenContract?: string; decimals?: number } = {},
) {
  const block = options.block ?? 100
  const decimals = options.decimals ?? 18
  const rawAmount = options.rawAmount ?? (BigInt(cents) * (10n ** BigInt(decimals))) / 100n
  return {
    jsonrpc: '2.0',
    id: 1,
    result: {
      status: '0x1',
      blockNumber: `0x${block.toString(16)}`,
      transactionHash: txHash,
      logs: [
        {
          address: options.tokenContract ?? contract,
          topics: [transferTopic, topic(sender), topic(options.recipient ?? wallet)],
          data: `0x${rawAmount.toString(16)}`,
          logIndex: '0x0',
          blockNumber: `0x${block.toString(16)}`,
          transactionHash: txHash,
          removed: false,
        },
      ],
    },
  }
}

function tronTransferReceipt(
  txId: string,
  cents: number,
  recipientHex: string,
  options: { block?: number; rawAmount?: bigint; tokenContractHex?: string } = {},
) {
  const block = options.block ?? 100
  const rawAmount = options.rawAmount ?? (BigInt(cents) * 10n ** 6n) / 100n
  return {
    id: txId,
    blockNumber: block,
    blockTimeStamp: Date.now(),
    receipt: { result: 'SUCCESS' },
    log: [{
      address: options.tokenContractHex ?? tronUsdtHex.slice(2),
      topics: [
        transferTopic.slice(2),
        sender.slice(2).padStart(64, '0'),
        recipientHex.slice(2).padStart(64, '0'),
      ],
      data: rawAmount.toString(16).padStart(64, '0'),
    }],
  }
}

function mockTronProvider(receipt: unknown, latestBlock = 114) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    assert.equal(new Headers(init?.headers).get('TRON-PRO-API-KEY'), 'test-trongrid-key')
    const payload = url.pathname === '/wallet/gettransactioninfobyid'
      ? receipt
      : url.pathname === '/walletsolidity/getnowblock'
        ? { block_header: { raw_data: { number: latestBlock, timestamp: Date.now() } } }
        : { Error: 'unsupported test action' }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

function mockChainProvider(
  receipt: unknown,
  latestBlock = 114,
  blockTimestampSeconds = Math.floor(Date.now() / 1_000),
  chainId = 56,
) {
  return async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url)
    let action = url.searchParams.get('action')
    let tag = url.searchParams.get('tag')
    if (typeof init?.body === 'string') {
      const request = JSON.parse(init.body) as { method?: string; params?: unknown[] }
      action = request.method ?? action
      tag = typeof request.params?.[0] === 'string' ? request.params[0] : tag
    }
    const payload = action === 'eth_chainId'
      ? { jsonrpc: '2.0', id: 1, result: `0x${chainId.toString(16)}` }
      : action === 'eth_getTransactionReceipt'
        ? receipt
        : action === 'eth_getBlockByNumber'
          ? {
              jsonrpc: '2.0',
              id: 1,
              result: {
                number: tag,
                timestamp: `0x${blockTimestampSeconds.toString(16)}`,
              },
            }
          : action === 'eth_blockNumber'
            ? { jsonrpc: '2.0', id: 1, result: `0x${latestBlock.toString(16)}` }
            : { status: '0', message: 'NOTOK', result: 'unsupported test action' }
    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
}

before(async () => {
  database = await import('../lib/db')
  auth = await import('../lib/auth')
  credits = await import('../lib/credits')
  payments = await import('../lib/payments')
  paymentConfig = await import('../lib/payment-config')
  verification = await import('../lib/payment-verification')
  database.db()
})

after(() => {
  rmSync(workDir, { recursive: true, force: true })
})

test('payment verification migration is additive and events are append-only', () => {
  const db = database.db()
  const migration = db.prepare("SELECT 1 FROM schema_migrations WHERE version = '2026-09-bscscan-invoice-verification-v1'").get()
  assert.ok(migration)
  const timestampMigration = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = '2026-09-bscscan-invoice-verification-v2'")
    .get()
  assert.ok(timestampMigration)
  const verifiedAmountMigration = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = '2026-09-usdt-verified-amount-v1'")
    .get()
  assert.ok(verifiedAmountMigration)
  const multiChainMigration = db
    .prepare("SELECT 1 FROM schema_migrations WHERE version = '2026-09-multichain-topup-v1'")
    .get()
  assert.ok(multiChainMigration)
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'invoice_verifications'").get())
  assert.ok(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'invoice_verification_events'").get())
})

test('payment routes are server allowlisted and invoices snapshot network/token policy', () => {
  assert.deepEqual(
    payments.GATEWAYS.map((gateway) => gateway.id).sort(),
    ['bsc-usdc-peg', 'bsc-usdt-peg', 'usdc-erc20', 'usdt-erc20', 'usdt-trc20'],
  )
  const user = auth.register('route-snapshot', 'route-snapshot@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'usdt-trc20', 375)
  assert.deepEqual(
    {
      route: invoice.payment_route_id,
      network: invoice.payment_network_id,
      kind: invoice.payment_chain_kind,
      asset: invoice.payment_asset_code,
      decimals: invoice.payment_token_decimals,
      destination: invoice.payment_destination_address,
      confirmations: invoice.payment_confirmations_required,
    },
    {
      route: 'usdt-trc20',
      network: 'tron-mainnet',
      kind: 'tron',
      asset: 'USDT',
      decimals: 6,
      destination: tronWallet,
      confirmations: 15,
    },
  )
})

test('a matching finalized TRC-20 Transfer credits the verified amount exactly once', async () => {
  const user = auth.register('tron-settle', 'tron-settle@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'usdt-trc20', 700)
  const txId = tronTransactionId('a')
  payments.submitPaymentReference(invoice.reference, user.id, txId, '')
  const recipientHex = paymentConfig.tronAddressToHex20(tronWallet)
  assert.ok(recipientHex)
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockTronProvider(tronTransferReceipt(txId, 725, recipientHex)) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'verified')
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'verified')
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(credits.getBalance(user.id).creditCents, 725)
  const view = verification.getInvoiceVerification(invoice.reference, user.id)
  assert.equal(view?.network_id, 'tron-mainnet')
  assert.equal(view?.asset_code, 'USDT')
  assert.equal(view?.verified_credit_cents, 725)
})

test('a finalized ERC-20 USDT Transfer verifies through Etherscan V2 and credits six-decimal value', async () => {
  const user = auth.register('ethereum-settle', 'ethereum-settle@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'usdt-erc20', 825)
  const txHash = transactionHash('e')
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockChainProvider(
    transferReceipt(txHash, 850, { tokenContract: ethereumUsdtContract, decimals: 6 }),
  ) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'verified')
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(credits.getBalance(user.id).creditCents, 850)
  const view = verification.getInvoiceVerification(invoice.reference, user.id)
  assert.equal(view?.network_id, 'ethereum-mainnet')
  assert.equal(view?.verified_credit_cents, 850)
})

test('a receipt from another allowlisted token cannot settle the selected route', async () => {
  const user = auth.register('token-isolation', 'token-isolation@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'bsc-usdc-peg', 600)
  const txHash = transactionHash('f')
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockChainProvider(transferReceipt(txHash, 600, { tokenContract: contract })) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'manual_review')
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(verification.getInvoiceVerification(invoice.reference, user.id)?.error_code, 'transfer_not_found')
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})

test('official BNB RPC must identify chain ID 56 before verification', async () => {
  const user = auth.register('wrong-chain', 'wrong-chain@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'bsc-usdt-peg', 400)
  const txHash = transactionHash('c')
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockChainProvider(transferReceipt(txHash, invoice.total_due_cents), 114, undefined, 1) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'pending')
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(verification.getInvoiceVerification(invoice.reference, user.id)?.error_code, 'provider_wrong_chain')
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})

test('a matching finalized BEP-20 Transfer credits one invoice exactly once', async () => {
  const user = auth.register('auto-settle', 'auto-settle@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'bsc-usdt-peg', 2500)
  const txHash = transactionHash('1')
  const balanceBefore = credits.getBalance(user.id)
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  assert.deepEqual(credits.getBalance(user.id), balanceBefore)

  const originalFetch = globalThis.fetch
  globalThis.fetch = mockChainProvider(transferReceipt(txHash, invoice.total_due_cents)) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'verified')
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'verified')
  } finally {
    globalThis.fetch = originalFetch
  }

  assert.equal(payments.getInvoice(invoice.reference, user.id)?.status, 'success')
  assert.equal(verification.getInvoiceVerification(invoice.reference, user.id)?.status, 'verified')
  assert.equal(credits.getBalance(user.id).creditCents, 2500)
  const ledger = database.db().prepare(
    "SELECT COUNT(*) AS count FROM credit_ledger WHERE ref_type = 'invoice' AND ref_id = ? AND type = 'topup'",
  ).get(invoice.reference) as { count: number }
  assert.equal(ledger.count, 1)
})

test('a cent-exact different amount credits the verified value and preserves the requested audit', async () => {
  const user = auth.register('amount-different', 'amount-different@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'bsc-usdt-peg', 1000)
  const txHash = transactionHash('2')
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')

  const originalFetch = globalThis.fetch
  globalThis.fetch = mockChainProvider(transferReceipt(txHash, 999)) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'verified')
  } finally {
    globalThis.fetch = originalFetch
  }

  const view = verification.getInvoiceVerification(invoice.reference, user.id)
  assert.equal(view?.status, 'verified')
  assert.equal(view?.requested_credit_cents, 1000)
  assert.equal(view?.verified_credit_cents, 999)
  assert.equal(credits.getBalance(user.id).creditCents, 999)
  const settled = payments.getInvoice(invoice.reference, user.id)
  assert.deepEqual(
    { status: settled?.status, credit: settled?.credit_amount_cents, total: settled?.total_due_cents },
    { status: 'success', credit: 999, total: 999 },
  )
})

test('a verified amount with sub-cent precision requires manual review and never credits', async () => {
  const user = auth.register('fractional-amount', 'fractional-amount@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'bsc-usdt-peg', 1000)
  const txHash = transactionHash('d')
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockChainProvider(
    transferReceipt(txHash, 1000, { rawAmount: 10n * 10n ** 18n + 1n }),
  ) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'manual_review')
  } finally {
    globalThis.fetch = originalFetch
  }
  const view = verification.getInvoiceVerification(invoice.reference, user.id)
  assert.equal(view?.error_code, 'verified_amount_not_cent_exact')
  assert.equal(view?.verified_credit_cents, null)
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})

test('verification waits for confirmations and settles after the threshold', async () => {
  const user = auth.register('confirmations', 'confirmations@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'bsc-usdt-peg', 500)
  const txHash = transactionHash('3')
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  const receipt = transferReceipt(txHash, invoice.total_due_cents)
  const originalFetch = globalThis.fetch

  globalThis.fetch = mockChainProvider(receipt, 110) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'confirming')
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(credits.getBalance(user.id).creditCents, 0)
  assert.equal(verification.getInvoiceVerification(invoice.reference, user.id)?.confirmations, 11)

  globalThis.fetch = mockChainProvider(receipt, 114) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'verified')
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(credits.getBalance(user.id).creditCents, 500)
})

test('a transaction hash cannot be reused across invoices', () => {
  const first = auth.register('first-hash', 'first-hash@example.test', 'correct-horse-battery-staple')
  const second = auth.register('second-hash', 'second-hash@example.test', 'correct-horse-battery-staple')
  const hash = transactionHash('4')
  const firstInvoice = payments.createInvoice(first.id, 'bsc-usdt-peg', 700)
  const secondInvoice = payments.createInvoice(second.id, 'bsc-usdt-peg', 700)
  payments.submitPaymentReference(firstInvoice.reference, first.id, hash, '')
  assert.throws(
    () => payments.submitPaymentReference(secondInvoice.reference, second.id, hash, ''),
    /already attached to another invoice/,
  )
  assert.equal(credits.getBalance(first.id).creditCents, 0)
  assert.equal(credits.getBalance(second.id).creditCents, 0)
})

test('upstream failures remain retryable and never credit the invoice', async () => {
  const user = auth.register('api-retry', 'api-retry@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'bsc-usdt-peg', 900)
  const txHash = transactionHash('5')
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response('temporarily unavailable', { status: 503 })) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'pending')
  } finally {
    globalThis.fetch = originalFetch
  }
  const view = verification.getInvoiceVerification(invoice.reference, user.id)
  assert.equal(view?.status, 'submitted')
  assert.equal(view?.error_code, 'provider_http_503')
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})

test('a transaction mined before the invoice window never auto-credits', async () => {
  const user = auth.register('old-transfer', 'old-transfer@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'bsc-usdt-peg', 1100)
  const txHash = transactionHash('a')
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  const invoiceCreatedAt = Date.parse(invoice.created_at)
  const oldBlockTimestamp = Math.floor((invoiceCreatedAt - 60 * 60_000) / 1_000)
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockChainProvider(transferReceipt(txHash, invoice.total_due_cents), 114, oldBlockTimestamp) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'manual_review')
  } finally {
    globalThis.fetch = originalFetch
  }
  const view = verification.getInvoiceVerification(invoice.reference, user.id)
  assert.equal(view?.error_code, 'transaction_outside_invoice_window')
  assert.ok(view?.receipt_block_timestamp)
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})

test('Etherscan provider-plan rejection stays retryable for an Ethereum invoice and never changes credit', async () => {
  const user = auth.register('plan-required', 'plan-required@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'usdt-erc20', 1300)
  payments.submitPaymentReference(invoice.reference, user.id, transactionHash('b'), '')
  const originalFetch = globalThis.fetch
  globalThis.fetch = (async () => new Response(JSON.stringify({
    status: '0',
    message: 'NOTOK',
    result: 'Free API access is not supported for this chain. Please upgrade your API plan.',
  }), { status: 200, headers: { 'content-type': 'application/json' } })) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'pending')
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(verification.getInvoiceVerification(invoice.reference, user.id)?.error_code, 'provider_plan_required')
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})

test('manual approval requires admin RBAC, is replay safe, and writes append-only audit', async () => {
  const customer = auth.register('manual-customer', 'manual-customer@example.test', 'correct-horse-battery-staple')
  const ordinary = auth.register('ordinary-reviewer', 'ordinary-reviewer@example.test', 'correct-horse-battery-staple')
  const admin = auth.register('payment-admin', 'payment-admin@example.test', 'correct-horse-battery-staple')
  database.db().prepare("UPDATE users SET account_type = 'admin' WHERE id = ?").run(admin.id)

  const invoice = payments.createInvoice(customer.id, 'bsc-usdt-peg', 1200)
  const txHash = transactionHash('6')
  payments.submitPaymentReference(invoice.reference, customer.id, txHash, '')
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockChainProvider(
    transferReceipt(txHash, invoice.total_due_cents, { recipient: '0x3333333333333333333333333333333333333333' }),
  ) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'manual_review')
  } finally {
    globalThis.fetch = originalFetch
  }

  const input = {
    invoiceReference: invoice.reference,
    decision: 'approve' as const,
    reason: 'Verified independently against the confirmed on-chain transfer.',
    idempotencyKey: 'manual-payment-approval-1',
  }
  assert.throws(() => verification.decideInvoiceVerification(ordinary.id, input), /Administrator access is required/)
  const first = verification.decideInvoiceVerification(admin.id, input)
  const replay = verification.decideInvoiceVerification(admin.id, input)
  assert.equal(first.replayed, false)
  assert.equal(replay.replayed, true)
  assert.equal(credits.getBalance(customer.id).creditCents, 1200)

  const db = database.db()
  const effects = db.prepare(
    "SELECT COUNT(*) AS count FROM credit_ledger WHERE ref_type = 'invoice' AND ref_id = ? AND type = 'topup'",
  ).get(invoice.reference) as { count: number }
  assert.equal(effects.count, 1)
  assert.throws(() => db.prepare("UPDATE invoice_verification_events SET reason = 'changed'").run(), /append-only/)
  assert.throws(() => db.prepare('DELETE FROM invoice_verification_events').run(), /append-only/)
})


test('invoice verification remains owner scoped and rejects malformed hashes', () => {
  const owner = auth.register('verification-owner', 'verification-owner@example.test', 'correct-horse-battery-staple')
  const outsider = auth.register('verification-outsider', 'verification-outsider@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(owner.id, 'bsc-usdt-peg', 650)
  assert.throws(
    () => payments.submitPaymentReference(invoice.reference, owner.id, '0x1234', ''),
    /66-character transaction hash/,
  )
  assert.throws(
    () => payments.submitPaymentReference(invoice.reference, outsider.id, transactionHash('7'), ''),
    /No such invoice/,
  )
  payments.submitPaymentReference(invoice.reference, owner.id, transactionHash('7'), '')
  assert.equal(verification.getInvoiceVerification(invoice.reference, outsider.id), undefined)
  assert.equal(credits.getBalance(owner.id).creditCents, 0)
})

test('a transfer to another recipient never auto-credits', async () => {
  const user = auth.register('wrong-recipient', 'wrong-recipient@example.test', 'correct-horse-battery-staple')
  const invoice = payments.createInvoice(user.id, 'bsc-usdt-peg', 800)
  const txHash = transactionHash('8')
  payments.submitPaymentReference(invoice.reference, user.id, txHash, '')
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockChainProvider(
    transferReceipt(txHash, invoice.total_due_cents, { recipient: '0x3333333333333333333333333333333333333333' }),
  ) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'manual_review')
  } finally {
    globalThis.fetch = originalFetch
  }
  assert.equal(verification.getInvoiceVerification(invoice.reference, user.id)?.error_code, 'transfer_not_found')
  assert.equal(credits.getBalance(user.id).creditCents, 0)
})

test('manual rejection closes the invoice without a ledger effect and replays safely', async () => {
  const customer = auth.register('reject-customer', 'reject-customer@example.test', 'correct-horse-battery-staple')
  const admin = auth.register('reject-admin', 'reject-admin@example.test', 'correct-horse-battery-staple')
  database.db().prepare("UPDATE users SET account_type = 'admin' WHERE id = ?").run(admin.id)
  const invoice = payments.createInvoice(customer.id, 'bsc-usdt-peg', 1400)
  const txHash = transactionHash('9')
  payments.submitPaymentReference(invoice.reference, customer.id, txHash, '')
  const originalFetch = globalThis.fetch
  globalThis.fetch = mockChainProvider(
    transferReceipt(txHash, invoice.total_due_cents, { recipient: '0x4444444444444444444444444444444444444444' }),
  ) as typeof fetch
  try {
    assert.equal(await verification.verifyInvoiceTransaction(invoice.reference), 'manual_review')
  } finally {
    globalThis.fetch = originalFetch
  }

  const input = {
    invoiceReference: invoice.reference,
    decision: 'reject' as const,
    reason: 'Transfer recipient does not match the configured receiving wallet.',
    idempotencyKey: 'manual-payment-rejection-1',
  }
  assert.equal(verification.decideInvoiceVerification(admin.id, input).replayed, false)
  assert.equal(verification.decideInvoiceVerification(admin.id, input).replayed, true)
  assert.equal(payments.getInvoice(invoice.reference, customer.id)?.status, 'failed')
  assert.equal(credits.getBalance(customer.id).creditCents, 0)
  const effects = database.db().prepare(
    "SELECT COUNT(*) AS count FROM credit_ledger WHERE ref_type = 'invoice' AND ref_id = ? AND type = 'topup'",
  ).get(invoice.reference) as { count: number }
  assert.equal(effects.count, 0)
})
