import { deliverOpenAiAds, openAiAdsStatus, validateOpenAiAds } from '../lib/openai-ads'
async function main() {
  if (process.argv.includes('--preflight')) {
    const ok = await validateOpenAiAds()
    console.log(ok ? 'OPENAI_VALIDATION_OK' : 'OPENAI_VALIDATION_FAILED')
    if (!ok) process.exitCode = 1
    return
  }
  if (process.argv.includes('--status')) { console.log(JSON.stringify(openAiAdsStatus())); return }
  const delivery = await deliverOpenAiAds()
  console.log(JSON.stringify({ delivery, status: openAiAdsStatus() }))
  if (delivery.disabled || delivery.uncertain || delivery.rejected) process.exitCode = 1
}
main().catch(() => { console.error('OpenAI conversion delivery failed; inspect aggregate status and configuration.'); process.exitCode = 1 })
