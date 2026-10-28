import { luhnValid } from './imei'

export type ServiceInputType = 'imei' | 'serial' | 'serial_or_imei' | 'phone' | 'case_id' | 'ecid' | 'udid' | 'unlock_number'
export function serviceInputType(value: unknown): ServiceInputType | null {
  return value === 'imei' || value === 'serial' || value === 'serial_or_imei' || value === 'phone' || value === 'case_id' || value === 'ecid' || value === 'udid' || value === 'unlock_number' ? value : null
}

/** Validate the whole value. Never truncate or turn arbitrary text into a different identifier. */
export function serviceIdentifier(value: unknown, type: ServiceInputType = 'imei'): string | null {
  if (typeof value !== 'string' || value.length > 80 || (type === 'imei' && value.length > 40)) return null
  const raw = value.trim()
  if (type === 'imei' || (type === 'serial_or_imei' && /^[\d\s-]+$/.test(raw))) {
    if (!/^[\d\s-]+$/.test(raw)) return null
    const digits = raw.replace(/[\s-]/g, '')
    return /^\d{15}$/.test(digits) && !/^0+$/.test(digits) && luhnValid(digits) ? digits : null
  }
  if (type === 'serial' || type === 'serial_or_imei') {
    return /^[a-zA-Z0-9]{6,24}$/.test(raw) ? raw.toUpperCase() : null
  }
  if (type === 'phone') {
    if (!/^\+?[\d ()-]+$/.test(raw)) return null
    const digits = raw.replace(/[+ ()-]/g, '')
    return /^[1-9]\d{7,14}$/.test(digits) ? digits : null
  }
  if (type === 'udid') return /^(?:[a-fA-F0-9]{40}|[a-fA-F0-9]{8}-[a-fA-F0-9]{16})$/.test(raw) ? raw.toUpperCase() : null
  if (type === 'unlock_number') return /^[a-zA-Z0-9-]{6,64}$/.test(raw) ? raw.toUpperCase() : null
  if (type === 'ecid') return /^(?:0[xX])?[a-fA-F0-9]{8,20}$/.test(raw) ? raw.toUpperCase() : null
  if (type === 'case_id') return /^\d{8,20}$/.test(raw) ? raw : null
  return null
}

export function identifierField(type: ServiceInputType = 'imei') {
  const fields = {
    imei: { label: 'IMEI number', placeholder: '15-digit IMEI', hint: 'Dial *#06# or find it in Settings. Check every digit before paying.', error: 'Enter a valid 15-digit IMEI.', inputMode: 'numeric' as const },
    serial: { label: 'Serial number', placeholder: 'Device serial number', hint: 'Copy the serial number from device settings or the original packaging.', error: 'Enter a serial number using 6–24 letters or digits.', inputMode: 'text' as const },
    serial_or_imei: { label: 'IMEI or serial number', placeholder: 'IMEI or serial number', hint: 'Use the IMEI or serial number required by your selected service.', error: 'Enter a valid 15-digit IMEI or a 6–24 character serial number.', inputMode: 'text' as const },
    phone: { label: 'Phone number with country code', placeholder: 'For example: +1 202 555 0123', hint: 'Include the country calling code. Do not include a local leading zero.', error: 'Enter a phone number with country code (8–15 digits).', inputMode: 'tel' as const },
    udid: { label: 'Device UDID', placeholder: 'Your device UDID', hint: 'Copy the complete UDID required by this service, including its hyphen if shown.', error: 'Enter the complete device UDID (40 hexadecimal characters, or 8–16 with a hyphen).', inputMode: 'text' as const },
    unlock_number: { label: 'Unlock number (FSN)', placeholder: 'Unlock number from your device', hint: 'Use the unlock number specified in the service requirements, not the IMEI.', error: 'Enter an unlock number using 6–64 letters, digits or hyphens.', inputMode: 'text' as const },
    ecid: { label: 'ECID', placeholder: 'Device ECID', hint: 'Copy the ECID shown by your device tool. Keep its original decimal or hexadecimal format.', error: 'Enter a valid ECID using 8–20 decimal or hexadecimal characters.', inputMode: 'text' as const },
    case_id: { label: 'Apple Case ID', placeholder: 'Your Apple support Case ID', hint: 'Enter the Case ID from your Apple support record.', error: 'Enter an Apple Case ID using 8–20 digits.', inputMode: 'numeric' as const },
  }
  return fields[type]
}
