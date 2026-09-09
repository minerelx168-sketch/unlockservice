'use server'

import { redirect } from 'next/navigation'
import { currentSession } from './auth'
import { withContinuation } from './continuation'
import { clearDeviceIntent, readDeviceIntent, writeDeviceIntent } from './device-intent'
import { deviceDomain, deviceImei } from './device-intent-value'
import { listPaidReportProducts } from './paid-reports'

type IntentState = { error?: string }

/** Navigation only: no provider request, order creation or balance mutation. */
export async function browseDevicesAction(_: IntentState, form: FormData): Promise<IntentState> {
  const domain = deviceDomain(form.get('domain'))
  if (!domain) return { error: 'Choose Phone Check or Unlock.' }
  const raw = form.get('imei')
  if (typeof raw !== 'string') return { error: 'Enter a valid 15-digit IMEI, or browse without one.' }
  if (raw.trim()) {
    const imei = deviceImei(raw)
    if (!imei) return { error: 'Enter a valid 15-digit IMEI, or clear it to browse without one.' }
    await writeDeviceIntent(imei, domain)
  } else {
    await clearDeviceIntent()
  }
  redirect(domain === 'unlock' ? '/services/unlock' : '/services/imei-check')
}

export async function continueDeviceServiceAction(_: IntentState, form: FormData): Promise<IntentState> {
  const domain = deviceDomain(form.get('domain'))
  const imei = deviceImei(form.get('imei'))
  if (!imei) return { error: 'Enter a valid 15-digit IMEI before continuing.' }
  const productCode = form.get('productCode')
  const product = listPaidReportProducts().find((entry) => entry.code === productCode && entry.domain === domain && entry.providerReady)
  if (!product) return { error: 'Choose an available service. Availability may have changed; refresh to see current options.' }
  await writeDeviceIntent(imei, product.domain, product.code)
  const target = `/user/reports/new?product=${encodeURIComponent(product.code)}`
  redirect(await currentSession() ? target : withContinuation('/login', target))
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
