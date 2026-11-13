import { timingSafeEqual } from 'node:crypto'
import { db } from '../db'

/**
 * Baseline metrics per AI platform for the admin endpoint.
 *
 * "sessions" here are checkout sessions (an order reference with an
 * attribution snapshot). Website sessions per source live in GA4; this view
 * is the server-side truth for money, which GA4 cannot provide.
 */
export type PlatformSummary = {
  platform: string
  confidence: string
  sessions: number
  verified_purchases: number
  gross_revenue_usd: number
  net_gross_profit_usd: number
  paid_cvr: number | null
  aov_usd: number | null
  refund_rate: number | null
  new_customers: number
  returning_customers: number
  top_landing_pages: { path: string; purchases: number }[]
  country_split: { country: string; purchases: number }[]
}

const round = (n: number) => Math.round(n * 100) / 100

export function aiReferralSummary(from: string, to: string): { from: string; to: string; platforms: PlatformSummary[]; totals: Omit<PlatformSummary, 'platform' | 'confidence' | 'top_landing_pages' | 'country_split'> } {
  const sessions = db().prepare(`SELECT attribution_source AS platform, attribution_confidence AS confidence, COUNT(*) AS n
    FROM order_ai_attribution WHERE created_at >= ? AND created_at < ? GROUP BY 1, 2`).all(from, to) as { platform: string; confidence: string; n: number }[]
  const sales = db().prepare(`SELECT attribution_source AS platform, attribution_confidence AS confidence, COUNT(*) AS purchases,
      SUM(net_collected_cents) AS revenue, SUM(gross_profit_cents) AS profit,
      SUM(CASE WHEN status <> 'succeeded' THEN 1 ELSE 0 END) AS refunds,
      SUM(CASE WHEN customer_type = 'new' THEN 1 ELSE 0 END) AS new_customers,
      SUM(CASE WHEN customer_type = 'returning' THEN 1 ELSE 0 END) AS returning_customers
    FROM ai_revenue_ledger WHERE paid_at >= ? AND paid_at < ? GROUP BY 1, 2`).all(from, to) as
    { platform: string; confidence: string; purchases: number; revenue: number; profit: number; refunds: number; new_customers: number; returning_customers: number }[]
  const pages = db().prepare(`SELECT attribution_source AS platform, attribution_confidence AS confidence, COALESCE(landing_page_path, '(unknown)') AS path, COUNT(*) AS n
    FROM ai_revenue_ledger WHERE paid_at >= ? AND paid_at < ? GROUP BY 1, 2, 3 ORDER BY n DESC`).all(from, to) as { platform: string; confidence: string; path: string; n: number }[]
  const countries = db().prepare(`SELECT attribution_source AS platform, attribution_confidence AS confidence, COALESCE(country, '??') AS country, COUNT(*) AS n
    FROM ai_revenue_ledger WHERE paid_at >= ? AND paid_at < ? GROUP BY 1, 2, 3 ORDER BY n DESC`).all(from, to) as { platform: string; confidence: string; country: string; n: number }[]

  const keys = new Map<string, { platform: string; confidence: string }>()
  for (const row of [...sessions, ...sales]) keys.set(`${row.platform}|${row.confidence}`, { platform: row.platform, confidence: row.confidence })
  const platforms = [...keys.values()].map(({ platform, confidence }) => {
    const match = (r: { platform: string; confidence: string }) => r.platform === platform && r.confidence === confidence
    const s = sessions.find(match)?.n ?? 0
    const p = sales.find(match)
    const purchases = p?.purchases ?? 0
    return {
      platform, confidence, sessions: s, verified_purchases: purchases,
      gross_revenue_usd: round((p?.revenue ?? 0) / 100), net_gross_profit_usd: round((p?.profit ?? 0) / 100),
      paid_cvr: s ? round(purchases / s * 100) / 100 : null,
      aov_usd: purchases ? round((p!.revenue / purchases) / 100) : null,
      refund_rate: purchases ? round((p!.refunds / purchases) * 100) / 100 : null,
      new_customers: p?.new_customers ?? 0, returning_customers: p?.returning_customers ?? 0,
      top_landing_pages: pages.filter(match).slice(0, 5).map(r => ({ path: r.path, purchases: r.n })),
      country_split: countries.filter(match).slice(0, 10).map(r => ({ country: r.country, purchases: r.n })),
    }
  }).sort((a, b) => (a.confidence === 'confirmed' ? 0 : a.confidence === 'probable' ? 1 : 2) - (b.confidence === 'confirmed' ? 0 : b.confidence === 'probable' ? 1 : 2) || b.verified_purchases - a.verified_purchases)

  const sum = (k: 'sessions' | 'verified_purchases' | 'gross_revenue_usd' | 'net_gross_profit_usd' | 'new_customers' | 'returning_customers') => platforms.reduce((t, p) => t + p[k], 0)
  const refunds = sales.reduce((t, r) => t + r.refunds, 0)
  const purchases = sum('verified_purchases'), revenue = sum('gross_revenue_usd')
  return {
    from, to, platforms,
    totals: {
      sessions: sum('sessions'), verified_purchases: purchases, gross_revenue_usd: round(revenue), net_gross_profit_usd: round(sum('net_gross_profit_usd')),
      paid_cvr: sum('sessions') ? round(purchases / sum('sessions') * 100) / 100 : null, aov_usd: purchases ? round(revenue / purchases) : null,
      refund_rate: purchases ? round(refunds / purchases * 100) / 100 : null, new_customers: sum('new_customers'), returning_customers: sum('returning_customers'),
    },
  }
}

/** Bearer ADMIN_METRICS_TOKEN (≥ 32 chars), compared in constant time. */
export function metricsTokenValid(header: string | null): boolean {
  const expected = process.env.ADMIN_METRICS_TOKEN?.trim() ?? ''
  if (expected.length < 32 || !header?.startsWith('Bearer ')) return false
  const given = Buffer.from(header.slice(7).trim()), want = Buffer.from(expected)
  return given.length === want.length && timingSafeEqual(given, want)
}

/** ?days=N (1–365, default 30) or ?from=YYYY-MM-DD&to=YYYY-MM-DD (to exclusive). */
export function summaryRange(params: URLSearchParams, now = new Date()): { from: string; to: string } {
  const date = /^\d{4}-\d{2}-\d{2}$/
  const from = params.get('from'), to = params.get('to')
  if (from && to && date.test(from) && date.test(to) && from < to) return { from: `${from} 00:00:00`, to: `${to} 00:00:00` }
  const days = Math.max(1, Math.min(365, Number(params.get('days')) || 30))
  const sqlite = (d: Date) => d.toISOString().slice(0, 19).replace('T', ' ')
  return { from: sqlite(new Date(now.getTime() - days * 86_400_000)), to: sqlite(new Date(now.getTime() + 60_000)) }
}
