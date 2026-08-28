import { createHash, randomBytes } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import { assertSignInAllowed, AuthError, getUser, hashPassword, type User } from './auth'
import { db } from './db'

const PROVIDER = 'google'
const TRANSACTION_TTL_SECONDS = 10 * 60
const AUTHORIZATION_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))

export const GOOGLE_OAUTH_COOKIE = 'iunlockmobile_google_oauth'
export const GOOGLE_OAUTH_COOKIE_MAX_AGE = TRANSACTION_TTL_SECONDS

type GoogleConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

type OAuthTransaction = {
  codeVerifier: string
  nonce: string
}

type TokenResponse = {
  id_token?: string
}

export type GoogleIdentity = {
  subject: string
  email: string
  emailVerified: boolean
}

function sha256(value: string, encoding: 'hex' | 'base64url' = 'hex'): string {
  return createHash('sha256').update(value).digest(encoding)
}

function nowIso(): string {
  return new Date().toISOString()
}

function requiredConfig(): GoogleConfig {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim()
  if (!clientId || !clientSecret || !redirectUri) {
    throw new AuthError('Google sign-in is temporarily unavailable.')
  }
  return { clientId, clientSecret, redirectUri }
}

export function googleOAuthConfigured(): boolean {
  try {
    requiredConfig()
    return true
  } catch {
    return false
  }
}

export function googleOAuthPublicUrl(path: string): URL {
  if (!path.startsWith('/') || path.startsWith('//')) {
    throw new AuthError('Google sign-in redirect is invalid.')
  }

  let publicOrigin: string
  try {
    publicOrigin = new URL(requiredConfig().redirectUri).origin
  } catch {
    throw new AuthError('Google sign-in is temporarily unavailable.')
  }
  return new URL(path, publicOrigin)
}

export function beginGoogleOAuth(): { authorizationUrl: string; transactionId: string } {
  const config = requiredConfig()
  const transactionId = randomBytes(24).toString('hex')
  const state = randomBytes(32).toString('base64url')
  const codeVerifier = randomBytes(64).toString('base64url')
  const nonce = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + TRANSACTION_TTL_SECONDS * 1000).toISOString()

  db().transaction(() => {
    db().prepare('DELETE FROM oauth_transactions WHERE expires_at <= ? OR consumed_at IS NOT NULL').run(nowIso())
    db()
      .prepare(
        `INSERT INTO oauth_transactions
           (id, provider, state_hash, code_verifier, nonce, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(transactionId, PROVIDER, sha256(state), codeVerifier, nonce, expiresAt)
  })()

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    nonce,
    code_challenge: sha256(codeVerifier, 'base64url'),
    code_challenge_method: 'S256',
    access_type: 'online',
    include_granted_scopes: 'true',
    prompt: 'select_account',
  })

  return {
    authorizationUrl: `${AUTHORIZATION_ENDPOINT}?${params.toString()}`,
    transactionId,
  }
}

function consumeTransaction(transactionId: string, state: string): OAuthTransaction {
  if (!/^[0-9a-f]{48}$/.test(transactionId) || state.length < 32 || state.length > 256) {
    throw new AuthError('Google sign-in request is invalid or expired.')
  }

  return db().transaction(() => {
    const row = db()
      .prepare(
        `SELECT state_hash, code_verifier, nonce, expires_at
           FROM oauth_transactions
          WHERE id = ? AND provider = ? AND consumed_at IS NULL`,
      )
      .get(transactionId, PROVIDER) as
      | { state_hash: string; code_verifier: string; nonce: string; expires_at: string }
      | undefined

    if (!row || row.expires_at <= nowIso() || row.state_hash !== sha256(state)) {
      throw new AuthError('Google sign-in request is invalid or expired.')
    }

    const consumed = db()
      .prepare('UPDATE oauth_transactions SET consumed_at = ? WHERE id = ? AND consumed_at IS NULL')
      .run(nowIso(), transactionId)
    if (consumed.changes !== 1) throw new AuthError('Google sign-in request was already used.')
    return { codeVerifier: row.code_verifier, nonce: row.nonce }
  })()
}

async function exchangeCode(code: string, codeVerifier: string, config: GoogleConfig): Promise<string> {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: config.redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    }),
    cache: 'no-store',
  })

  if (!response.ok) {
    console.error('[google-oauth] token exchange failed', response.status)
    throw new AuthError('Google sign-in could not be completed. Please try again.')
  }

  const tokens = (await response.json()) as TokenResponse
  if (!tokens.id_token) throw new AuthError('Google did not return an identity token.')
  return tokens.id_token
}

async function verifyIdentity(idToken: string, nonce: string, clientId: string): Promise<GoogleIdentity> {
  let payload
  try {
    ;({ payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
      clockTolerance: 5,
    }))
  } catch {
    throw new AuthError('Google identity validation failed.')
  }

  if (payload.nonce !== nonce) throw new AuthError('Google identity validation failed.')
  if (payload.azp && payload.azp !== clientId) throw new AuthError('Google identity validation failed.')
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255) {
    throw new AuthError('Google identity validation failed.')
  }
  if (typeof payload.email !== 'string' || payload.email_verified !== true) {
    throw new AuthError('Google must provide a verified email address.')
  }

  const email = payload.email.trim().toLowerCase()
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    throw new AuthError('Google must provide a valid email address.')
  }
  return { subject: payload.sub, email, emailVerified: true }
}

function availableUsername(email: string): string {
  const localPart = email.split('@', 1)[0] ?? ''
  let base = localPart.toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^[._-]+|[._-]+$/g, '')
  if (base.length < 3) base = `google-${base || 'user'}`
  base = base.slice(0, 24)

  for (let index = 0; index < 10_000; index += 1) {
    const suffix = index === 0 ? '' : `-${index}`
    const candidate = `${base.slice(0, 32 - suffix.length)}${suffix}`
    const exists = db().prepare('SELECT 1 FROM users WHERE lower(username) = lower(?)').get(candidate)
    if (!exists) return candidate
  }
  throw new AuthError('A local username could not be created for this Google account.')
}

export function linkGoogleIdentity(identity: GoogleIdentity): User {
  if (!identity.emailVerified) throw new AuthError('Google must provide a verified email address.')

  return db().transaction(() => {
    const linked = db()
      .prepare('SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_subject = ?')
      .get(PROVIDER, identity.subject) as { user_id: number } | undefined

    if (linked) {
      db()
        .prepare('UPDATE oauth_accounts SET provider_email = ?, updated_at = ? WHERE provider = ? AND provider_subject = ?')
        .run(identity.email, nowIso(), PROVIDER, identity.subject)
      const user = getUser(linked.user_id)
      if (!user) throw new AuthError('The linked local account no longer exists.')
      return assertSignInAllowed(user)
    }

    const existing = db().prepare('SELECT id FROM users WHERE lower(email) = lower(?) LIMIT 1').get(identity.email) as
      | { id: number }
      | undefined

    let user: User
    if (existing) {
      const differentGoogleAccount = db()
        .prepare('SELECT 1 FROM oauth_accounts WHERE provider = ? AND user_id = ?')
        .get(PROVIDER, existing.id)
      if (differentGoogleAccount) throw new AuthError('This local account is linked to a different Google account.')
      db()
        .prepare('UPDATE users SET email_verified_at = COALESCE(email_verified_at, ?) WHERE id = ?')
        .run(nowIso(), existing.id)
      user = getUser(existing.id)!
      assertSignInAllowed(user)
    } else {
      const username = availableUsername(identity.email)
      const info = db()
        .prepare(
          `INSERT INTO users (username, email, password_hash, email_verified_at)
           VALUES (?, ?, ?, ?)`,
        )
        .run(username, identity.email, hashPassword(randomBytes(48).toString('base64url')), nowIso())
      user = getUser(Number(info.lastInsertRowid))!
    }

    db()
      .prepare(
        `INSERT INTO oauth_accounts
           (provider, provider_subject, user_id, provider_email, updated_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(PROVIDER, identity.subject, user.id, identity.email, nowIso())
    return user
  })()
}

export async function completeGoogleOAuth(transactionId: string, state: string, code: string): Promise<User> {
  if (!code || code.length > 4096) throw new AuthError('Google sign-in response is invalid.')
  const config = requiredConfig()
  const transaction = consumeTransaction(transactionId, state)
  const idToken = await exchangeCode(code, transaction.codeVerifier, config)
  const identity = await verifyIdentity(idToken, transaction.nonce, config.clientId)
  return linkGoogleIdentity(identity)
}
