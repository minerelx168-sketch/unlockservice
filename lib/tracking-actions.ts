'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { requireAdmin } from './auth'
import { db } from './db'

/** Daily figures copied by an administrator from Google Ads and GA4 until their APIs are connected. */
export async function saveTrackingDailyAction(data: FormData) {
  await requireAdmin()
  const day = String(data.get('day') ?? '')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || Number.isNaN(Date.parse(`${day}T00:00:00Z`))) redirect('/admin/tracking?saved=invalid')
  const count = (name: string) => {
    const raw = String(data.get(name) ?? '').trim()
    if (raw === '') return null
    const value = Number(raw)
    return Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000 ? value : undefined
  }
  const clicks = count('ads_clicks'), sessions = count('ga4_cpc_sessions'), conversions = count('ads_conversions')
  if (clicks === undefined || sessions === undefined || conversions === undefined) redirect('/admin/tracking?saved=invalid')
  db().prepare(`INSERT INTO tracking_daily_manual(day,ads_clicks,ga4_cpc_sessions,ads_conversions,updated_at) VALUES(?,?,?,?,datetime('now'))
    ON CONFLICT(day) DO UPDATE SET ads_clicks=COALESCE(excluded.ads_clicks,ads_clicks),ga4_cpc_sessions=COALESCE(excluded.ga4_cpc_sessions,ga4_cpc_sessions),
    ads_conversions=COALESCE(excluded.ads_conversions,ads_conversions),updated_at=datetime('now')`).run(day, clicks, sessions, conversions)
  revalidatePath('/admin/tracking')
  redirect('/admin/tracking?saved=1#daily')
}
