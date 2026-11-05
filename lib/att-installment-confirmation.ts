import { providerProductByCode } from './provider-products'

export const ATT_INSTALLMENT_CONFIRMATION_TEXT =
  'I confirm that this AT&T device is fully paid off and has no outstanding installment plan balance. I understand that devices with an unpaid installment plan are not eligible for unlocking.'

export const ATT_INSTALLMENT_CONFIRMATION_REQUIRED_CODE = 'att_installment_confirmation_required'

function normalizedCarrierName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toUpperCase()
    .replace(/&/g, ' AND ')
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Match trusted catalog/carrier names such as AT&T, AT AND T and ATT. */
export function isAttName(value: string): boolean {
  const name = normalizedCarrierName(value)
  return /(?:^| )AT(?: AND)? T(?: |$)/.test(name) || /(?:^| )ATT(?: |$)/.test(name)
}

/**
 * The acknowledgement applies only to an unlock product whose trusted
 * provider-catalog name identifies AT&T. Never derive this from a request's
 * carrier/name fields: the product code is resolved against our catalog.
 */
export function requiresAttInstallmentConfirmation(productCode: string): boolean {
  const product = providerProductByCode(productCode.trim().toUpperCase())
  if (!product || product.domain !== 'unlock') return false

  // Match the catalog's common AT&T spellings without treating a paid
  // check/report whose name mentions AT&T as an unlock service. The name is
  // normalized only after the product itself has been resolved from catalog.
  return isAttName(product.name)
}

export class AttInstallmentConfirmationError extends Error {
  readonly code = ATT_INSTALLMENT_CONFIRMATION_REQUIRED_CODE
  readonly status = 400

  constructor() {
    super(ATT_INSTALLMENT_CONFIRMATION_TEXT)
    this.name = 'AttInstallmentConfirmationError'
  }
}

/** Strictly require a literal boolean true, never truthy strings or numbers. */
export function assertAttInstallmentConfirmation(productCode: string, value: unknown): void {
  if (requiresAttInstallmentConfirmation(productCode) && value !== true) {
    throw new AttInstallmentConfirmationError()
  }
}

export function assertAttInstallmentConfirmationForTrustedName(name: string, value: unknown): void {
  if (isAttName(name) && value !== true) throw new AttInstallmentConfirmationError()
}
