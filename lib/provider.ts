import { randomUUID } from 'node:crypto'
import type { ServiceRow } from './db'

/**
 * Provider adapter.
 *
 * The observed system hands an order to an external lookup provider and
 * either gets an answer back immediately or an "accepted, poll me" reply.
 * Nothing here talks to a real provider — there is no contract yet — so a
 * mock stands in behind the same interface. Swapping in a real provider is
 * one module: keep the shape of ProviderResult and the rest of the flow,
 * ledger included, is untouched.
 */

export type ProviderResult =
  | { status: 'success'; orderId: string; response: Record<string, unknown> }
  | { status: 'pending'; orderId: string; readyInMs: number }
  | { status: 'error'; orderId: string | null; message: string }

export interface Provider {
  readonly name: string
  submit(service: ServiceRow, identifier: string): Promise<ProviderResult>
  poll(orderId: string, service: ServiceRow, identifier: string): Promise<ProviderResult>
}

/** How long a mock "pending" order takes before it can be resolved. */
const PENDING_MS = 8_000

/**
 * Deterministic by identifier so a demo is reproducible and a test can
 * pick the branch it wants:
 *   last digit 0        → the provider fails, and the hold is refunded
 *   last digit 1, 2, 3  → accepted, resolves on a later poll
 *   anything else       → answered immediately
 */
function branchFor(identifier: string): 'error' | 'pending' | 'success' {
  const last = identifier.trim().slice(-1)
  if (last === '0') return 'error'
  if (last === '1' || last === '2' || last === '3') return 'pending'
  return 'success'
}

function mockResponse(service: ServiceRow, identifier: string): Record<string, unknown> {
  const tail = identifier.slice(-4)
  return {
    source: 'mock-provider',
    note: 'Sample data. Connect a real lookup provider to return live results.',
    service: service.name,
    identifier,
    model: 'iPhone 13 Pro',
    storage: '256GB',
    colour: 'Sierra Blue',
    purchaseCountry: 'United States',
    simLock: tail.endsWith('5') ? 'Locked' : 'Unlocked',
    blacklistStatus: tail.endsWith('7') ? 'Reported lost' : 'Clean',
    findMyStatus: 'OFF',
    warranty: 'Out of warranty',
  }
}

export const mockProvider: Provider = {
  name: 'mock',

  async submit(service, identifier) {
    const orderId = `mock_${randomUUID()}`
    const branch = branchFor(identifier)

    if (branch === 'error') {
      return { status: 'error', orderId, message: 'The provider rejected this identifier.' }
    }
    if (branch === 'pending') {
      return { status: 'pending', orderId, readyInMs: PENDING_MS }
    }
    return { status: 'success', orderId, response: mockResponse(service, identifier) }
  },

  async poll(orderId, service, identifier) {
    return { status: 'success', orderId, response: mockResponse(service, identifier) }
  },
}

export function activeProvider(): Provider {
  return mockProvider
}

/**
 * Maintenance mode, shaped like the observed config object so the client
 * can count down against the server clock rather than the device clock.
 */
export function maintenanceState() {
  const active = process.env.OPENLINE_MAINTENANCE === '1'
  return {
    active,
    state: active ? 'active' : 'inactive',
    serverNow: Math.floor(Date.now() / 1000),
    message:
      'IMEI and serial number checks are temporarily unavailable while we improve the service.',
  }
}
