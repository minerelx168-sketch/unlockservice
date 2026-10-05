import {
  normalizeTransactionId,
  paymentProviderConfiguration,
  type PaymentChainKind,
  type PaymentProviderMode,
} from './payment-config'

const MAX_RESPONSE_BYTES = 1_000_000
const REQUEST_INTERVAL_MS = 250
let nextRequestAt = 0

export class PaymentProviderError extends Error {
  constructor(readonly code: string) {
    super(code)
    this.name = 'PaymentProviderError'
  }
}

export type PaymentProviderSnapshot = {
  providerMode: PaymentProviderMode
  chainKind: PaymentChainKind
  chainId: number
}

export type NormalizedChainLog = {
  contractAddress: string
  topics: string[]
  data: string
  logIndex: number
}

export type NormalizedChainReceipt = {
  transactionId: string
  succeeded: boolean
  blockNumber: number
  blockTimestamp: string
  latestFinalBlock: number
  logs: NormalizedChainLog[]
}

function parseHexInteger(value: unknown): number | null {
  if (typeof value !== 'string' || !/^0x[0-9a-fA-F]+$/.test(value)) return null
  const parsed = Number.parseInt(value.slice(2), 16)
  return Number.isSafeInteger(parsed) ? parsed : null
}

function safeInteger(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null
}

async function paceRequest() {
  const now = Date.now()
  const waitMs = Math.max(0, nextRequestAt - now)
  nextRequestAt = Math.max(now, nextRequestAt) + REQUEST_INTERVAL_MS
  if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs))
}

function upstreamErrorCode(value: unknown): string {
  const message = typeof value === 'string'
    ? value.toLowerCase()
    : value && typeof value === 'object'
      ? String(
          (value as Record<string, unknown>).message
          ?? (value as Record<string, unknown>).Error
          ?? (value as Record<string, unknown>).result
          ?? '',
        ).toLowerCase()
      : ''
  if (message.includes('free api access') || message.includes('paid tier') || message.includes('upgrade your api plan')) {
    return 'provider_plan_required'
  }
  if (message.includes('rate limit') || message.includes('max rate limit') || message.includes('frequency limit')) {
    return 'provider_rate_limited'
  }
  if (message.includes('invalid api key') || message.includes('missing/invalid api key')) {
    return 'provider_invalid_api_key'
  }
  return 'provider_rpc_error'
}

async function requestJson(url: string, init: RequestInit, maxBytes = MAX_RESPONSE_BYTES): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    await paceRequest()
    const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal })
    if (!response.ok) {
      throw new PaymentProviderError(response.status === 429 ? 'provider_rate_limited' : `provider_http_${response.status}`)
    }
    const declaredLength = Number(response.headers.get('content-length') ?? '0')
    if (declaredLength > maxBytes) throw new PaymentProviderError('provider_response_too_large')
    const text = await response.text()
    if (text.length > maxBytes) throw new PaymentProviderError('provider_response_too_large')
    try {
      return JSON.parse(text) as unknown
    } catch {
      throw new PaymentProviderError('provider_invalid_json')
    }
  } catch (error) {
    if (error instanceof PaymentProviderError) throw error
    throw new PaymentProviderError(error instanceof Error && error.name === 'AbortError' ? 'provider_timeout' : 'provider_unavailable')
  } finally {
    clearTimeout(timeout)
  }
}

function rpcResult(payload: unknown): unknown {
  if (!payload || typeof payload !== 'object') throw new PaymentProviderError('provider_invalid_response')
  const record = payload as Record<string, unknown>
  if (record.error) throw new PaymentProviderError(upstreamErrorCode(record.error))
  if (record.status === '0') throw new PaymentProviderError(upstreamErrorCode(record.result ?? record.message))
  if (!('result' in record)) throw new PaymentProviderError('provider_invalid_response')
  return record.result
}

async function evmCall(
  snapshot: PaymentProviderSnapshot,
  method: string,
  params: unknown[],
  etherscanParameters: Record<string, string>,
  maxBytes = MAX_RESPONSE_BYTES,
): Promise<unknown> {
  const provider = paymentProviderConfiguration(snapshot.providerMode, snapshot.chainId)
  if (!provider.enabled || provider.chainKind !== 'evm') throw new PaymentProviderError('provider_disabled')

  if (provider.mode === 'bnb_rpc') {
    const payload = await requestJson(
      provider.apiUrl,
      {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      },
      maxBytes,
    )
    return payload
  }

  const url = new URL(provider.apiUrl)
  for (const [key, value] of Object.entries({
    apikey: provider.apiKey,
    chainid: String(provider.chainId),
    ...etherscanParameters,
  })) {
    url.searchParams.set(key, value)
  }
  return requestJson(url.toString(), { method: 'GET', headers: { accept: 'application/json' } })
}

async function ensureEvmChain(snapshot: PaymentProviderSnapshot): Promise<void> {
  const provider = paymentProviderConfiguration(snapshot.providerMode, snapshot.chainId)
  if (provider.mode !== 'bnb_rpc') return
  const payload = await evmCall(snapshot, 'eth_chainId', [], {})
  if (parseHexInteger(rpcResult(payload)) !== snapshot.chainId) {
    throw new PaymentProviderError('provider_wrong_chain')
  }
}

async function inspectEvmTransaction(
  snapshot: PaymentProviderSnapshot,
  transactionId: string,
): Promise<NormalizedChainReceipt | null> {
  await ensureEvmChain(snapshot)
  const receiptPayload = await evmCall(
    snapshot,
    'eth_getTransactionReceipt',
    [transactionId],
    { module: 'proxy', action: 'eth_getTransactionReceipt', txhash: transactionId },
  )
  const receiptResult = rpcResult(receiptPayload)
  if (receiptResult === null) return null
  if (!receiptResult || typeof receiptResult !== 'object') throw new PaymentProviderError('provider_invalid_receipt')
  const receipt = receiptResult as Record<string, unknown>
  const normalizedId = normalizeTransactionId('evm', String(receipt.transactionHash ?? ''))
  const blockNumber = parseHexInteger(receipt.blockNumber)
  if (!normalizedId || blockNumber === null || !Array.isArray(receipt.logs)) {
    throw new PaymentProviderError('provider_invalid_receipt')
  }

  const tag = `0x${blockNumber.toString(16)}`
  const blockPayload = await evmCall(
    snapshot,
    'eth_getBlockByNumber',
    [tag, false],
    { module: 'proxy', action: 'eth_getBlockByNumber', tag, boolean: 'false' },
  )
  const blockResult = rpcResult(blockPayload)
  if (!blockResult || typeof blockResult !== 'object') throw new PaymentProviderError('provider_invalid_block')
  const block = blockResult as Record<string, unknown>
  const returnedBlock = parseHexInteger(block.number)
  const timestampSeconds = parseHexInteger(block.timestamp)
  if (returnedBlock !== blockNumber || timestampSeconds === null) throw new PaymentProviderError('provider_invalid_block')

  const latestPayload = await evmCall(
    snapshot,
    'eth_blockNumber',
    [],
    { module: 'proxy', action: 'eth_blockNumber' },
  )
  const latestFinalBlock = parseHexInteger(rpcResult(latestPayload))
  if (latestFinalBlock === null || latestFinalBlock < blockNumber) {
    throw new PaymentProviderError('provider_block_inconsistent')
  }

  const logs = receipt.logs.flatMap((value): NormalizedChainLog[] => {
    if (!value || typeof value !== 'object') return []
    const log = value as Record<string, unknown>
    if (log.removed === true) return []
    const contract = typeof log.address === 'string' && /^0x[0-9a-fA-F]{40}$/.test(log.address)
      ? log.address.toLowerCase()
      : null
    const logIndex = parseHexInteger(log.logIndex)
    const topics = Array.isArray(log.topics)
      ? log.topics.filter((topic): topic is string => typeof topic === 'string').map((topic) => topic.toLowerCase())
      : []
    const data = typeof log.data === 'string' && /^0x[0-9a-fA-F]+$/.test(log.data) ? log.data.toLowerCase() : null
    if (!contract || logIndex === null || !data) return []
    return [{ contractAddress: contract, topics, data, logIndex }]
  })

  const timestamp = new Date(timestampSeconds * 1_000)
  if (!Number.isFinite(timestamp.getTime())) throw new PaymentProviderError('provider_invalid_block')
  return {
    transactionId: normalizedId,
    succeeded: String(receipt.status ?? '').toLowerCase() === '0x1',
    blockNumber,
    blockTimestamp: timestamp.toISOString(),
    latestFinalBlock,
    logs,
  }
}

function tronHex20(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const clean = value.toLowerCase().replace(/^0x/, '').replace(/^41/, '')
  return /^[0-9a-f]{40}$/.test(clean) ? `0x${clean}` : null
}

function tronTopic(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const clean = value.toLowerCase().replace(/^0x/, '')
  return /^[0-9a-f]{64}$/.test(clean) ? `0x${clean}` : null
}

function tronData(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const clean = value.toLowerCase().replace(/^0x/, '')
  return /^[0-9a-f]+$/.test(clean) ? `0x${clean}` : null
}

async function tronRequest(snapshot: PaymentProviderSnapshot, path: string, init: RequestInit): Promise<unknown> {
  const provider = paymentProviderConfiguration(snapshot.providerMode, snapshot.chainId)
  if (!provider.enabled || provider.mode !== 'trongrid' || provider.chainKind !== 'tron') {
    throw new PaymentProviderError('provider_disabled')
  }
  const headers = new Headers(init.headers)
  headers.set('accept', 'application/json')
  headers.set('content-type', 'application/json')
  headers.set('TRON-PRO-API-KEY', provider.apiKey)
  const payload = await requestJson(`${provider.apiUrl}${path}`, { ...init, headers })
  if (payload && typeof payload === 'object' && ('Error' in payload || 'error' in payload)) {
    throw new PaymentProviderError(upstreamErrorCode(payload))
  }
  return payload
}

async function inspectTronTransaction(
  snapshot: PaymentProviderSnapshot,
  transactionId: string,
): Promise<NormalizedChainReceipt | null> {
  const payload = await tronRequest(snapshot, '/wallet/gettransactioninfobyid', {
    method: 'POST',
    body: JSON.stringify({ value: transactionId }),
  })
  if (!payload || typeof payload !== 'object') throw new PaymentProviderError('provider_invalid_receipt')
  const receipt = payload as Record<string, unknown>
  if (Object.keys(receipt).length === 0) return null
  const normalizedId = normalizeTransactionId('tron', String(receipt.id ?? ''))
  const blockNumber = safeInteger(receipt.blockNumber)
  const timestampMs = safeInteger(receipt.blockTimeStamp)
  if (!normalizedId || blockNumber === null || timestampMs === null) {
    throw new PaymentProviderError('provider_invalid_receipt')
  }

  const latestPayload = await tronRequest(snapshot, '/walletsolidity/getnowblock?visible=true', { method: 'GET' })
  if (!latestPayload || typeof latestPayload !== 'object') throw new PaymentProviderError('provider_invalid_block')
  const latest = latestPayload as Record<string, unknown>
  const header = latest.block_header as Record<string, unknown> | undefined
  const rawData = header?.raw_data as Record<string, unknown> | undefined
  const latestFinalBlock = safeInteger(rawData?.number)
  if (latestFinalBlock === null || latestFinalBlock < blockNumber) {
    throw new PaymentProviderError('provider_block_inconsistent')
  }

  const rawLogs = Array.isArray(receipt.log) ? receipt.log : []
  const logs = rawLogs.flatMap((value, index): NormalizedChainLog[] => {
    if (!value || typeof value !== 'object') return []
    const log = value as Record<string, unknown>
    const contractAddress = tronHex20(log.address)
    const topics = Array.isArray(log.topics)
      ? log.topics.map(tronTopic).filter((topic): topic is string => Boolean(topic))
      : []
    const data = tronData(log.data)
    if (!contractAddress || !data) return []
    return [{ contractAddress, topics, data, logIndex: index }]
  })

  const timestamp = new Date(timestampMs)
  if (!Number.isFinite(timestamp.getTime())) throw new PaymentProviderError('provider_invalid_block')
  const executionReceipt = receipt.receipt as Record<string, unknown> | undefined
  return {
    transactionId: normalizedId,
    succeeded: String(executionReceipt?.result ?? '').toUpperCase() === 'SUCCESS',
    blockNumber,
    blockTimestamp: timestamp.toISOString(),
    latestFinalBlock,
    logs,
  }
}

export async function inspectPaymentTransaction(
  snapshot: PaymentProviderSnapshot,
  transactionId: string,
): Promise<NormalizedChainReceipt | null> {
  const normalized = normalizeTransactionId(snapshot.chainKind, transactionId)
  if (!normalized) throw new PaymentProviderError('invalid_transaction')
  if (snapshot.chainKind === 'tron') return inspectTronTransaction(snapshot, normalized)
  return inspectEvmTransaction(snapshot, normalized)
}

/* ---- wallet scanning (the payment watcher) -----------------------------
 *
 * The functions above read one transaction a customer pointed at. These
 * list every token transfer INTO the receiving wallet, so the watcher can
 * find a payment nobody pasted. Read-only, through the same pacing, size
 * limits and error codes as the rest of this adapter.
 */

const TRANSFER_EVENT_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
const LOG_RESPONSE_BYTES = 12_000_000

export type IncomingTransfer = {
  transactionId: string
  /** Distinguishes several transfers in one transaction. */
  logIndex: number
  blockNumber: number | null
  blockTimestamp: string
  from: string | null
  rawAmount: bigint
}

function addressTopic(address: string): string {
  return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`
}

/** Latest block on a JSON-RPC (bnb_rpc) route, after checking the endpoint is the right chain. */
export async function evmLatestBlock(snapshot: PaymentProviderSnapshot): Promise<number> {
  if (snapshot.providerMode !== 'bnb_rpc') throw new PaymentProviderError('provider_scan_unsupported')
  await ensureEvmChain(snapshot)
  const latest = parseHexInteger(rpcResult(await evmCall(snapshot, 'eth_blockNumber', [], {})))
  if (latest === null) throw new PaymentProviderError('provider_invalid_block')
  return latest
}

/** Token transfers into `destination` over an inclusive block range (bnb_rpc routes). */
export async function listEvmIncomingTransfers(
  snapshot: PaymentProviderSnapshot,
  tokenContract: string,
  destination: string,
  fromBlock: number,
  toBlock: number,
  /** Smaller transfers are dropped before any block is fetched for them (spam). */
  minRawAmount = 1n,
): Promise<IncomingTransfer[]> {
  if (snapshot.providerMode !== 'bnb_rpc') throw new PaymentProviderError('provider_scan_unsupported')
  const result = rpcResult(
    await evmCall(
      snapshot,
      'eth_getLogs',
      [
        {
          fromBlock: `0x${fromBlock.toString(16)}`,
          toBlock: `0x${toBlock.toString(16)}`,
          address: tokenContract.toLowerCase(),
          topics: [TRANSFER_EVENT_TOPIC, null, addressTopic(destination)],
        },
      ],
      {},
      /* Log lists can be large when a wallet is spammed. One block cannot
         hold more transfer logs than its gas limit allows, which is well
         under this, so narrowing the range always ends in a readable answer. */
      LOG_RESPONSE_BYTES,
    ),
  )
  /* A node that answers null, or anything but a list, has not said "no
     transfers"; treating it so would move the cursor past blocks nobody read. */
  if (!Array.isArray(result)) throw new PaymentProviderError('provider_invalid_logs')

  const wantedContract = tokenContract.toLowerCase()
  const wantedTopic = addressTopic(destination)
  const transfers: Array<Omit<IncomingTransfer, 'blockTimestamp'> & { blockNumber: number }> = []
  for (const value of result) {
    if (!value || typeof value !== 'object') continue
    const log = value as Record<string, unknown>
    if (log.removed === true) continue
    const topics = Array.isArray(log.topics) ? log.topics.map((topic) => String(topic).toLowerCase()) : []
    const transactionId = normalizeTransactionId('evm', String(log.transactionHash ?? ''))
    const blockNumber = parseHexInteger(log.blockNumber)
    const logIndex = parseHexInteger(log.logIndex)
    const data = typeof log.data === 'string' && /^0x[0-9a-fA-F]+$/.test(log.data) ? log.data : null
    if (
      String(log.address ?? '').toLowerCase() !== wantedContract
      || topics[0] !== TRANSFER_EVENT_TOPIC
      || topics[2] !== wantedTopic
      || !transactionId
      || blockNumber === null
      || logIndex === null
      || !data
      || BigInt(data) < minRawAmount
    ) {
      continue
    }
    transfers.push({
      transactionId,
      logIndex,
      blockNumber,
      from: topics[1] ? `0x${topics[1].slice(-40)}` : null,
      rawAmount: BigInt(data),
    })
  }

  const times = new Map<number, string>()
  for (const blockNumber of new Set(transfers.map((transfer) => transfer.blockNumber))) {
    const tag = `0x${blockNumber.toString(16)}`
    const block = rpcResult(await evmCall(snapshot, 'eth_getBlockByNumber', [tag, false], {}))
    const seconds = block && typeof block === 'object' ? parseHexInteger((block as Record<string, unknown>).timestamp) : null
    if (seconds === null) throw new PaymentProviderError('provider_invalid_block')
    times.set(blockNumber, new Date(seconds * 1_000).toISOString())
  }
  return transfers.map((transfer) => ({ ...transfer, blockTimestamp: times.get(transfer.blockNumber)! }))
}

/**
 * Confirmed TRC-20 transfers into `destination` since `minTimestampMs`,
 * oldest first, through TronGrid's account history. Returns the newest
 * block time seen so the caller can move its cursor.
 */
export async function listTronIncomingTransfers(
  snapshot: PaymentProviderSnapshot,
  tokenContract: string,
  destination: string,
  minTimestampMs: number,
  maxPages = 5,
  startFingerprint: string | null = null,
): Promise<{ transfers: IncomingTransfer[]; newestTimestampMs: number | null; complete: boolean; nextFingerprint: string | null }> {
  const transfers: IncomingTransfer[] = []
  const perTransaction = new Map<string, number>()
  let newestTimestampMs: number | null = null
  let fingerprint: string | null = startFingerprint

  for (let page = 0; page < maxPages; page += 1) {
    const query = new URLSearchParams({
      only_to: 'true',
      only_confirmed: 'true',
      contract_address: tokenContract,
      min_timestamp: String(Math.max(0, Math.floor(minTimestampMs))),
      order_by: 'block_timestamp,asc',
      limit: '200',
    })
    if (fingerprint) query.set('fingerprint', fingerprint)
    const payload = await tronRequest(
      snapshot,
      `/v1/accounts/${encodeURIComponent(destination)}/transactions/trc20?${query.toString()}`,
      { method: 'GET' },
    )
    if (!payload || typeof payload !== 'object' || !Array.isArray((payload as Record<string, unknown>).data)) {
      throw new PaymentProviderError('provider_invalid_logs')
    }
    const record = payload as { data: unknown[]; meta?: { fingerprint?: unknown } }
    for (const value of record.data) {
      if (!value || typeof value !== 'object') continue
      const entry = value as Record<string, unknown>
      const token = entry.token_info as Record<string, unknown> | undefined
      const transactionId = normalizeTransactionId('tron', String(entry.transaction_id ?? ''))
      const timestampMs = safeInteger(entry.block_timestamp)
      const amount = typeof entry.value === 'string' && /^\d+$/.test(entry.value) ? BigInt(entry.value) : null
      if (
        !transactionId
        || timestampMs === null
        || amount === null
        || entry.to !== destination
        || token?.address !== tokenContract
      ) {
        continue
      }
      const index = perTransaction.get(transactionId) ?? 0
      perTransaction.set(transactionId, index + 1)
      transfers.push({
        transactionId,
        logIndex: index,
        blockNumber: null,
        blockTimestamp: new Date(timestampMs).toISOString(),
        from: typeof entry.from === 'string' ? entry.from : null,
        rawAmount: amount,
      })
      newestTimestampMs = Math.max(newestTimestampMs ?? 0, timestampMs)
    }
    fingerprint = typeof record.meta?.fingerprint === 'string' && record.meta.fingerprint.length > 0
      ? record.meta.fingerprint : null
    if (!fingerprint) return { transfers, newestTimestampMs, complete: true, nextFingerprint: null }
  }
  return { transfers, newestTimestampMs, complete: false, nextFingerprint: fingerprint }
}
