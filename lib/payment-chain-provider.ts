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

async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10_000)
  try {
    await paceRequest()
    const response = await fetch(url, { ...init, cache: 'no-store', signal: controller.signal })
    if (!response.ok) {
      throw new PaymentProviderError(response.status === 429 ? 'provider_rate_limited' : `provider_http_${response.status}`)
    }
    const declaredLength = Number(response.headers.get('content-length') ?? '0')
    if (declaredLength > MAX_RESPONSE_BYTES) throw new PaymentProviderError('provider_response_too_large')
    const text = await response.text()
    if (text.length > MAX_RESPONSE_BYTES) throw new PaymentProviderError('provider_response_too_large')
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
): Promise<unknown> {
  const provider = paymentProviderConfiguration(snapshot.providerMode, snapshot.chainId)
  if (!provider.enabled || provider.chainKind !== 'evm') throw new PaymentProviderError('provider_disabled')

  if (provider.mode === 'bnb_rpc') {
    const payload = await requestJson(provider.apiUrl, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    })
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
