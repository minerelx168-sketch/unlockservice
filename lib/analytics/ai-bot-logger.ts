/**
 * AI crawler hit logging. Edge-safe and non-blocking: one JSON line per hit
 * on stdout (collected by the process manager / journald), filterable with
 *   journalctl -u iunlockmobile | grep '"type":"ai_bot_hit"'
 * When AI_BOT_LOG_ENDPOINT is set the same record is also POSTed there in the
 * background via event.waitUntil, so a slow sink can never delay a page.
 *
 * status_code is what the app decided at the middleware layer (200 for a page
 * handed to the renderer, 3xx/4xx when middleware itself answered). A block by
 * Cloudflare never reaches the origin: use scripts/verify-ai-crawlers.mjs and
 * the Cloudflare AI Crawl Control log for that.
 */
export const AI_BOTS: [name: string, pattern: RegExp][] = [
  ['OAI-SearchBot', /OAI-SearchBot/i],
  ['ChatGPT-User', /ChatGPT-User/i],
  ['GPTBot', /GPTBot/i],
  ['PerplexityBot', /PerplexityBot/i],
  ['Perplexity-User', /Perplexity-User/i],
  ['Claude-SearchBot', /Claude-SearchBot/i],
  ['Claude-User', /Claude-User/i],
  ['ClaudeBot', /ClaudeBot/i],
  ['Google-Extended', /Google-Extended/i],
  ['Googlebot', /Googlebot/i],
  ['Applebot', /Applebot/i],
  ['bingbot', /bingbot/i],
]

export function detectAiBot(userAgent: string | null | undefined): string | null {
  if (!userAgent) return null
  for (const [name, pattern] of AI_BOTS) if (pattern.test(userAgent)) return name
  return null
}

export type BotHit = { type: 'ai_bot_hit'; bot_name: string; path: string; status_code: number; ip_country: string | null; timestamp: string }

export function botHit(botName: string, path: string, statusCode: number, country: string | null | undefined, now = new Date()): BotHit {
  const c = country && /^[A-Z]{2}$/.test(country.toUpperCase()) ? country.toUpperCase() : null
  return { type: 'ai_bot_hit', bot_name: botName, path: path.slice(0, 300), status_code: statusCode, ip_country: c, timestamp: now.toISOString() }
}

export function logBotHit(hit: BotHit, waitUntil?: (p: Promise<unknown>) => void): void {
  try {
    console.info(JSON.stringify(hit))
    const sink = process.env.AI_BOT_LOG_ENDPOINT
    if (sink && /^https:\/\//.test(sink) && waitUntil) {
      waitUntil(fetch(sink, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(hit), signal: AbortSignal.timeout(2000) }).catch(() => undefined))
    }
  } catch { /* Logging must never affect the response. */ }
}
