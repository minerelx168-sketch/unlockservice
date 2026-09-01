import { randomUUID } from 'node:crypto'
import {
  pollProviderRequest,
  providerConfiguration,
  submitProviderRequest,
  unlockProviderService,
} from './provider-api'

/**
 * Supplier adapter.
 *
 * The application owns order, escrow, and delivery semantics. A supplier only
 * accepts a normalized request and returns an accepted, delivered, or
 * unavailable outcome. The configured adapter supports synchronous provider
 * APIs and asynchronous DHRU placement/polling without leaking those protocols
 * into the order service.
 */

export type UnlockRequest = {
  imei: string
  brand: string
  /** Absent for a device service that does not depend on a network. */
  carrier?: string
  service: string
  /** Stable internal catalog key used to resolve an operator-approved mapping. */
  mappingKey: `carrier:${number}` | `service:${number}`
  delivery: 'remote' | 'code'
}

export type SupplierProviderMeta = {
  name: string
  mode: 'sync' | 'dhru'
  serviceId: string
  durationMs: number
  errorCode?: string
}

export type SupplierResult =
  | { status: 'accepted'; orderId: string; readyInMs: number; provider?: SupplierProviderMeta }
  | {
      status: 'delivered'
      orderId: string
      unlockCode: string | null
      result: Record<string, unknown>
      provider?: SupplierProviderMeta
    }
  | { status: 'unavailable'; orderId: string | null; message: string; provider?: SupplierProviderMeta }

export interface Supplier {
  readonly name: string
  submit(request: UnlockRequest): Promise<SupplierResult>
  poll(orderId: string, request: UnlockRequest): Promise<SupplierResult>
}

/**
 * How long the mock takes. Real turnarounds are the hours quoted on the
 * carrier; this is seconds so the flow can be walked end to end without
 * waiting a day.
 */
const MOCK_READY_MS = 6_000

/**
 * Deterministic by identifier, so a demo is reproducible and a test can
 * pick the branch it wants:
 *   last digit 0  → the carrier will not authorise it, credit is refunded
 *   anything else → delivered once the supplier has had its time
 */
function refusedByCarrier(imei: string): boolean {
  return imei.trim().slice(-1) === '0'
}

function mockUnlockCode(imei: string): string {
  let seed = 0
  for (const char of imei) seed = (seed * 31 + char.charCodeAt(0)) % 100_000_000
  return String(seed).padStart(8, '0')
}

export const mockSupplier: Supplier = {
  name: 'mock',

  async submit(request) {
    const orderId = `mock_${randomUUID()}`
    if (refusedByCarrier(request.imei)) {
      return {
        status: 'unavailable',
        orderId,
        message:
          'The carrier will not authorise this device. It may be under contract, reported lost, or blocked for unpaid bills.',
      }
    }
    return { status: 'accepted', orderId, readyInMs: MOCK_READY_MS }
  },

  async poll(orderId, request) {
    if (refusedByCarrier(request.imei)) {
      return { status: 'unavailable', orderId, message: 'The carrier declined this device.' }
    }

    const remote = request.delivery === 'remote'
    return {
      status: 'delivered',
      orderId,
      unlockCode: remote ? null : mockUnlockCode(request.imei),
      result: {
        source: 'mock-supplier',
        note: 'Sample result. Connect a real supplier to return live authorisations.',
        service: request.service,
        brand: request.brand,
        ...(request.carrier ? { carrier: request.carrier } : {}),
        identifier: request.imei,
        outcome: remote ? 'Released by the manufacturer' : 'Unlock code issued',
        instructions: remote
          ? 'Connect the device to Wi-Fi and follow the on-screen prompt, or restore it once in iTunes/Finder.'
          : 'Insert a SIM from a different network, then enter the code when the device asks for it.',
        permanent: 'Yes — the device stays unlocked through updates and resets.',
      },
    }
  },
}

function unlockCodeFrom(data: Record<string, unknown>) {
  const aliases = ['unlockCode', 'unlock_code', 'Unlock Code', 'UNLOCKCODE', 'code', 'CODE']
  for (const alias of aliases) {
    const value = data[alias]
    if (typeof value === 'string' && value.trim()) return value.trim().slice(0, 256)
    if (typeof value === 'number') return String(value)
  }
  return null
}

const configuredSupplier: Supplier = {
  get name() {
    return providerConfiguration().name
  },

  async submit(request) {
    const service = unlockProviderService(request.mappingKey)
    if (!service) {
      return {
        status: 'unavailable',
        orderId: null,
        message: 'This service is not mapped to an active supplier.',
      }
    }

    const outcome = await submitProviderRequest({ imei: request.imei, service })
    const provider = {
      name: providerConfiguration().name,
      mode: service.mode,
      serviceId: service.id,
      durationMs: outcome.timing.totalMs,
      ...(outcome.status === 'unavailable' ? { errorCode: outcome.code } : {}),
    }
    if (outcome.status === 'processing') {
      return { status: 'accepted', orderId: outcome.providerId, readyInMs: outcome.retryAfterMs, provider }
    }
    if (outcome.status === 'completed') {
      return {
        status: 'delivered',
        orderId: outcome.providerId ?? `sync_${randomUUID()}`,
        unlockCode: request.delivery === 'code' ? unlockCodeFrom(outcome.data) : null,
        result: { source: providerConfiguration().name, ...outcome.data },
        provider,
      }
    }
    return { status: 'unavailable', orderId: outcome.providerId, message: outcome.message, provider }
  },

  async poll(orderId, request) {
    const service = unlockProviderService(request.mappingKey)
    if (!service) {
      return { status: 'unavailable', orderId, message: 'This service is no longer mapped to an active supplier.' }
    }
    const outcome = await pollProviderRequest(orderId)
    const provider = {
      name: providerConfiguration().name,
      mode: service.mode,
      serviceId: service.id,
      durationMs: outcome.timing.totalMs,
      ...(outcome.status === 'unavailable' ? { errorCode: outcome.code } : {}),
    }
    if (outcome.status === 'processing') {
      return { status: 'accepted', orderId: outcome.providerId, readyInMs: outcome.retryAfterMs, provider }
    }
    if (outcome.status === 'completed') {
      return {
        status: 'delivered',
        orderId: outcome.providerId ?? orderId,
        unlockCode: request.delivery === 'code' ? unlockCodeFrom(outcome.data) : null,
        result: { source: providerConfiguration().name, ...outcome.data },
        provider,
      }
    }
    return {
      status: 'unavailable',
      orderId: outcome.providerId ?? orderId,
      message: outcome.message,
      provider,
    }
  },
}

/**
 * The mock derives an unlock code from a hash of the IMEI. That is exactly
 * what a demo needs and exactly what a paying customer must never receive,
 * and the order pipeline charges credit either way — so production refuses
 * it outright rather than quietly selling a fabricated code.
 *
 * This throws instead of returning an unavailable result because an
 * unavailable order refunds and closes, which would read as "the carrier
 * said no". The truth is that the operator has not finished configuring the
 * service, and the order should stay unplaced until they have.
 */
export function activeSupplier(): Supplier {
  if (providerConfiguration().enabled) return configuredSupplier
  if (process.env.NODE_ENV === 'production' && process.env.IUNLOCKMOBILE_ALLOW_MOCK_SUPPLIER !== '1') {
    throw new Error(
      'no supplier is configured: set IUNLOCKMOBILE_PROVIDER_MODE and its credentials, ' +
        'or keep IUNLOCKMOBILE_MAINTENANCE=1 so no order is accepted',
    )
  }
  return mockSupplier
}

/**
 * Maintenance mode, shaped so the client can count down against the
 * server clock rather than the device clock.
 */
export function maintenanceState() {
  const active = process.env.IUNLOCKMOBILE_MAINTENANCE === '1'
  return {
    active,
    state: active ? 'active' : 'inactive',
    serverNow: Math.floor(Date.now() / 1000),
    message: 'New unlock orders are paused while we work on the service. Existing orders are unaffected.',
  }
}
