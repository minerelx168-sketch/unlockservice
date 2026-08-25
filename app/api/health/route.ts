import { NextResponse } from 'next/server'
import { listBrands, listCarriers, listDeviceServices } from '@/lib/db'
import { creditIntegrity } from '@/lib/credits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Readiness check for deploys. It deliberately reads the catalog rather
 * than returning a constant: that opens the database, creates the schema
 * on a fresh box, and makes a deploy fail loudly if the data directory is
 * unwritable — which a static "ok" would sail straight past.
 *
 * Counts only. Nothing here is worth authenticating for and nothing about
 * a customer is exposed.
 */
export async function GET() {
  try {
    const credits = creditIntegrity()
    if (credits.mismatches > 0 || credits.invalidHolds > 0) {
      throw new Error(
        `credit integrity failed: ${credits.mismatches} balance mismatches, ${credits.invalidHolds} invalid holds`,
      )
    }
    const body = {
      ok: true,
      brands: listBrands().length,
      carriers: listCarriers().length,
      services: listDeviceServices().length,
      creditLedger: credits,
    }
    return NextResponse.json(body, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : 'database unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }
}
