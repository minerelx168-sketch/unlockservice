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
    /* Catalogue sizes are public knowledge — they are on the order form.
       The ledger's account count is not, and this endpoint is open, so only
       the two numbers a deploy needs to fail on are reported. */
    const body = {
      ok: true,
      brands: listBrands().length,
      carriers: listCarriers().length,
      services: listDeviceServices().length,
      creditLedger: { mismatches: credits.mismatches, invalidHolds: credits.invalidHolds },
    }
    return NextResponse.json(body, { headers: { 'cache-control': 'no-store' } })
  } catch (error) {
    /* The reason goes to the log for whoever is watching the deploy; the
       response says only that it failed, because nothing else needs to
       learn what our database is doing. */
    console.error('[health]', error instanceof Error ? error.message : error)
    return NextResponse.json(
      { ok: false, error: 'not ready' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    )
  }
}
