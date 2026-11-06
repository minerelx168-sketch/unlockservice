import { adsDataManagerConfig, adsDeliveryStatus, deliverAdsConversions, reconcileAdsConversions, validateAdsDestination } from '../lib/ads-data-manager'
import { stageCompletedAdsPurchases } from '../lib/ads-purchase-staging'

async function main() {
  if (process.argv.includes('--preflight')) {
    const valid = await validateAdsDestination()
    console.log(valid ? 'DATA_MANAGER_VALIDATION_OK' : 'DATA_MANAGER_VALIDATION_FAILED')
    if (!valid) process.exitCode = 1
    return
  }
  if (process.argv.includes('--status')) { console.log(JSON.stringify(adsDeliveryStatus())); return }
  const config = adsDataManagerConfig()
  if (!config) throw new Error('Data Manager disabled or configuration incomplete')
  const staged = stageCompletedAdsPurchases(config.startAt)
  const reconcile = await reconcileAdsConversions()
  const delivery = await deliverAdsConversions()
  console.log(JSON.stringify({ staged, reconcile, delivery, status: adsDeliveryStatus() }))
  if (delivery.authFailed || delivery.uncertain || delivery.rejected || reconcile.errors || reconcile.rejected || reconcile.needsReview) process.exitCode = 1
}
main().catch(() => { console.error('Data Manager worker failed; check configuration and aggregate delivery status.'); process.exitCode = 1 })
