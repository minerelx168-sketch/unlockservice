'use server'

import { redirect } from 'next/navigation'
import { currentSession } from './auth'
import { guestCheckoutEnabled } from './guest-checkout'
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
  const imei = deviceImei(form.get('imei'))
  if (!imei) return { error: 'Enter a valid 15-digit IMEI before continuing.' }
  const productCode = form.get('productCode')
  const product = listPaidReportProducts().find((entry) => entry.code === productCode && entry.domain === domain && entry.providerReady)
  if (!product) return { error: 'Choose an available service. Availability may have changed; refresh to see current options.' }
  const rawEmail = form.get('email')
  const email = deviceEmail(rawEmail)
  if (rawEmail !== null && !email) return { error: 'Enter a valid email address so we can deliver your result.' }
  await writeDeviceIntent(imei, product.domain, product.code, email ?? undefined)
  const target = `/user/reports/new?product=${encodeURIComponent(product.code)}`
  redirect(guestCheckoutEnabled() ? `/checkout?product=${encodeURIComponent(product.code)}` : target)
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
  const imei = deviceImei(value.imei)
  if (!imei) return { error: 'Enter a valid 15-digit IMEI, or clear it before adding credit.' }
  await writeDeviceIntent(imei, product.domain, product.code)
  return {}
}


/** Read the browser's current draft after order acceptance, not the older
 * cookie snapshot that accompanied the potentially slow provider request. */
export async function clearAcceptedDeviceIntentAction(value: { imei: string; productCode: string }): Promise<void> {
  if (!value || typeof value !== 'object') return
  const intent = await readDeviceIntent()
  if (intent && intent.imei === deviceImei(value.imei) && intent.productCode === value.productCode) {
    await clearDeviceIntent()
  }
}
