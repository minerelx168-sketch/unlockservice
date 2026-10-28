'use server'

import { serviceIdentifier, identifierField } from './service-identifier'
import { redirect } from 'next/navigation'
import { currentSession } from './auth'
import { withContinuation } from './continuation'
import { guestCheckoutEnabled } from './guest-checkout'
import { guestCryptoEnabled } from './guest-crypto'
import { clearDeviceIntent, readDeviceIntent, writeDeviceIntent } from './device-intent'
import { deviceDomain, deviceImei, deviceEmail } from './device-intent-value'
import { listPaidReportProducts } from './paid-reports'
import { listPublicProviderProducts } from './public-provider-catalog'

type IntentState = { error?: string }

/** Navigation only: no provider request, order creation or balance mutation. */
export async function browseDevicesAction(_: IntentState, form: FormData): Promise<IntentState> {
  const domain = deviceDomain(form.get('domain'))
  if (!domain) return { error: 'Choose Phone Check or Unlock.' }
  const raw = form.get('imei')
  if (typeof raw !== 'string') return { error: 'Enter a valid 15-digit IMEI, or browse without one.' }
  /* A report chosen in the hero widget travels with the visitor. Anything
     that is not in today's catalog is dropped, not errored: the page they
     land on lists what is. */
  const requestedCode = form.get('productCode')
  const product = typeof requestedCode === 'string' && requestedCode
    ? listPublicProviderProducts(domain).find((entry) => entry.productCode === requestedCode)
    : undefined
  if (raw.trim()) {
    const imei = deviceImei(raw)
    if (!imei) return { error: 'Enter a valid 15-digit IMEI, or clear it to browse without one.' }
    await writeDeviceIntent(imei, domain, product?.productCode)
  } else {
    await clearDeviceIntent()
  }
  if (domain === 'unlock') redirect(raw.trim() ? '/services/unlock/catalog' : '/services/unlock')
  /* With an IMEI in hand the visitor is ready to order, so the page lands
     them on the form rather than at the top. A hash would be dropped by
     the action redirect; the page reads this flag instead. */
  const start = raw.trim() ? 'start=1' : ''
  const query = [product ? `product=${encodeURIComponent(product.productCode)}` : '', start].filter(Boolean).join('&')
  redirect(query ? `/services/imei-check?${query}` : '/services/imei-check')
}

/** The unlock catalog is revealed only after the same IMEI validation for every visitor.
 * This is a browsing step, not a device lookup or an order. */
export async function showUnlockServicesAction(_: IntentState, form: FormData): Promise<IntentState> {
  const imei = deviceImei(form.get('imei'))
  if (!imei) return { error: 'Enter a valid 15-digit IMEI before viewing unlock services.' }
  const requestedCode = form.get('productCode')
  const product = typeof requestedCode === 'string' && requestedCode
    ? listPublicProviderProducts('unlock').find((entry) => entry.productCode === requestedCode)
    : undefined
  if (requestedCode !== null && (!product || product.status !== 'available')) {
    return { error: 'This service is no longer available. Choose another service or refresh the page.' }
  }
  await writeDeviceIntent(imei, 'unlock', product?.productCode)
  if (product && guestCheckoutEnabled()) redirect(`/checkout?product=${encodeURIComponent(product.productCode)}`)
  redirect('/services/unlock/catalog')
}

export async function continueDeviceServiceAction(_: IntentState, form: FormData): Promise<IntentState> {
  const domain = deviceDomain(form.get('domain'))
  const productCode = form.get('productCode')
  const product = listPaidReportProducts().find((entry) => entry.code === productCode && entry.domain === domain && entry.providerReady)
  if (!product) return { error: 'Choose an available service. Availability may have changed; refresh to see current options.' }
  const imei = serviceIdentifier(form.get('imei'), product.inputType)
  if (!imei) return { error: identifierField(product.inputType).error }
  const rawEmail = form.get('email')
  const email = deviceEmail(rawEmail)
  if (rawEmail !== null && !email) return { error: 'Enter a valid email address so we can deliver your result.' }
  const crypto = form.get('paymentMethod') === 'crypto'
  if (crypto && !guestCryptoEnabled()) return { error: 'Crypto checkout is temporarily unavailable. Please try again shortly.' }
  const smallCardOrder = !crypto && guestCheckoutEnabled() && product.priceCents < 100
  const customer = smallCardOrder ? await currentSession() : null
  if (smallCardOrder && customer && customer.user.account_type !== 'customer') {
    return { error: 'Use a customer account for card orders below $1.00, or choose crypto.' }
  }
  await writeDeviceIntent(imei, product.domain, product.code, email ?? undefined, product.inputType)
  const target = `/user/reports/new?product=${encodeURIComponent(product.code)}`
  if (smallCardOrder && !customer) {
    redirect(withContinuation('/register', `/checkout?product=${encodeURIComponent(product.code)}&method=card`))
  }
  redirect(crypto || guestCheckoutEnabled() ? `/checkout?product=${encodeURIComponent(product.code)}${crypto ? '&method=crypto' : ''}` : target)
}

/** Explicit URL result for client checkout handlers; registration is not payment. */
export async function prepareSmallCardAccountAction(value: {
  productCode: string; imei: string; email: string; domain: 'imei_check' | 'unlock'
}): Promise<IntentState & { url?: string }> {
  if (!value || typeof value !== 'object') return { error: 'Unable to save your selection.' }
  const domain = deviceDomain(value.domain), email = deviceEmail(value.email)
  if (!email) return { error: 'Enter a valid email address so we can deliver your result.' }
  const product = listPaidReportProducts().find(entry => entry.code === value.productCode && entry.domain === domain && entry.providerReady)
  if (!product || product.priceCents <= 0 || product.priceCents >= 100) return { error: 'This service is no longer eligible for small card checkout. Refresh to review the current price.' }
  const imei = serviceIdentifier(value.imei, product.inputType)
  if (!imei) return { error: identifierField(product.inputType).error }
  if (!guestCheckoutEnabled()) return { error: 'Card checkout is temporarily unavailable. Please try again shortly.' }
  const customer = await currentSession()
  if (customer && customer.user.account_type !== 'customer') return { error: 'Use a customer account for card orders below $1.00, or choose crypto.' }
  await writeDeviceIntent(imei, product.domain, product.code, email, product.inputType)
  const checkout = `/checkout?product=${encodeURIComponent(product.code)}&method=card`
  return { url: customer ? checkout : withContinuation('/register', checkout) }
}

/** Save a changed IMEI before leaving checkout for trusted payment confirmation. */
export async function saveDeviceIntentAction(value: { imei: string; productCode?: string; domain: 'imei_check' | 'unlock' }): Promise<IntentState> {
  if (!(await currentSession())) return { error: 'Your session has expired. Sign in again before continuing.' }
  if (!value || typeof value !== 'object') return { error: 'Unable to save your selection.' }
  const domain = deviceDomain(value.domain)
  const product = listPaidReportProducts().find((entry) => entry.code === value.productCode && entry.domain === domain && entry.providerReady)
  if (!product) return { error: 'Choose an available service before adding credit.' }
  if (typeof value.imei === 'string' && !value.imei.trim()) {
    await clearDeviceIntent()
    return {}
  }
  const imei = serviceIdentifier(value.imei, product.inputType)
  if (!imei) return { error: identifierField(product.inputType).error }
  await writeDeviceIntent(imei, product.domain, product.code, undefined, product.inputType)
  return {}
}


/** Read the browser's current draft after order acceptance, not the older
 * cookie snapshot that accompanied the potentially slow provider request. */
export async function clearAcceptedDeviceIntentAction(value: { imei: string; productCode: string }): Promise<void> {
  if (!value || typeof value !== 'object') return
  const intent = await readDeviceIntent()
  if (intent && intent.imei === serviceIdentifier(value.imei, intent.inputType ?? 'imei') && intent.productCode === value.productCode) {
    await clearDeviceIntent()
  }
}

