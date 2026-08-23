import { randomUUID } from 'node:crypto'

/**
 * Supplier adapter.
 *
 * A real unlock goes out to a carrier or manufacturer database and comes
 * back hours later — never in the same request. Nothing here talks to a
 * real supplier; a mock stands in behind the same interface so the whole
 * flow, ledger included, can be exercised. Swapping in a real supplier is
 * this one module.
 */

export type UnlockRequest = {
  imei: string
  brand: string
  /** Absent for a device service that does not depend on a network. */
  carrier?: string
  service: string
  delivery: 'remote' | 'code'
}

export type SupplierResult =
  | { status: 'accepted'; orderId: string; readyInMs: number }
  | { status: 'delivered'; orderId: string; unlockCode: string | null; result: Record<string, unknown> }
  | { status: 'unavailable'; orderId: string | null; message: string }

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

function unlockCode(imei: string): string {
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
      unlockCode: remote ? null : unlockCode(request.imei),
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

export function activeSupplier(): Supplier {
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
