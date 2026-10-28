/** Allowlisted diagnostics only: never log messages, stacks, bodies, headers or IDs. */
export function paymentFailure(stage: string, error: unknown) {
  const read = (x: unknown, key: string): unknown => {
    try { return x && typeof x === 'object' ? (x as Record<string, unknown>)[key] : undefined } catch { return undefined }
  }
  const allowed = ['Error','TypeError','WhopError','WhopTimeoutError','TimeoutError','AbortError','FetchError','APIError']
  const codes = ['ETIMEDOUT','ECONNRESET','ECONNREFUSED','ENOTFOUND','EAI_AGAIN','UND_ERR_CONNECT_TIMEOUT','SQLITE_BUSY','SQLITE_LOCKED']
  const name = read(error,'name')
  const code = read(error,'code') ?? read(read(error,'cause'),'code')
  const status = read(error,'statusCode') ?? read(error,'status')
  return { event:'payment_worker_failure', stage, error_type: allowed.includes(String(name)) ? String(name) : 'OtherError',
    error_code: codes.includes(String(code)) ? String(code) : null,
    http_status: typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? status : null }
}
export function logPaymentFailure(stage: string, error: unknown) {
  try { console.error(JSON.stringify(paymentFailure(stage,error))) } catch { /* Logging cannot affect settlement. */ }
}
