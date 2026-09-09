import { cookies } from 'next/headers'
import { DEVICE_INTENT_COOKIE } from './cookie-names'
import { DEVICE_INTENT_TTL_SECONDS, deviceImei, parseDeviceIntent, type DeviceDomain } from './device-intent-value'

export async function readDeviceIntent() {
  return parseDeviceIntent((await cookies()).get(DEVICE_INTENT_COOKIE)?.value)
}

export async function clearDeviceIntent() {
  (await cookies()).set(DEVICE_INTENT_COOKIE, '', {
    path: '/', maxAge: 0, httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
  })
}

export async function writeDeviceIntent(imei: string, domain: DeviceDomain, productCode?: string) {
  const digits = deviceImei(imei)
  if (!digits) throw new Error('Invalid device identifier')
  const jar = await cookies()
  jar.set(DEVICE_INTENT_COOKIE, JSON.stringify({
    imei: digits, domain, productCode, expiresAt: Date.now() + DEVICE_INTENT_TTL_SECONDS * 1000,
  }), {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production',
    path: '/', maxAge: DEVICE_INTENT_TTL_SECONDS,
  })
}
