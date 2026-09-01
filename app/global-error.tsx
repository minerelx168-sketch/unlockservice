'use client'

/**
 * The root layout itself failed, so there is no shell to render into and no
 * stylesheet to rely on — this component supplies its own <html> and <body>.
 * Everything it needs is inline for that reason, not out of carelessness.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'grid',
          placeItems: 'center',
          padding: '32px',
          background: '#f4f6fa',
          color: '#0e1a2b',
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <main style={{ maxWidth: 460, textAlign: 'center' }}>
          <p style={{ fontWeight: 700, letterSpacing: '-0.02em', fontSize: 20, margin: '0 0 12px' }}>
            iUnlockMobile
          </p>
          <h1 style={{ fontSize: 26, lineHeight: 1.2, margin: '0 0 12px' }}>
            The site could not be loaded.
          </h1>
          <p style={{ color: '#55647a', lineHeight: 1.6, margin: '0 0 22px' }}>
            Nothing you were part-way through has been charged.
            {error.digest ? ` Reference ${error.digest}.` : ''}
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              font: 'inherit',
              fontWeight: 600,
              padding: '12px 20px',
              borderRadius: 14,
              border: 0,
              background: '#1a4fd6',
              color: '#ffffff',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  )
}
