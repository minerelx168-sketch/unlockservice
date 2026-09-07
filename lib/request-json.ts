/** Small authenticated JSON commands also need a limit for chunked bodies. */
export async function readCommandJson(request: Request): Promise<Record<string, unknown>> {
  const maxBytes = 16 * 1024
  if (Number(request.headers.get('content-length')) > maxBytes) throw new Error('Request too large')
  if (!request.body) throw new Error('Empty request')
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Request deadline exceeded')), 5_000)
  })
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), deadline])
      if (done) break
      size += value.byteLength
      if (size > maxBytes) throw new Error('Request too large')
      chunks.push(value)
    }
    const value: unknown = JSON.parse(Buffer.concat(chunks, size).toString('utf8'))
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Object required')
    return value as Record<string, unknown>
  } catch (error) {
    void reader.cancel().catch(() => {})
    throw error
  } finally {
    clearTimeout(timer)
    reader.releaseLock()
  }
}
