/**
 * Cookie names, in one place with no imports.
 *
 * middleware.ts runs on the edge runtime and cannot pull in next/headers, so
 * it cannot import the modules that own these cookies. Naming them here keeps
 * the middleware and those modules from drifting apart.
 */

export const SESSION_COOKIE = 'iunlockmobile_session'
export const GOOGLE_OAUTH_COOKIE = 'iunlockmobile_google_oauth'
export const QUOTE_COOKIE = 'iunlockmobile_quote'
