const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/

export const BNB_CHAIN_ID = 56
export const DEFAULT_CONFIRMATIONS = 15
export const ETHERSCAN_V2_URL = 'https://api.etherscan.io/v2/api'
export const OFFICIAL_BNB_RPC_URL = 'https://bsc-dataseed.bnbchain.org'

export type PaymentVerificationConfig = {
  mode: 'disabled' | 'bscscan' | 'bnb_rpc'
  enabled: boolean
  apiUrl: string
  apiKey: string
  chainId: number
  destinationAddress: string
  tokenContract: string
  tokenDecimals: number
  confirmationsRequired: number
  feeBasisPoints: number
}

function cleanAddress(value: string | undefined): string {
  const clean = value?.trim() ?? ''
  return ADDRESS_PATTERN.test(clean) ? clean.toLowerCase() : ''
}

function integerInRange(value: string | undefined, fallback: number, minimum: number, maximum: number): number {
  const parsed = Number(value ?? '')
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) return fallback
  return parsed
}

function feeBasisPoints(value: string | undefined): number {
  return integerInRange(value, 0, 0, 2_500)
}

export function paymentVerificationConfiguration(): PaymentVerificationConfig {
  const configuredMode = process.env.IUNLOCKMOBILE_TOPUP_MODE
  const mode = configuredMode === 'bscscan' || configuredMode === 'bnb_rpc' ? configuredMode : 'disabled'
  const apiKey = (process.env.IUNLOCKMOBILE_ETHERSCAN_API_KEY ?? process.env.IUNLOCKMOBILE_BSCSCAN_API_KEY ?? '').trim()
  const destinationAddress = cleanAddress(process.env.IUNLOCKMOBILE_USDT_BEP20_ADDRESS)
  const tokenContract = cleanAddress(process.env.IUNLOCKMOBILE_USDT_BEP20_CONTRACT)
  const tokenDecimals = integerInRange(process.env.IUNLOCKMOBILE_USDT_DECIMALS, 18, 0, 36)
  const confirmationsRequired = integerInRange(
    process.env.IUNLOCKMOBILE_BSC_CONFIRMATIONS,
    DEFAULT_CONFIRMATIONS,
    2,
    120,
  )

  const providerReady = mode === 'bnb_rpc' || (mode === 'bscscan' && apiKey.length >= 8)

  return {
    mode,
    enabled: providerReady && Boolean(destinationAddress) && Boolean(tokenContract),
    apiUrl: mode === 'bnb_rpc' ? OFFICIAL_BNB_RPC_URL : ETHERSCAN_V2_URL,
    apiKey,
    chainId: BNB_CHAIN_ID,
    destinationAddress,
    tokenContract,
    tokenDecimals,
    confirmationsRequired,
    feeBasisPoints: feeBasisPoints(process.env.IUNLOCKMOBILE_USDT_FEE_BPS),
  }
}

export function normalizeEvmAddress(value: string): string | null {
  const clean = value.trim()
  return ADDRESS_PATTERN.test(clean) ? clean.toLowerCase() : null
}

export function isTransactionHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value.trim())
}
