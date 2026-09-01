const DEFAULT_ORIGIN = 'https://iunlockmobile.com'

/**
 * The origin the site is reachable at from outside.
 *
 * robots.txt and the sitemap have to name absolute URLs, and neither is
 * rendered per-request, so there is no incoming Host header to read. The
 * OAuth redirect URI already carries the public origin wherever it is
 * configured; this reuses it rather than adding a second variable that
 * could disagree with the first.
 */
export function publicOrigin(): string {
  const configured = process.env.IUNLOCKMOBILE_PUBLIC_ORIGIN?.trim() || process.env.GOOGLE_REDIRECT_URI?.trim()
  if (!configured) return DEFAULT_ORIGIN
  try {
    return new URL(configured).origin
  } catch {
    return DEFAULT_ORIGIN
  }
}
