import { CopySnippet } from '@/components/copy-snippet'

const baseUrl = 'https://iunlockmobile.com/api/reseller/v1'
const authorization = 'Authorization: Bearer YOUR_API_KEY'
const orderBody = JSON.stringify({
  service_code: 'SERVICE_CODE_FROM_CATALOG',
  identifier: 'YOUR_CUSTOMER_IMEI',
  expected_price_cents: 800,
  accepted_terms: true,
}, null, 2)

const endpoints = [
  { method: 'GET', path: '/balance', title: 'Check wallet balance',
    description: 'Available USD wallet funds and the amount reserved for pending orders.',
    response: 'currency, wallet_balance, wallet_balance_cents, reserved_cents, role' },
  { method: 'GET', path: '/services', title: 'Get services and prices',
    description: 'Available services with your reseller prices, identifier requirements and delivery estimates.',
    response: 'services[]: service_code, name, category, group, input_type, currency, retail_price, reseller_price, price_cents, eta_minutes' },
  { method: 'POST', path: '/orders', title: 'Place an order',
    description: 'Submit one order paid from your wallet. Use the service code and current price from GET /services.',
    response: 'order: id, status, service_code, price_cents, result, raw_result, account_url; wallet_balance_cents' },
  { method: 'GET', path: '/orders', title: 'List your orders',
    description: 'Your latest 50 orders. To load the next page, add ?before= followed by the returned next_before value. A null value means there are no more pages.',
    response: 'orders[], next_before' },
  { method: 'GET', path: '/orders/ORDER_ID', title: 'Get an order and its result',
    description: 'Replace ORDER_ID with the numeric order ID returned after submission. Reading an order does not submit it again.',
    response: 'order: id, status, result, raw_result, message, created_at, updated_at, completed_at, account_url' },
  { method: 'GET', path: '/transactions', title: 'Get wallet transactions',
    description: 'Your latest 50 wallet entries. Use ?before= with next_before to continue. Amounts are signed USD cents.',
    response: 'transactions[]: id, type, amount_cents, currency, balance_after_cents, ref_type, ref_id, created_at; next_before' },
] as const

function curl(method: string, path: string) {
  const lines = [`curl --request ${method} '${baseUrl}${path}'`, `  --header '${authorization}'`]
  if (method === 'POST') lines.push(
    "  --header 'Content-Type: application/json'",
    "  --header 'Idempotency-Key: my-store-order-000001'",
    `  --data '${orderBody}'`,
  )
  return lines.join(' \\\n')
}

export function ResellerApiDocs() {
  return <section className="panel reseller-api-docs" id="api-docs" aria-labelledby="api-docs-heading">
    <header><div><span className="eyebrow">Developer guide · v1</span><h2 id="api-docs-heading">API Docs</h2></div>
      <a className="api-guide-link" href="https://github.com/minerelx168-sketch/unlockservice/blob/main/docs/reseller-api.md" target="_blank" rel="noopener noreferrer">Full integration guide ↗</a>
    </header>
    <div className="panel-body reseller-docs">
      <p>Connect your store to iUnlockMobile. Copy an endpoint or a ready-to-edit request, then replace the placeholders with your own values.</p>
      <div className="api-connection">
        <CopySnippet label="Base URL" value={baseUrl} buttonLabel="Copy URL"/>
        <CopySnippet label="Authorization header" value={authorization} buttonLabel="Copy header"/>
      </div>
      <ol className="api-steps">
        <li>Create an API key in your active reseller account.</li>
        <li>Call <code>GET /services</code> to choose a service and confirm its current price.</li>
        <li>Send <code>POST /orders</code>, then retrieve the result or receive a signed webhook.</li>
      </ol>
      <p className="t-small">All endpoints require a Bearer API key sent from your server. Opening an endpoint in a browser without this header returns 401. Keep real keys out of browser code and URLs. Copy buttons only copy text; they do not place orders.</p>

      <div className="api-section-heading" id="api-endpoints"><h3>Endpoints</h3><span>6 operations · JSON · HTTPS</span></div>
      <div className="api-endpoint-list">
        {endpoints.map(endpoint => <article className="api-endpoint" key={`${endpoint.method} ${endpoint.path}`}>
          <div className="api-endpoint-heading"><span className={`api-method api-method--${endpoint.method.toLowerCase()}`}>{endpoint.method}</span><h4>{endpoint.title}</h4></div>
          <p>{endpoint.description}</p>
          <CopySnippet label={`${endpoint.method} ${endpoint.path} URL`} value={`${baseUrl}${endpoint.path}`} buttonLabel="Copy URL"/>
          <details>
            <summary>Request example &amp; response fields</summary>
            <CopySnippet label={`${endpoint.method} ${endpoint.path} cURL`} value={curl(endpoint.method, endpoint.path)} multiline buttonLabel="Copy cURL"/>
            {endpoint.method === 'POST' ? <>
              <p><strong>This request spends wallet funds when accepted.</strong> Replace the example service, identifier and price before running it. The example <code>800</code> means $8.00; it is not a service quote.</p>
              <dl className="api-fields">
                <div><dt>service_code · required</dt><dd>Exact code from GET /services.</dd></div>
                <div><dt>identifier · required</dt><dd>Customer IMEI or the identifier type required by the service. IMEIs must have 15 digits and pass Luhn validation.</dd></div>
                <div><dt>accepted_terms · required</dt><dd>Send true only after confirming device authorization and the published service terms with your customer.</dd></div>
                <div><dt>expected_price_cents · optional</dt><dd>Positive integer matching the current price_cents from the catalog. A stale price is rejected before spending.</dd></div>
                <div><dt>Idempotency-Key · required header</dt><dd>8–100 letters, digits, dots, colons, underscores or hyphens. Use one unique key per order and reuse it for every retry of that order.</dd></div>
              </dl>
            </> : null}
            <p className="api-response-fields"><strong>Response fields</strong><code>{endpoint.response}</code></p>
          </details>
        </article>)}
      </div>

      <details className="api-reference"><summary>Order statuses, retries &amp; error codes</summary>
        <p>Order statuses: <code>processing</code>, <code>completed</code>, <code>refunded</code>, <code>manual_review</code>. Results stay in your account under Service history.</p>
        <p><strong>Reuse the same Idempotency-Key when retrying.</strong> A timeout does not mean an order failed. Do not use a new key for the same customer order. A different order with an existing key returns 409.</p>
        <dl className="api-fields">
          <div><dt>400 / 422</dt><dd>Invalid request or service input. Read the returned error and code.</dd></div>
          <div><dt>401 / 403</dt><dd>Missing or revoked key, or an account without active reseller access.</dd></div>
          <div><dt>402</dt><dd>Insufficient wallet funds.</dd></div>
          <div><dt>404 / 409</dt><dd>Order not found, or an idempotency conflict.</dd></div>
          <div><dt>429</dt><dd>Rate limit reached. Follow Retry-After. Limits: 120 requests/minute and 600 new orders/hour per account.</dd></div>
          <div><dt>503</dt><dd>Temporarily unavailable. Retry with the same order key.</dd></div>
        </dl>
        <p>Money uses USD. Fields ending in <code>_cents</code> are integers; 100 cents = $1.00. List endpoints return at most 50 entries.</p>
      </details>
      <details className="api-reference"><summary>Result webhooks &amp; signature verification</summary>
        <p>Set your own receiver URL in Result webhook. iUnlockMobile sends <code>order.completed</code> and <code>order.refunded</code> to that URL; it is separate from the API endpoints above.</p>
        <p>Verify HMAC-SHA256 with your signing secret over <code>event_id.timestamp.raw_body</code>. Compare it with the hex value after <code>sha256=</code> in X-IUnlockMobile-Signature using a constant-time comparison. Read the ID and timestamp from X-IUnlockMobile-Event-Id and X-IUnlockMobile-Timestamp.</p>
        <p>Reject timestamps more than 5 minutes from the current time. Deduplicate by event ID and return a 2xx response promptly. Delivery retries up to 12 times with backoff. HTTPS port 443 and public IPv4 are required; redirects are refused. If delivery fails, retrieve the result through GET /orders/ORDER_ID.</p>
      </details>
    </div>
  </section>
}
