# Public discovery and IndexNow

The discovery routes and MCP tools cannot create an order, retrieve a paid report, or call a supplier. A checksum is not proof of a genuine device. Compare prices in USD; check-only offers do not unlock a handset. GET query strings can be logged by intermediaries: use tools/call via POST when submitting a real identifier.

After deployment, run `node scripts/verify-agent-discovery.mjs https://iunlockmobile.com`. The verification uses a checksum example, not a customer device.

Generate an IndexNow ownership key using `openssl rand -hex 32`. Set the same value as INDEXNOW_KEY in the production service environment. Restart the service after changing its environment. Its root-level /indexnow-key.txt is a public verification file, not an authentication credential. Run `npm run indexnow:ping -- --dry-run` to inspect the published sitemap selection; then `npm run indexnow:ping` to submit. For manual production deployments run this after the health check. The normal deploy script submits only after its production health check passes. It never edits articles, starts a deployment, or blocks a release on an indexing failure. HTTP 202 means verification is pending.

ORGANIZATION_SAME_AS optionally takes a comma-separated list of verified company profile URLs. Leave it unset rather than inventing profiles.
