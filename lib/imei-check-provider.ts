import { randomUUID } from 'node:crypto'
import {
  imeiProviderService,
  pollProviderRequest,
  providerConfiguration,
  submitProviderRequest,
} from './provider-api'
import { buildProviderReport } from './imei-report'

/** Provider-neutral request for a non-payment IMEI report. */
export type ImeiCheckRequest = {
  imei: string
  checkType: string
}

export type ImeiCheckResult = {
  status: 'processing' | 'completed' | 'unavailable'
  provider: string
  providerCheckId: string | null
  retryAfterMs?: number
  result: Record<string, unknown> | null
  message?: string
  errorCode?: string
}

export interface ImeiCheckProvider {
  readonly name: string
  check(request: ImeiCheckRequest): Promise<ImeiCheckResult>
  poll?(providerCheckId: string, checkType: string): Promise<ImeiCheckResult>
}

/**
 * Safe first-stage provider. It proves the end-to-end report pipeline without
 * pretending that local validation is carrier, blacklist, warranty, or GSMA data.
 */
export const localValidationCheckProvider: ImeiCheckProvider = {
  name: 'local-validation',

  async check() {
    return {
      status: 'completed',
      provider: 'local-validation',
      providerCheckId: `local_${randomUUID()}`,
      result: {
        kind: 'format_checksum',
        title: 'IMEI format check complete',
        summary: 'This free check validates the 15-digit format and Luhn checksum only. It does not look up carrier, blacklist, warranty, lock or other device data.',
        checks: [
          { key: 'format', label: '15-digit format', status: 'passed' },
          { key: 'checksum', label: 'Luhn checksum', status: 'passed' },
        ],
      },
    }
  },
}

const configuredImeiProvider: ImeiCheckProvider = {
  get name() {
    return providerConfiguration().name
  },

  async check(request) {
    const service = imeiProviderService(request.checkType)
    if (!service) return localValidationCheckProvider.check(request)

    const config = providerConfiguration()
    const outcome = await submitProviderRequest({ imei: request.imei, service })
    if (outcome.status === 'processing') {
      return {
        status: 'processing',
        provider: config.name,
        providerCheckId: outcome.providerId,
        retryAfterMs: outcome.retryAfterMs,
        result: null,
      }
    }
    if (outcome.status === 'completed') {
      return {
        status: 'completed',
        provider: config.name,
        providerCheckId: outcome.providerId,
        result: buildProviderReport(request.checkType, config.name, outcome.data),
      }
    }
    return {
      status: 'unavailable',
      provider: config.name,
      providerCheckId: outcome.providerId,
      result: null,
      message: outcome.message,
      errorCode: outcome.code,
    }
  },

  async poll(providerCheckId, checkType) {
    const config = providerConfiguration()
    const outcome = await pollProviderRequest(providerCheckId)
    if (outcome.status === 'processing') {
      return {
        status: 'processing',
        provider: config.name,
        providerCheckId: outcome.providerId,
        retryAfterMs: outcome.retryAfterMs,
        result: null,
      }
    }
    if (outcome.status === 'completed') {
      return {
        status: 'completed',
        provider: config.name,
        providerCheckId: outcome.providerId,
        result: buildProviderReport(checkType, config.name, outcome.data),
      }
    }
    return {
      status: 'unavailable',
      provider: config.name,
      providerCheckId: outcome.providerId,
      result: null,
      message: outcome.message,
      errorCode: outcome.code,
    }
  },
}

export function activeImeiCheckProvider(): ImeiCheckProvider {
  return providerConfiguration().enabled ? configuredImeiProvider : localValidationCheckProvider
}
