# Google OAuth Architecture for Unlockservice

**Author:** Manus AI  
**Production origin:** `https://iunlockmobile.com`  
**Callback:** `https://iunlockmobile.com/auth/google/callback`

## Architecture contract

Google authentication extends the existing custom account and session model; it does not introduce a second session framework. `lib/auth.ts` remains responsible for local users and application sessions. A new `lib/google-oauth.ts` module owns Google authorization requests, one-time OAuth transactions, token validation, and Google identity linking. Route handlers only start or complete the flow, set the existing `iunlockmobile_session` cookie, and redirect into the existing workspace.

| Boundary | Rule |
|---|---|
| Google identity | Persist `(provider, provider_subject)` and use Google's stable `sub` claim as the identity key; email is profile data, not the provider identity key. |
| Existing local user | A verified Google email may link to an existing local account with the same normalized email. The link is transactionally unique and never changes role, balance, membership, or password. |
| New Google user | Create a normal customer user with a collision-safe username, a generated inaccessible password hash, and `email_verified_at` set only when Google reports `email_verified = true`. |
| App session | Create the same 14-day server-side session used by password login; do not store Google access or refresh tokens because the app requests identity scopes only. |
| Account restrictions | Refuse sessions for paused, banned, or unverified accounts using the same checks as password authentication. |

## Authorization flow

The start route requires Google OAuth environment variables, creates a cryptographically random `state`, `nonce`, and PKCE verifier, stores only a SHA-256 hash of `state` plus the verifier/nonce in SQLite, sets a short-lived HttpOnly `SameSite=Lax` transaction cookie, and redirects to Google's HTTPS authorization endpoint. Requested scopes are only `openid email profile`; access is online and no refresh token is requested.

The callback requires both the cookie transaction ID and matching one-time `state`. It consumes the transaction before exchanging the authorization code, then sends the code and PKCE verifier to Google's token endpoint. The returned ID token is verified against Google's JWKS with `jose`, including signature, issuer, audience, expiration, and nonce. The flow requires a verified email and a non-empty `sub`, links or creates the local account atomically, creates the ordinary unlockservice session, clears the transaction cookie, and redirects to `/user/unlock`.

## Additive schema

| Table | Purpose and constraints |
|---|---|
| `oauth_accounts` | Maps a local user to a stable provider subject. Primary key `(provider, provider_subject)` and unique `(provider, user_id)` prevent identity duplication. No access tokens are stored. |
| `oauth_transactions` | Stores one-time login state with `id`, `provider`, `state_hash`, PKCE verifier, nonce, expiry, and consumed timestamp. Expired rows are deleted during new starts. |

Migration `2026-08-google-oauth-v1` is additive and idempotent. It does not alter existing users, passwords, sessions, roles, balances, invoices, orders, or ledger entries.

## Configuration and operations

| Environment variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID` | Public OAuth web client identifier. |
| `GOOGLE_CLIENT_SECRET` | Confidential token-exchange credential stored only in `/etc/unlockservice.env`. |
| `GOOGLE_REDIRECT_URI` | Exact callback URI; production value is `https://iunlockmobile.com/auth/google/callback`. |

The Google Cloud OAuth client must be a Web application and the callback must be registered as an exact authorized redirect URI. Credentials stay outside Git and source packages. Because the secret was supplied through chat, rotate it after production verification and update the root-only environment file without changing the client ID or callback.

## References

[1]: https://developers.google.com/identity/openid-connect/openid-connect "Google OpenID Connect"
[2]: https://developers.google.com/identity/protocols/oauth2/web-server "Google OAuth 2.0 for Web Server Applications"
[3]: https://support.google.com/cloud/answer/15549257?hl=en "Manage OAuth Clients"

## Google Cloud configuration observed on 2026-08-28

The OAuth client belongs to Google Cloud project `elevated-legacy-506905-f8` (`Google OAUTH`) under `rmandzor@gmail.com`. The production callback `https://iunlockmobile.com/auth/google/callback` was added while preserving the prior `/login` redirect. A read-only authorization request then reached the normal Google sign-in page with no `redirect_uri_mismatch`.

The audience is External but remains in Testing with zero test users. Publishing is blocked because Branding is incomplete. Existing values are app name `Iunlockmobile`, support email `rmandzor@gmail.com`, and developer contact `rmandzor@gmail.com`. Missing fields are application home page, privacy policy URL, terms URL, and authorized domain. Before public launch, the website must expose privacy/terms pages, Branding must be saved with `iunlockmobile.com`, and the user must explicitly approve publishing the OAuth app.
