import { createHash, timingSafeEqual } from 'node:crypto'

const EVM_ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/
const EVM_TRANSACTION_PATTERN = /^0x[a-fA-F0-9]{64}$/
const TRON_TRANSACTION_PATTERN = /^[a-fA-F0-9]{64}$/
const TRON_ADDRESS_PATTERN = /^T[1-9A-HJ-NP-Za-km-z]{33}$/
const BASE58_ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'

export const DEFAULT_CONFIRMATIONS = 15
export const ETHERSCAN_V2_URL = 'https://api.etherscan.io/v2/api'
export const OFFICIAL_BNB_RPC_URL = 'https://bsc-dataseed.bnbchain.org'
export const OFFICIAL_TRONGRID_URL = 'https://api.trongrid.io'

export type PaymentChainKind = 'evm' | 'tron'
export type PaymentProviderMode = 'bnb_rpc' | 'etherscan_v2' | 'trongrid'
export type PaymentRouteId =
  | 'usdt-trc20'
  | 'bsc-usdt-peg'
  | 'bsc-usdc-peg'
  | 'usdt-erc20'
  | 'usdc-erc20'

export type PaymentRouteDefinition = {
  id: PaymentRouteId
  chainKind: PaymentChainKind
  networkId: 'tron-mainnet' | 'bsc-mainnet' | 'ethereum-mainnet'
  chainId: number
  label: string
  asset: 'USDT' | 'USDC' | 'BSC-USD'
  network: string
  tokenContract: string
  tokenDecimals: number
  providerMode: PaymentProviderMode
  destinationEnv: 'IUNLOCKMOBILE_TRON_RECEIVING_ADDRESS' | 'IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS'
  enabledEnv:
    | 'IUNLOCKMOBILE_TOPUP_TRC20_USDT_ENABLED'
    | 'IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED'
    | 'IUNLOCKMOBILE_TOPUP_BEP20_USDC_ENABLED'
    | 'IUNLOCKMOBILE_TOPUP_ERC20_USDT_ENABLED'
    | 'IUNLOCKMOBILE_TOPUP_ERC20_USDC_ENABLED'
  confirmationsEnv: 'IUNLOCKMOBILE_TRON_CONFIRMATIONS' | 'IUNLOCKMOBILE_BSC_CONFIRMATIONS' | 'IUNLOCKMOBILE_ETH_CONFIRMATIONS'
  explorerTransactionBaseUrl: string
  riskClassification: 'issuer_native' | 'third_party_pegged'
}

export type PaymentProviderConfig = {
  mode: PaymentProviderMode
  enabled: boolean
  apiUrl: string
  apiKey: string
  chainKind: PaymentChainKind
  chainId: number
}

export type PaymentRouteConfig = PaymentRouteDefinition & {
  enabled: boolean
  providerReady: boolean
  destinationAddress: string
  confirmationsRequired: number
  feeBasisPoints: number
}

export const PAYMENT_ROUTE_DEFINITIONS: readonly PaymentRouteDefinition[] = [
  {
    id: 'usdt-trc20',
    chainKind: 'tron',
    networkId: 'tron-mainnet',
    chainId: 0,
    label: 'USDT on TRON',
    asset: 'USDT',
    network: 'TRON Mainnet (TRC-20)',
    tokenContract: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    tokenDecimals: 6,
    providerMode: 'trongrid',
    destinationEnv: 'IUNLOCKMOBILE_TRON_RECEIVING_ADDRESS',
    enabledEnv: 'IUNLOCKMOBILE_TOPUP_TRC20_USDT_ENABLED',
    confirmationsEnv: 'IUNLOCKMOBILE_TRON_CONFIRMATIONS',
    explorerTransactionBaseUrl: 'https://tronscan.org/#/transaction/',
    riskClassification: 'issuer_native',
  },
  {
    id: 'bsc-usdt-peg',
    chainKind: 'evm',
    networkId: 'bsc-mainnet',
    chainId: 56,
    label: 'BSC-USD (Binance-Peg)',
    asset: 'BSC-USD',
    network: 'BNB Smart Chain (BEP-20)',
    tokenContract: '0x55d398326f99059ff775485246999027b3197955',
    tokenDecimals: 18,
    providerMode: 'bnb_rpc',
    destinationEnv: 'IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS',
    enabledEnv: 'IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED',
    confirmationsEnv: 'IUNLOCKMOBILE_BSC_CONFIRMATIONS',
    explorerTransactionBaseUrl: 'https://bscscan.com/tx/',
    riskClassification: 'third_party_pegged',
  },
  {
    id: 'bsc-usdc-peg',
    chainKind: 'evm',
    networkId: 'bsc-mainnet',
    chainId: 56,
    label: 'USDC (Binance-Peg)',
    asset: 'USDC',
    network: 'BNB Smart Chain (BEP-20)',
    tokenContract: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    tokenDecimals: 18,
    providerMode: 'bnb_rpc',
    destinationEnv: 'IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS',
    enabledEnv: 'IUNLOCKMOBILE_TOPUP_BEP20_USDC_ENABLED',
    confirmationsEnv: 'IUNLOCKMOBILE_BSC_CONFIRMATIONS',
    explorerTransactionBaseUrl: 'https://bscscan.com/tx/',
    riskClassification: 'third_party_pegged',
  },
  {
    id: 'usdt-erc20',
    chainKind: 'evm',
    networkId: 'ethereum-mainnet',
    chainId: 1,
    label: 'USDT on Ethereum',
    asset: 'USDT',
    network: 'Ethereum Mainnet (ERC-20)',
    tokenContract: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    tokenDecimals: 6,
    providerMode: 'etherscan_v2',
    destinationEnv: 'IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS',
    enabledEnv: 'IUNLOCKMOBILE_TOPUP_ERC20_USDT_ENABLED',
    confirmationsEnv: 'IUNLOCKMOBILE_ETH_CONFIRMATIONS',
    explorerTransactionBaseUrl: 'https://etherscan.io/tx/',
    riskClassification: 'issuer_native',
  },
  {
    id: 'usdc-erc20',
    chainKind: 'evm',
    networkId: 'ethereum-mainnet',
    chainId: 1,
    label: 'USDC on Ethereum',
    asset: 'USDC',
    network: 'Ethereum Mainnet (ERC-20)',
    tokenContract: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    tokenDecimals: 6,
    providerMode: 'etherscan_v2',
    destinationEnv: 'IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS',
    enabledEnv: 'IUNLOCKMOBILE_TOPUP_ERC20_USDC_ENABLED',
    confirmationsEnv: 'IUNLOCKMOBILE_ETH_CONFIRMATIONS',
    explorerTransactionBaseUrl: 'https://etherscan.io/tx/',
    riskClassification: 'issuer_native',
  },
] as const

function integerInRange(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value ?? '')
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return fallback
  return parsed
}

function feeBasisPoints(value: string | undefined): number {
  return integerInRange(value, 0, 0, 2_500)
}

function httpsUrl(value: string | undefined, fallback: string): string {
  const clean = value?.trim() || fallback
  try {
    const parsed = new URL(clean)
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password) return fallback
    return parsed.toString().replace(/\/$/, '')
  } catch {
    return fallback
  }
}

function decodeBase58(value: string): Buffer | null {
  if (!TRON_ADDRESS_PATTERN.test(value)) return null
  let numeric = 0n
  for (const character of value) {
    const index = BASE58_ALPHABET.indexOf(character)
    if (index < 0) return null
    numeric = numeric * 58n + BigInt(index)
  }
  let hex = numeric.toString(16)
  if (hex.length % 2) hex = `0${hex}`
  const body = hex ? Buffer.from(hex, 'hex') : Buffer.alloc(0)
  let zeroes = 0
  while (zeroes < value.length && value[zeroes] === '1') zeroes += 1
  return Buffer.concat([Buffer.alloc(zeroes), body])
}

function sha256(value: Buffer): Buffer {
  return createHash('sha256').update(value).digest()
}

export function tronAddressToHex20(value: string): string | null {
  const decoded = decodeBase58(value.trim())
  if (!decoded || decoded.length !== 25) return null
  const payload = decoded.subarray(0, 21)
  const checksum = decoded.subarray(21)
  const expected = sha256(sha256(payload)).subarray(0, 4)
  if (!timingSafeEqual(checksum, expected) || payload[0] !== 0x41) return null
  return `0x${payload.subarray(1).toString('hex')}`
}

export function normalizeEvmAddress(value: string): string | null {
  const clean = value.trim()
  return EVM_ADDRESS_PATTERN.test(clean) ? clean.toLowerCase() : null
}

export function normalizeTronAddress(value: string): string | null {
  const clean = value.trim()
  return tronAddressToHex20(clean) ? clean : null
}

function cleanDestination(definition: PaymentRouteDefinition): string {
  const raw = process.env[definition.destinationEnv] ?? ''
  return definition.chainKind === 'tron' ? (normalizeTronAddress(raw) ?? '') : (normalizeEvmAddress(raw) ?? '')
}

export function paymentProviderConfiguration(mode: PaymentProviderMode, chainId: number): PaymentProviderConfig {
  if (mode === 'bnb_rpc') {
    return {
      mode,
      enabled: chainId === 56,
      apiUrl: httpsUrl(process.env.IUNLOCKMOBILE_BNB_RPC_URL, OFFICIAL_BNB_RPC_URL),
      apiKey: '',
      chainKind: 'evm',
      chainId: 56,
    }
  }
  if (mode === 'etherscan_v2') {
    const apiKey = (process.env.IUNLOCKMOBILE_ETHERSCAN_API_KEY ?? '').trim()
    return {
      mode,
      enabled: chainId === 1 && apiKey.length >= 8,
      apiUrl: ETHERSCAN_V2_URL,
      apiKey,
      chainKind: 'evm',
      chainId: 1,
    }
  }
  const apiKey = (process.env.IUNLOCKMOBILE_TRONGRID_API_KEY ?? '').trim()
  return {
    mode,
    enabled: chainId === 0 && apiKey.length >= 8,
    apiUrl: OFFICIAL_TRONGRID_URL,
    apiKey,
    chainKind: 'tron',
    chainId: 0,
  }
}

export function paymentRoutesConfiguration(): PaymentRouteConfig[] {
  const globallyEnabled = process.env.IUNLOCKMOBILE_TOPUP_ENABLED === '1'
  const fee = feeBasisPoints(process.env.IUNLOCKMOBILE_USDT_FEE_BPS)
  return PAYMENT_ROUTE_DEFINITIONS.map((definition) => {
    const provider = paymentProviderConfiguration(definition.providerMode, definition.chainId)
    const destinationAddress = cleanDestination(definition)
    const confirmationsRequired = integerInRange(
      process.env[definition.confirmationsEnv],
      DEFAULT_CONFIRMATIONS,
      2,
      120,
    )
    return {
      ...definition,
      enabled:
        globallyEnabled
        && process.env[definition.enabledEnv] === '1'
        && provider.enabled
        && Boolean(destinationAddress),
      providerReady: provider.enabled,
      destinationAddress,
      confirmationsRequired,
      feeBasisPoints: fee,
    }
  })
}

export function enabledPaymentRoutes(): PaymentRouteConfig[] {
  return paymentRoutesConfiguration().filter((route) => route.enabled)
}

export function paymentRouteDefinition(routeId: string): PaymentRouteDefinition | undefined {
  return PAYMENT_ROUTE_DEFINITIONS.find((route) => route.id === routeId)
}

export function paymentRouteConfiguration(routeId: string): PaymentRouteConfig | undefined {
  return paymentRoutesConfiguration().find((route) => route.id === routeId)
}

export function normalizeTransactionId(chainKind: PaymentChainKind, value: string): string | null {
  const clean = value.trim()
  if (chainKind === 'tron') return TRON_TRANSACTION_PATTERN.test(clean) ? clean.toLowerCase() : null
  return EVM_TRANSACTION_PATTERN.test(clean) ? clean.toLowerCase() : null
}

export function isTransactionHash(value: string): boolean {
  return Boolean(normalizeTransactionId('evm', value))
}

export function paymentTransactionUrl(routeId: string | null | undefined, transactionId: string): string | null {
  const route = routeId ? paymentRouteDefinition(routeId) : undefined
  if (!route || !normalizeTransactionId(route.chainKind, transactionId)) return null
  return `${route.explorerTransactionBaseUrl}${transactionId}`
}
