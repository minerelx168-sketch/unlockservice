import assert from 'node:assert/strict'
import test from 'node:test'

process.env.IUNLOCKMOBILE_TOPUP_ENABLED = '1'
process.env.IUNLOCKMOBILE_TRON_RECEIVING_ADDRESS = 'TBXSw8fM4jpQkGc6zZjsVABFpVN7UvXPdV'
process.env.IUNLOCKMOBILE_EVM_RECEIVING_ADDRESS = '0x1111111111111111111111111111111111111111'
process.env.IUNLOCKMOBILE_TOPUP_TRC20_USDT_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_BEP20_BSC_USD_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_BEP20_USDC_ENABLED = '1'
process.env.IUNLOCKMOBILE_TOPUP_ERC20_USDT_ENABLED = '0'
process.env.IUNLOCKMOBILE_TOPUP_ERC20_USDC_ENABLED = '0'
process.env.IUNLOCKMOBILE_TRONGRID_API_KEY = 'test-trongrid-key'
process.env.IUNLOCKMOBILE_ETHERSCAN_API_KEY = 'test-etherscan-key'

test('initial rollout exposes only TRC-20 and BEP-20 routes while ERC-20 stays disabled', async () => {
  const payments = await import('../lib/payments')
  const config = await import('../lib/payment-config')
  assert.deepEqual(
    payments.GATEWAYS.map((gateway) => gateway.id).sort(),
    ['bsc-usdc-peg', 'bsc-usdt-peg', 'usdt-trc20'],
  )
  assert.equal(payments.GATEWAYS.some((gateway) => gateway.networkId === 'ethereum-mainnet'), false)
  assert.equal(config.paymentRouteConfiguration('usdt-erc20')?.enabled, false)
  assert.equal(config.paymentRouteConfiguration('usdc-erc20')?.enabled, false)
  assert.equal(config.paymentRouteConfiguration('usdt-trc20')?.enabled, true)
  assert.equal(config.paymentRouteConfiguration('bsc-usdt-peg')?.enabled, true)
  assert.equal(config.paymentRouteConfiguration('bsc-usdc-peg')?.enabled, true)
})
