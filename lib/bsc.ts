/**
 * The smallest BNB Smart Chain client that payment detection needs: four
 * JSON-RPC calls over fetch, no SDK. Everything here is a read; the server
 * holds no key and can move nothing.
 *
 * Any RPC endpoint works for reading a receipt. Scanning uses eth_getLogs,
 * which some free public endpoints refuse or cap — deploy/README.md lists
 * providers that serve it.
 */

export const BSC_CHAIN_ID = 56
/** Tether's BEP-20 contract on BNB Smart Chain. 18 decimals. */
export const USDT_BSC_CONTRACT = '0x55d398326f99059ff775485246999027b3197955'
/** keccak256("Transfer(address,address,uint256)") */
export const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
/** 18 token decimals → 4 kept: one e4 unit is 10^14 raw units. */
const UNITS_PER_E4 = 10n ** 14n

export const DEFAULT_BSC_RPC_URL = 'https://bsc-dataseed.bnbchain.org'

export class ChainError extends Error {
  constructor(message: string, readonly code: 'rpc' | 'network' | 'chain_mismatch' = 'rpc') {
    super(message)
    this.name = 'ChainError'
  }
}

export type TokenTransfer = {
  txHash: string
  logIndex: number
  blockNumber: number
  from: string
  to: string
  amountUnits: bigint
  amountE4: number
}

export type TransferReceipt = {
  txHash: string
  blockNumber: number
  succeeded: boolean
  transfers: TokenTransfer[]
}

type RpcLog = {
  address: string
  topics: string[]
  data: string
  blockNumber: string
  transactionHash: string
  logIndex: string
  removed?: boolean
}

export function rpcUrl(): string {
  return process.env.IUNLOCKMOBILE_BSC_RPC_URL?.trim() || DEFAULT_BSC_RPC_URL
}

let requestId = 0

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  let response: Response
  try {
    response = await fetch(rpcUrl(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: ++requestId, method, params }),
      signal: AbortSignal.timeout(Number(process.env.IUNLOCKMOBILE_BSC_RPC_TIMEOUT_MS ?? 10_000)),
      cache: 'no-store',
    })
  } catch (error) {
    throw new ChainError(
      `BNB Smart Chain RPC unreachable (${error instanceof Error ? error.message : 'network error'}).`,
      'network',
    )
  }
  if (!response.ok) throw new ChainError(`BNB Smart Chain RPC answered HTTP ${response.status} to ${method}.`)

  let body: { result?: T; error?: { code?: number; message?: string } }
  try {
    body = (await response.json()) as typeof body
  } catch {
    throw new ChainError(`BNB Smart Chain RPC returned something that is not JSON for ${method}.`)
  }
  if (body.error) {
    throw new ChainError(`BNB Smart Chain RPC refused ${method}: ${body.error.message ?? 'unknown error'}.`)
  }
  return body.result as T
}

function hexToNumber(value: string): number {
  const parsed = Number.parseInt(value, 16)
  if (!Number.isSafeInteger(parsed)) throw new ChainError(`Unreadable number from RPC: ${value}`)
  return parsed
}

function toHex(value: number): string {
  return `0x${value.toString(16)}`
}

/** A 20-byte address left-padded into a 32-byte topic. */
export function addressTopic(address: string): string {
  return `0x${address.toLowerCase().replace(/^0x/, '').padStart(64, '0')}`
}

function topicAddress(topic: string): string {
  return `0x${topic.slice(-40).toLowerCase()}`
}

export function unitsToE4(units: bigint): number {
  const e4 = units / UNITS_PER_E4
  if (e4 > BigInt(Number.MAX_SAFE_INTEGER)) throw new ChainError('Transfer amount out of range.')
  return Number(e4)
}

/** Formats 1/10,000 USDT as a plain decimal string: 250037 → "25.0037". */
export function formatE4(e4: number): string {
  const whole = Math.floor(e4 / 10_000)
  const fraction = String(e4 % 10_000).padStart(4, '0')
  return `${whole}.${fraction}`
}

function decodeTransfer(log: RpcLog): TokenTransfer | null {
  if (log.removed) return null
  if (log.address.toLowerCase() !== USDT_BSC_CONTRACT) return null
  if (log.topics.length !== 3 || log.topics[0]?.toLowerCase() !== TRANSFER_TOPIC) return null
  const amountUnits = BigInt(log.data === '0x' ? 0 : log.data)
  return {
    txHash: log.transactionHash.toLowerCase(),
    logIndex: hexToNumber(log.logIndex),
    blockNumber: hexToNumber(log.blockNumber),
    from: topicAddress(log.topics[1]),
    to: topicAddress(log.topics[2]),
    amountUnits,
    amountE4: unitsToE4(amountUnits),
  }
}

let verifiedChainUrl: string | null = null

/**
 * Refuses an endpoint that is not BNB Smart Chain. Pointing the watcher at
 * an Ethereum node by mistake would otherwise read as "no payments" forever.
 */
export async function assertBscChain(): Promise<void> {
  const url = rpcUrl()
  if (verifiedChainUrl === url) return
  const chainId = hexToNumber(await rpc<string>('eth_chainId', []))
  if (chainId !== BSC_CHAIN_ID) {
    throw new ChainError(`The configured RPC is chain ${chainId}, not BNB Smart Chain (56).`, 'chain_mismatch')
  }
  verifiedChainUrl = url
}

export async function latestBlock(): Promise<number> {
  return hexToNumber(await rpc<string>('eth_blockNumber', []))
}

/** USDT transfers into one address over an inclusive block range. */
export async function usdtTransfersTo(address: string, fromBlock: number, toBlock: number): Promise<TokenTransfer[]> {
  const logs = await rpc<RpcLog[]>('eth_getLogs', [
    {
      fromBlock: toHex(fromBlock),
      toBlock: toHex(toBlock),
      address: USDT_BSC_CONTRACT,
      topics: [TRANSFER_TOPIC, null, addressTopic(address)],
    },
  ])
  /* A node that answers null, or anything that is not a list, has not
     said "no transfers" — and treating it as if it had would move the
     cursor past blocks nobody actually read. */
  if (!Array.isArray(logs)) throw new ChainError('eth_getLogs returned no list of logs.')
  const recipient = address.toLowerCase()
  return logs
    .map(decodeTransfer)
    .filter((transfer): transfer is TokenTransfer => transfer !== null && transfer.to === recipient)
}

/** ISO timestamp of a block, which is when the transfer actually happened. */
export async function blockTime(blockNumber: number): Promise<string> {
  const block = await rpc<{ timestamp: string } | null>('eth_getBlockByNumber', [toHex(blockNumber), false])
  if (!block) throw new ChainError(`Block ${blockNumber} is not available yet.`)
  return new Date(hexToNumber(block.timestamp) * 1000).toISOString()
}

/** Null when the node has never seen the hash — not mined yet, or another chain. */
export async function transferReceipt(txHash: string): Promise<TransferReceipt | null> {
  const receipt = await rpc<{ status: string; blockNumber: string; logs: RpcLog[] } | null>(
    'eth_getTransactionReceipt',
    [txHash],
  )
  if (!receipt) return null
  return {
    txHash: txHash.toLowerCase(),
    blockNumber: hexToNumber(receipt.blockNumber),
    succeeded: receipt.status === '0x1',
    transfers: (receipt.logs ?? [])
      .map(decodeTransfer)
      .filter((transfer): transfer is TokenTransfer => transfer !== null),
  }
}

/**
 * Pulls a transaction hash out of whatever the customer pasted: the bare
 * hash, or the explorer link their exchange or wallet gave them.
 */
export function extractTxHash(input: string): string | null {
  const text = input.trim()
  const prefixed = text.match(/0x[0-9a-fA-F]{64}(?![0-9a-fA-F])/)
  if (prefixed) return prefixed[0].toLowerCase()
  // Some exchanges show the TxID without its 0x.
  const bare = text.match(/(?<![0-9a-zA-Z])[0-9a-fA-F]{64}(?![0-9a-zA-Z])/)
  return bare ? `0x${bare[0].toLowerCase()}` : null
}

export function explorerTxUrl(txHash: string): string {
  return `https://bscscan.com/tx/${txHash}`
}
