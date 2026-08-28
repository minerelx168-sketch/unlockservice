import { randomUUID } from 'node:crypto'

/** Provider-neutral request for a non-payment IMEI report. */
export type ImeiCheckRequest = {
  imei: string
  checkType: 'basic'
}

export type ImeiCheckResult = {
  status: 'completed' | 'unavailable'
  provider: string
  providerCheckId: string | null
  result: Record<string, unknown> | null
  message?: string
}

export interface ImeiCheckProvider {
  readonly name: string
  check(request: ImeiCheckRequest): Promise<ImeiCheckResult>
}

/**
 * Safe first-stage provider. It proves the end-to-end report pipeline without
 * pretending that local validation is carrier, blacklist, warranty, or GSMA data.
 */
export const localValidationCheckProvider: ImeiCheckProvider = {
  name: 'local-validation',

  async check(request) {
    return {
      status: 'completed',
      provider: 'local-validation',
      providerCheckId: `local_${randomUUID()}`,
      result: {
        checkType: request.checkType,
        source: 'local-validation',
        demo: true,
        title: 'IMEI format check complete',
        summary: 'The IMEI passed the 15-digit Luhn validation used before a provider lookup.',
        checks: [
          { key: 'format', label: '15-digit format', status: 'passed' },
          { key: 'checksum', label: 'Luhn checksum', status: 'passed' },
        ],
        nextStep: 'Connect an authorized device-data provider to add carrier, blacklist, warranty, or model results.',
      },
    }
  },
}

export function activeImeiCheckProvider(): ImeiCheckProvider {
  return localValidationCheckProvider
}
