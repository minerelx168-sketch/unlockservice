import { deliverPurchaseAnalytics } from '../lib/purchase-analytics'
import { processGuestCheckouts, processPaidGuestCheckouts } from '../lib/guest-checkout'
import { deliverPaymentAnalytics } from '../lib/payment-analytics'
import { deliverOrderNotifications } from '../lib/order-notifications'
import { pollProviderJobs } from '../lib/provider-jobs'
import { pollInvoiceVerifications } from '../lib/payment-verification'
import { scanPaymentWallets } from '../lib/payment-watcher'
import { processWhopEvents, reconcileWhopPayments } from '../lib/whop'

async function main() {
  const limit = Number(process.argv[2] ?? 20)
  const boundedLimit = Number.isFinite(limit) ? limit : 20
  const whop = await processWhopEvents(Math.min(boundedLimit, 5))
  const paidGuests = await processPaidGuestCheckouts(5).catch(() => ({ checked: 0, errors: 1 }))
  const provider = await pollProviderJobs(boundedLimit)
  // Find payments nobody pasted before checking the attached ones, so a
  // transfer detected now is verified in this same run.
  const watcher = await scanPaymentWallets()
  const payments = await pollInvoiceVerifications(boundedLimit)
  const whopReconciliation = await reconcileWhopPayments(Math.min(boundedLimit, 5))
  const guestCheckouts = await processGuestCheckouts(5).catch(() => ({ checked: 0, errors: 1 }))
  const paymentAnalytics = await deliverPaymentAnalytics(boundedLimit).catch(() => ({ failed: true }))
  const purchaseAnalytics = await deliverPurchaseAnalytics(boundedLimit).catch(() => ({ failed: true }))
  const notifications = await deliverOrderNotifications(boundedLimit)
  process.stdout.write(`${JSON.stringify({ paidGuests, provider, watcher, payments, whop, whopReconciliation, guestCheckouts, paymentAnalytics, purchaseAnalytics, notifications })}\n`)
  if (
    paidGuests.errors > 0
    || guestCheckouts.errors > 0
    || provider.errors > 0
    || watcher.errors > 0
    || payments.errors > 0
    || whop.errors > 0
    || whopReconciliation.errors > 0
    || notifications.failed > 0
    || notifications.leaseLost > 0
  ) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : 'Provider, payment verification, or notification delivery failed.'
  process.stderr.write(`${message}\n`)
  process.exitCode = 1
})

